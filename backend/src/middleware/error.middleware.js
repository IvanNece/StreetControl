/**
 * Error Handling Middleware
 * 
 * Catches and formats errors for consistent API responses
 */

/**
 * 404 Not Found handler
 * Catches all unmatched routes
 */
export function notFoundHandler(req, res, next) {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

/**
 * Global error handler
 * Formats all errors into consistent JSON responses
 */
export function errorHandler(err, req, res, next) {
  // Log error for debugging
  console.error('❌ Error:', err.message);
  
  if (process.env.NODE_ENV === 'development') {
    console.error('Stack trace:', err.stack);
  }

  // Determine status code
  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  
  // Set status code
  res.status(statusCode);
  
  // Send error response
  res.json({
    success: false,
    error: {
      message: err.message,
      statusCode,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
}

export default { notFoundHandler, errorHandler };
