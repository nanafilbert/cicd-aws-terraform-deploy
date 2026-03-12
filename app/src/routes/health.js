const express = require("express");
const os = require("os");
const router = express.Router();

const startTime = Date.now();

/**
 * GET /health
 * Liveness probe — used by Docker HEALTHCHECK, K8s, and load balancers.
 */
router.get("/", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: process.env.APP_VERSION || "unknown",
    environment: process.env.NODE_ENV || "development",
  });
});

/**
 * GET /health/ready
 * Readiness probe — indicates the app is ready to receive traffic.
 * Extend this to check DB connections, cache, etc. in a real system.
 */
router.get("/ready", (req, res) => {
  res.status(200).json({ status: "ready", timestamp: new Date().toISOString() });
});

/**
 * GET /health/metrics
 * Basic system metrics — in production you'd use Prometheus /metrics endpoint.
 */
router.get("/metrics", (req, res) => {
  const memUsage = process.memoryUsage();
  res.status(200).json({
    process: {
      pid: process.pid,
      uptime: Math.floor(process.uptime()),
      uptimeMs: Date.now() - startTime,
      memoryMB: {
        rss: (memUsage.rss / 1024 / 1024).toFixed(2),
        heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
        heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
      },
      nodeVersion: process.version,
    },
    system: {
      platform: os.platform(),
      arch: os.arch(),
      loadAvg: os.loadavg(),
      totalMemoryMB: (os.totalmem() / 1024 / 1024).toFixed(2),
      freeMemoryMB: (os.freemem() / 1024 / 1024).toFixed(2),
      cpus: os.cpus().length,
    },
  });
});

module.exports = router;
