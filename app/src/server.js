const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const logger = require("./utils/logger");
const taskRouter = require("./routes/tasks");
const healthRouter = require("./routes/health");
const { errorHandler, notFound } = require("./middleware/errorHandler");

const app = express();

// ── Security headers ───────────────────────────────────────────
app.use(helmet());
app.disable("x-powered-by");

// ── CORS ───────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000"];

app.use(cors({
  origin: process.env.NODE_ENV === "production" ? allowedOrigins : "*",
  methods: ["GET", "POST", "PATCH", "DELETE"],
}));

// ── Compression & Body Parsing ─────────────────────────────────
app.use(compression());
app.use(express.json({ limit: "10kb" })); // Prevent large payload attacks

// ── Rate Limiting ──────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many requests, please try again later.", status: 429 } },
});
app.use("/api", limiter);

// ── HTTP Request Logging ───────────────────────────────────────
app.use(morgan("combined", {
  stream: { write: (msg) => logger.http(msg.trim()) },
  skip: (req) => req.path === "/health", // Don't log health probes
}));

// ── Static Frontend ────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../public")));

// ── API Routes ─────────────────────────────────────────────────
app.use("/health", healthRouter);
app.use("/api/tasks", taskRouter);

app.get("/api", (req, res) => {
  res.json({
    name: "production-ready-devops",
    version: process.env.APP_VERSION || "unknown",
    docs: "/api",
    endpoints: {
      health: { liveness: "/health", readiness: "/health/ready", metrics: "/health/metrics" },
      tasks: { list: "GET /api/tasks", get: "GET /api/tasks/:id", create: "POST /api/tasks", update: "PATCH /api/tasks/:id", delete: "DELETE /api/tasks/:id" },
    },
  });
});

// ── Error Handling (must be last) ──────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
