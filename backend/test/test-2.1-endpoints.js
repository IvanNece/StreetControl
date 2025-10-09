/**
 * Test Script for Phase 2.1
 * 
 * Verifica completa del server Express + Socket.IO
 */

import fetch from 'node-fetch';
import { io as ioClient } from 'socket.io-client';

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

// Colori per output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(emoji, message, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function success(message) {
  log('✅', message, colors.green);
}

function error(message) {
  log('❌', message, colors.red);
}

function info(message) {
  log('ℹ️ ', message, colors.blue);
}

function section(title) {
  console.log('\n' + '='.repeat(50));
  log('📋', title, colors.yellow);
  console.log('='.repeat(50) + '\n');
}

// Test Functions
async function testRootEndpoint() {
  try {
    const response = await fetch(BASE_URL);
    const data = await response.json();
    
    if (response.ok && data.success) {
      success('Root endpoint (/) works correctly');
      info(`   Version: ${data.version}`);
      return true;
    } else {
      error('Root endpoint failed');
      return false;
    }
  } catch (err) {
    error(`Root endpoint error: ${err.message}`);
    return false;
  }
}

async function testHealthEndpoint() {
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    
    if (response.ok && data.success) {
      success('Health check endpoint works correctly');
      info(`   Environment: ${data.environment}`);
      info(`   Timestamp: ${data.timestamp}`);
      return true;
    } else {
      error('Health check failed');
      return false;
    }
  } catch (err) {
    error(`Health check error: ${err.message}`);
    return false;
  }
}

async function testAPIInfo() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    
    if (response.ok && data.success) {
      success('API info endpoint works correctly');
      info(`   Name: ${data.name}`);
      info(`   Available endpoints: ${Object.keys(data.endpoints).length}`);
      return true;
    } else {
      error('API info failed');
      return false;
    }
  } catch (err) {
    error(`API info error: ${err.message}`);
    return false;
  }
}

async function test404Handler() {
  try {
    const response = await fetch(`${API_URL}/nonexistent-route`);
    const data = await response.json();
    
    if (response.status === 404 && !data.success) {
      success('404 handler works correctly');
      info(`   Error message: ${data.error.message}`);
      return true;
    } else {
      error('404 handler failed - should return 404 status');
      return false;
    }
  } catch (err) {
    error(`404 handler test error: ${err.message}`);
    return false;
  }
}

async function testCORS() {
  try {
    const response = await fetch(`${API_URL}/health`, {
      headers: {
        'Origin': 'http://localhost:5173'
      }
    });
    
    const corsHeader = response.headers.get('access-control-allow-origin');
    
    if (corsHeader) {
      success('CORS configured correctly');
      info(`   Allowed origin: ${corsHeader}`);
      return true;
    } else {
      error('CORS not configured');
      return false;
    }
  } catch (err) {
    error(`CORS test error: ${err.message}`);
    return false;
  }
}

function testSocketIO() {
  return new Promise((resolve) => {
    info('Testing Socket.IO connection...');
    
    const socket = ioClient(BASE_URL, {
      transports: ['websocket']
    });
    
    let connected = false;
    let timeout = null;
    
    socket.on('connect', () => {
      connected = true;
      success('Socket.IO connection established');
      info(`   Socket ID: ${socket.id}`);
      
      // Test judge connection
      socket.emit('judge:connect', {
        judgeId: 'test_judge_1',
        meetId: 1,
        role: 'HEAD'
      });
      
      setTimeout(() => {
        socket.disconnect();
        resolve(true);
      }, 1000);
    });
    
    socket.on('connect_error', (err) => {
      error(`Socket.IO connection failed: ${err.message}`);
      socket.disconnect();
      resolve(false);
    });
    
    // Timeout after 5 seconds
    timeout = setTimeout(() => {
      if (!connected) {
        error('Socket.IO connection timeout');
        socket.disconnect();
        resolve(false);
      }
    }, 5000);
  });
}

async function testDatabaseConnection() {
  try {
    // Import database module
    const { getDatabase } = await import('../src/config/database-local.js');
    
    // Try to get database and execute a query
    // This will automatically connect if not already connected
    const db = getDatabase();
    
    return new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM meets', (err, row) => {
        if (err) {
          error(`Database query failed: ${err.message}`);
          resolve(false);
        } else {
          success('Database connection is active');
          success('Database query executed successfully');
          info(`   Meets in database: ${row.count}`);
          resolve(true);
        }
      });
    });
  } catch (err) {
    error(`Database test error: ${err.message}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('\n');
  log('🚀', 'STREET CONTROL - FASE 2.1 TEST SUITE', colors.yellow);
  console.log('='.repeat(50) + '\n');
  
  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };
  
  const tests = [
    { name: 'Root Endpoint', fn: testRootEndpoint },
    { name: 'Health Check', fn: testHealthEndpoint },
    { name: 'API Info', fn: testAPIInfo },
    { name: '404 Handler', fn: test404Handler },
    { name: 'CORS Configuration', fn: testCORS },
    { name: 'Database Connection', fn: testDatabaseConnection },
    { name: 'Socket.IO', fn: testSocketIO }
  ];
  
  for (const test of tests) {
    section(test.name);
    results.total++;
    
    try {
      const passed = await test.fn();
      if (passed) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (err) {
      error(`Test crashed: ${err.message}`);
      results.failed++;
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n');
  console.log('='.repeat(50));
  log('📊', 'TEST SUMMARY', colors.yellow);
  console.log('='.repeat(50));
  console.log(`Total Tests: ${results.total}`);
  console.log(`${colors.green}✅ Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${results.failed}${colors.reset}`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  console.log('='.repeat(50) + '\n');
  
  if (results.failed === 0) {
    success('🎉 ALL TESTS PASSED! Phase 2.1 is complete and working!');
  } else {
    error(`⚠️  ${results.failed} test(s) failed. Please review the errors above.`);
  }
  
  process.exit(results.failed === 0 ? 0 : 1);
}

// Run tests
runTests().catch(err => {
  error(`Test suite crashed: ${err.message}`);
  console.error(err);
  process.exit(1);
});
