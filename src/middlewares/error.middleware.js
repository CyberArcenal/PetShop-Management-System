/**
 * Global error handler for Express.
 * Place this AFTER all routes.
 */
function errorHandler(err, req, res, next) {
  console.error('Global error:', err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = { errorHandler };