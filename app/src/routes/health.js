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

module.exports.httpRequestCounter = httpRequestCounter;

/**
 * GET /health
 * Liveness probe
 */
router.get("/", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
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
 * Prometheus metrics endpoint
 */
router.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.send(await client.register.metrics());
});

module.exports = router;
module.exports.httpRequestCounter = httpRequestCounter;