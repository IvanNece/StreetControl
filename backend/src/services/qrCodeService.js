/**
 * QR Code Service
 * 
 * Generates QR codes for judge authentication
 * 
 * WORKFLOW:
 * 1. Regista requests QR codes for 3 judges
 * 2. Generate JWT token for each judge with {judgeId, meetId, role}
 * 3. Create QR code containing login URL: /judge-login?token=xyz
 * 4. Judges scan QR and auto-login to voting interface
 */

import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import Judge from '../models/Judge.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/jwt.js';

class QRCodeService {
  /**
   * Generate QR code for a judge
   * @param {number} judgeId - Judge ID
   * @param {string} baseUrl - Base URL (e.g., 'http://localhost:3000')
   * @returns {Promise<Object>} { token, qrCodeDataURL, loginUrl }
   */
  async generateJudgeQR(judgeId, baseUrl = 'http://localhost:3000') {
    // Get judge info
    const judge = await Judge.findById(judgeId);
    if (!judge) {
      throw new Error(`Judge with ID ${judgeId} not found`);
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        judgeId: judge.id,
        meetId: judge.meet_id,
        role: judge.role,
        type: 'judge'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN || '24h' }
    );

    // Create login URL
    const loginUrl = `${baseUrl}/judge-login?token=${token}`;

    // Generate QR code as Data URL (base64 image)
    const qrCodeDataURL = await QRCode.toDataURL(loginUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 2
    });

    return {
      judgeId: judge.id,
      role: judge.role,
      token,
      qrCodeDataURL,
      loginUrl
    };
  }

  /**
   * Generate QR codes for all judges of a meet
   * @param {number} meetId - Meet ID
   * @param {string} baseUrl - Base URL
   * @returns {Promise<Array>} Array of QR code objects
   */
  async generateMeetJudgeQRs(meetId, baseUrl = 'http://localhost:3000') {
    // Get all judges for meet
    const judges = await Judge.findByMeet(meetId);

    if (judges.length === 0) {
      throw new Error(`No judges found for meet ${meetId}`);
    }

    // Generate QR for each judge
    const qrCodes = await Promise.all(
      judges.map(judge => this.generateJudgeQR(judge.id, baseUrl))
    );

    return qrCodes;
  }

  /**
   * Verify judge token from QR code
   * @param {string} token - JWT token
   * @returns {Object} Decoded token payload
   */
  verifyJudgeToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (decoded.type !== 'judge') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Generate QR code as PNG buffer (for file download)
   * @param {number} judgeId - Judge ID
   * @param {string} baseUrl - Base URL
   * @returns {Promise<Buffer>} PNG image buffer
   */
  async generateJudgeQRBuffer(judgeId, baseUrl = 'http://localhost:3000') {
    const judge = await Judge.findById(judgeId);
    if (!judge) {
      throw new Error(`Judge with ID ${judgeId} not found`);
    }

    const token = jwt.sign(
      {
        judgeId: judge.id,
        meetId: judge.meet_id,
        role: judge.role,
        type: 'judge'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN || '24h' }
    );

    const loginUrl = `${baseUrl}/judge-login?token=${token}`;

    // Generate QR as buffer
    const buffer = await QRCode.toBuffer(loginUrl, {
      errorCorrectionLevel: 'M',
      type: 'png',
      width: 300,
      margin: 2
    });

    return buffer;
  }

  /**
   * Generate QR code as SVG string
   * @param {number} judgeId - Judge ID
   * @param {string} baseUrl - Base URL
   * @returns {Promise<string>} SVG string
   */
  async generateJudgeQRSVG(judgeId, baseUrl = 'http://localhost:3000') {
    const judge = await Judge.findById(judgeId);
    if (!judge) {
      throw new Error(`Judge with ID ${judgeId} not found`);
    }

    const token = jwt.sign(
      {
        judgeId: judge.id,
        meetId: judge.meet_id,
        role: judge.role,
        type: 'judge'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN || '24h' }
    );

    const loginUrl = `${baseUrl}/judge-login?token=${token}`;

    // Generate QR as SVG
    const svg = await QRCode.toString(loginUrl, {
      errorCorrectionLevel: 'M',
      type: 'svg',
      width: 300,
      margin: 2
    });

    return svg;
  }
}

// Singleton instance
const qrCodeService = new QRCodeService();

export default qrCodeService;
