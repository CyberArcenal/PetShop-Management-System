/**
 * Sends a standardized JSON response from an Express route.
 * @param {import('express').Response} res - Express response object
 * @param {number} statusCode - HTTP status code (e.g., 200, 400, 500)
 * @param {any} [data=null] - Data payload (optional)
 * @param {string} [message=''] - Optional success/error message
 * @param {string} [error=null] - Optional error details (only for failures)
 * @returns {import('express').Response}
 */
function sendResponse(res, statusCode, data = null, message = '', error = null) {
  const success = statusCode >= 200 && statusCode < 300;
  const response = {
    success,
    message: message || (success ? 'Operation successful' : 'Operation failed'),
  };
  if (data !== null) response.data = data;
  if (error !== null && !success) response.error = error;
  return res.status(statusCode).json(response);
}

module.exports = { sendResponse };