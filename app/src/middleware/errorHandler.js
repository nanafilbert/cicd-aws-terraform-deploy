const logger = require("../utils/logger");

/**
 * Centralised error-handling middleware.
 * All errors thrown in route handlers land here.
 */
const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  logger.error("Unhandled error", {
    status,
    message,
    path: req.path,
    method: req.method,
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
  });

  res.status(status).json({
    error: {
      message,
      status,
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    },
  });
};

/**
 * 404 handler — must come after all routes.
 */
const notFound = (req, res) => {
  res.status(404).json({
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      status: 404,
    },
  });
};

module.exports = { errorHandler, notFound };
