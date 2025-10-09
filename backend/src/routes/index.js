/**
 * Main Router
 * 
 * Combines all route modules
 */

import express from 'express';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Street Control API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'Street Control API',
    version: '1.0.0',
    description: 'Streetlifting competition management system',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      meets: '/api/meets',
      athletes: '/api/athletes',
      flights: '/api/flights',
      attempts: '/api/attempts',
      judges: '/api/judges',
      votes: '/api/votes',
      rankings: '/api/rankings',
      records: '/api/records',
      export: '/api/export'
    }
  });
});

// Import route modules (will be implemented in next phases)
// import authRoutes from './auth.routes.js';
// import meetRoutes from './meet.routes.js';
// import athleteRoutes from './athlete.routes.js';
// import flightRoutes from './flight.routes.js';
// import attemptRoutes from './attempt.routes.js';
// import judgeRoutes from './judge.routes.js';
// import voteRoutes from './vote.routes.js';
// import rankingRoutes from './ranking.routes.js';
// import recordRoutes from './record.routes.js';
// import exportRoutes from './export.routes.js';

// Mount routes (will be uncommented as we implement each module)
// router.use('/auth', authRoutes);
// router.use('/meets', meetRoutes);
// router.use('/athletes', athleteRoutes);
// router.use('/flights', flightRoutes);
// router.use('/attempts', attemptRoutes);
// router.use('/judges', judgeRoutes);
// router.use('/votes', voteRoutes);
// router.use('/rankings', rankingRoutes);
// router.use('/records', recordRoutes);
// router.use('/export', exportRoutes);

export default router;
