/**
 * Street Control - Backend Server Entry Point
 * 
 * Main server file that initializes Express, Socket.IO and database connections
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

// Import configurations
import { getDatabase, closeDatabase } from './config/database-local.js';

// Import middleware
import httpLogger from './middleware/logger.middleware.js';
import { notFoundHandler, errorHandler } from './middleware/error.middleware.js';

// Import routes
import routes from './routes/index.js';

// Import services
import socketService from './services/socketService.js';
import syncService from './services/syncService.js';

// Load environment variables
dotenv.config();

// Configuration
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Initialize Express app
const app = express();

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000,
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000
});

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================

// CORS middleware
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logger
app.use(httpLogger);

// Make Socket.IO instance available to routes via req object
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ============================================
// ROUTES
// ============================================

// Mount API routes under /api prefix
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Street Control Backend API',
    version: '1.0.0',
    documentation: '/api'
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ============================================
// SOCKET.IO EVENTS (Managed by socketService)
// ============================================

// Initialize socket service
socketService.initialize(io);
console.log('✅ Socket.IO service initialized');

// Initialize sync service (if credentials available)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (SUPABASE_URL && SUPABASE_KEY) {
  syncService.initialize(SUPABASE_URL, SUPABASE_KEY);
  console.log('✅ Sync service initialized with Supabase');
} else {
  console.log('⚠️  Sync service disabled (no Supabase credentials)');
}

// ============================================
// DATABASE CONNECTION & SERVER START
// ============================================

// Initialize database connection
try {
  getDatabase();
  console.log('📊 Database connection initialized');
} catch (error) {
  console.error('❌ Failed to connect to database:', error.message);
  process.exit(1);
}

// Start HTTP server
httpServer.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 Street Control Backend Server Started!');
  console.log('='.repeat(50));
  console.log(`📡 Environment: ${NODE_ENV}`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
  console.log(`📋 API Documentation: http://localhost:${PORT}/api`);
  console.log(`🔍 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔌 Socket.IO: Enabled`);
  console.log(`📊 Database: SQLite (Local)`);
  console.log('='.repeat(50) + '\n');
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

// Handle graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
  
  // Close server
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
    
    // Close database
    closeDatabase();
    
    // Exit process
    console.log('👋 Server shutdown complete\n');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Export for testing purposes
export { app, io, httpServer };
