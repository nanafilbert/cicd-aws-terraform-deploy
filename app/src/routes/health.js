const client = require('prom-client');

// Collect default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ prefix: 'app_' });

// Custom HTTP request counter
const httpRequestCounter = new client.Counter({
  name: 'app_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

// Expose to app for middleware use
module.exports.httpRequestCounter = httpRequestCounter;

// Replace the existing /metrics route with:
router.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.send(await client.register.metrics());
});