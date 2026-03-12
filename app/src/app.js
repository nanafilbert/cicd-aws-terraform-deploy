const app = require("./server");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  logger.info(`Server started`, {
    port: PORT,
    host: HOST,
    environment: process.env.NODE_ENV || "development",
    version: process.env.APP_VERSION || "unknown",
    pid: process.pid,
  });
});

// ── Graceful Shutdown ──────────────────────────────────────────
// Gives in-flight requests time to complete before the process exits.
// Critical for zero-downtime deployments with Docker / K8s.

const shutdown = (signal) => {
  logger.info(`${signal} received — starting graceful shutdown`);

  server.close(() => {
    logger.info("HTTP server closed — all connections drained");
    process.exit(0);
  });

  // Force exit after 10s if connections don't drain
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => shutdown("SIGTERM")); // Docker stop / K8s pod termination
process.on("SIGINT", () => shutdown("SIGINT"));   // Ctrl+C

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { message: err.message, stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason });
  process.exit(1);
});

module.exports = server;
