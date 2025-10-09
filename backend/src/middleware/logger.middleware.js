/**
 * Logger Middleware
 * 
 * HTTP request logging with Morgan
 */

import morgan from 'morgan';

// Define custom tokens
morgan.token('emoji', (req) => {
  const method = req.method;
  const emojiMap = {
    'GET': '📥',
    'POST': '📤',
    'PUT': '✏️',
    'DELETE': '🗑️',
    'PATCH': '🔧'
  };
  return emojiMap[method] || '📡';
});

// Custom format with emojis
const customFormat = ':emoji :method :url :status :response-time ms - :res[content-length]';

// Morgan middleware with color-coded output
export const httpLogger = morgan(customFormat, {
  skip: (req, res) => {
    // Skip logging for health check endpoint in production
    return process.env.NODE_ENV === 'production' && req.url === '/health';
  }
});

export default httpLogger;
