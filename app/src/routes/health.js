const express = require("express");
const os = require("os");
const client = require("prom-client");

const router = express.Router();

// Collect default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ prefix: "app_" });

// Custom HTTP request counter
const httpRequestCounter = new client.Counter({
  name: "app_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"],
});

/**
 * GET /health
 * Liveness probe
 */
router.get("/", (req, res) => {
  const uptime = process.uptime();
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime,
    version: process.env.APP_VERSION || "unknown",
  });
});

/**
 * GET /health/ready
 * Readiness probe
 */
router.get("/ready", (req, res) => {
  res.json({
    status: "ready",
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/metrics
 * System + Prometheus metrics
 */
router.get("/metrics", async (req, res) => {
  const accept = req.headers["accept"] || "";

  // If client wants Prometheus format
  if (accept.includes("text/plain") || accept.includes("application/openmetrics-text")) {
    res.set("Content-Type", client.register.contentType);
    return res.send(await client.register.metrics());
  }

  // Default: return JSON system stats (keeps tests passing)
  res.json({
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      uptimeMs: Math.floor(process.uptime() * 1000),
      memoryMB: {
        rss: (process.memoryUsage().rss / 1024 / 1024).toFixed(2),
        heapUsed: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
        heapTotal: (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2),
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
module.exports.httpRequestCounter = httpRequestCounter;