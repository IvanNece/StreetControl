/**
 * Socket.IO Service
 * 
 * Manages real-time communication:
 * - Judges vote via tablets
 * - Regista controls flow with NEXT button
 * - Viewers see live results
 * - Overlay displays current athlete
 * 
 * ROOMS:
 * - meet_${meetId} - All connected clients for a meet
 * - judges_${meetId} - Only judges
 * - regista_${meetId} - Only regista
 * - viewers_${meetId} - Public viewers
 * 
 * EVENTS:
 * - judge:vote - Judge casts vote (WHITE/RED)
 * - regista:next - Regista presses NEXT button
 * - timer:start/stop/update - Timer control
 * - attempt:result - Attempt completed with result
 * - state:update - Competition state changed
 * - ranking:update - Rankings recalculated
 */

import validationService from './validationService.js';
import stateMachine from './stateMachine.js';
import rankingService from './rankingService.js';
import Attempt from '../models/Attempt.js';
import Judge from '../models/Judge.js';

class SocketService {
  constructor() {
    this.io = null;
  }

  /**
   * Initialize Socket.IO with server instance
   * @param {Object} io - Socket.IO server instance
   */
  initialize(io) {
    this.io = io;
    
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      // ===== JOIN ROOMS =====
      socket.on('join:meet', (data) => this._handleJoinMeet(socket, data));
      socket.on('join:judge', (data) => this._handleJoinJudge(socket, data));
      socket.on('join:regista', (data) => this._handleJoinRegista(socket, data));
      socket.on('join:viewer', (data) => this._handleJoinViewer(socket, data));

      // ===== JUDGE EVENTS =====
      socket.on('judge:vote', (data) => this._handleJudgeVote(socket, data));

      // ===== REGISTA EVENTS =====
      socket.on('regista:next', (data) => this._handleRegistaNext(socket, data));
      socket.on('regista:updateWeight', (data) => this._handleUpdateWeight(socket, data));

      // ===== TIMER EVENTS =====
      socket.on('timer:start', (data) => this._handleTimerStart(socket, data));
      socket.on('timer:stop', (data) => this._handleTimerStop(socket, data));

      // ===== DISCONNECT =====
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Handle meet join
   * @private
   */
  _handleJoinMeet(socket, data) {
    const { meetId } = data;
    socket.join(`meet_${meetId}`);
    console.log(`Socket ${socket.id} joined meet_${meetId}`);
  }

  /**
   * Handle judge join
   * @private
   */
  _handleJoinJudge(socket, data) {
    const { meetId, judgeId, role } = data;
    socket.join(`meet_${meetId}`);
    socket.join(`judges_${meetId}`);
    socket.data.judgeId = judgeId;
    socket.data.judgeRole = role;
    socket.data.meetId = meetId;
    console.log(`Judge ${role} joined meet_${meetId}`);
  }

  /**
   * Handle regista join
   * @private
   */
  _handleJoinRegista(socket, data) {
    const { meetId } = data;
    socket.join(`meet_${meetId}`);
    socket.join(`regista_${meetId}`);
    socket.data.meetId = meetId;
    console.log(`Regista joined meet_${meetId}`);
  }

  /**
   * Handle viewer join
   * @private
   */
  _handleJoinViewer(socket, data) {
    const { meetId } = data;
    socket.join(`meet_${meetId}`);
    socket.join(`viewers_${meetId}`);
    console.log(`Viewer joined meet_${meetId}`);
  }

  /**
   * Handle judge vote
   * @private
   */
  async _handleJudgeVote(socket, data) {
    try {
      const { attemptId, vote } = data;
      const { judgeRole, meetId } = socket.data;

      if (!judgeRole) {
        socket.emit('error', { message: 'Not authenticated as judge' });
        return;
      }

      // Register vote in validation service
      const result = validationService.registerVote(attemptId, judgeRole, vote);

      // Broadcast vote to regista and viewers (but NOT to other judges)
      this.io.to(`regista_${meetId}`).emit('vote:received', {
        attemptId,
        judgeRole,
        vote,
        voteCount: result.isComplete ? 3 : validationService.getVoteCount(attemptId)
      });

      // If voting complete, finalize attempt
      if (result.isComplete) {
        await validationService.finalizeAttempt(attemptId, result.result);

        // Broadcast result to ALL
        this.io.to(`meet_${meetId}`).emit('attempt:result', {
          attemptId,
          result: result.result,
          votes: result.votes
        });

        // Recalculate rankings
        const state = await stateMachine.getCurrentAthlete();
        if (state) {
          const rankings = await rankingService.calculateRankings(
            state.meet_id,
            state.current_lift_id
          );
          
          this.io.to(`meet_${meetId}`).emit('ranking:update', rankings);
        }
      }

      // Acknowledge vote to judge
      socket.emit('vote:confirmed', { attemptId, vote });

    } catch (error) {
      console.error('Error handling judge vote:', error);
      socket.emit('error', { message: error.message });
    }
  }

  /**
   * Handle regista NEXT button
   * @private
   */
  async _handleRegistaNext(socket, data) {
    try {
      const { meetId } = socket.data;

      // Move to next athlete
      const newState = await stateMachine.next();

      if (newState.finished) {
        // Competition finished
        this.io.to(`meet_${meetId}`).emit('competition:finished', {
          message: 'Competition completed for this group'
        });
        return;
      }

      // Broadcast new state to ALL
      this.io.to(`meet_${meetId}`).emit('state:update', newState);

      // Get upcoming order for regista
      const upcomingOrder = await stateMachine.getUpcomingOrder(
        newState.current_group_id,
        newState.current_lift_id,
        newState.current_round
      );

      this.io.to(`regista_${meetId}`).emit('queue:update', upcomingOrder);

    } catch (error) {
      console.error('Error handling NEXT:', error);
      socket.emit('error', { message: error.message });
    }
  }

  /**
   * Handle weight update for current attempt
   * @private
   */
  async _handleUpdateWeight(socket, data) {
    try {
      const { attemptId, weightKg } = data;
      const { meetId } = socket.data;

      await stateMachine.updateAttemptWeight(attemptId, weightKg);

      // Broadcast weight update
      this.io.to(`meet_${meetId}`).emit('weight:updated', {
        attemptId,
        weightKg
      });

    } catch (error) {
      console.error('Error updating weight:', error);
      socket.emit('error', { message: error.message });
    }
  }

  /**
   * Handle timer start
   * @private
   */
  async _handleTimerStart(socket, data) {
    try {
      const { seconds = 60 } = data;
      const { meetId } = socket.data;

      // Broadcast timer start to ALL
      this.io.to(`meet_${meetId}`).emit('timer:started', {
        seconds,
        startTime: Date.now()
      });

    } catch (error) {
      console.error('Error starting timer:', error);
      socket.emit('error', { message: error.message });
    }
  }

  /**
   * Handle timer stop
   * @private
   */
  async _handleTimerStop(socket, data) {
    try {
      const { meetId } = socket.data;

      // Broadcast timer stop to ALL
      this.io.to(`meet_${meetId}`).emit('timer:stopped');

    } catch (error) {
      console.error('Error stopping timer:', error);
      socket.emit('error', { message: error.message });
    }
  }

  /**
   * Broadcast message to specific room
   * @param {string} room - Room name
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  broadcast(room, event, data) {
    if (this.io) {
      this.io.to(room).emit(event, data);
    }
  }

  /**
   * Broadcast to all clients in a meet
   * @param {number} meetId - Meet ID
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  broadcastToMeet(meetId, event, data) {
    this.broadcast(`meet_${meetId}`, event, data);
  }
}

// Singleton instance
const socketService = new SocketService();

export default socketService;
