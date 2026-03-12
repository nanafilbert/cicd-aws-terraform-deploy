const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { validateTask } = require("../middleware/validator");
const logger = require("../utils/logger");

const router = express.Router();

// In-memory store (would be a DB in a real production system)
let tasks = [
  { id: uuidv4(), title: "Containerise app with Docker", status: "done", priority: "high", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: uuidv4(), title: "Write CI/CD pipeline", status: "in-progress", priority: "high", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: uuidv4(), title: "Provision AWS infra with Terraform", status: "todo", priority: "medium", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: uuidv4(), title: "Set up Prometheus + Grafana monitoring", status: "todo", priority: "medium", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: uuidv4(), title: "Configure centralised logging (ELK)", status: "todo", priority: "low", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

/**
 * GET /api/tasks
 * List all tasks with optional ?status= and ?priority= filters
 */
router.get("/", (req, res) => {
  const { status, priority, sort = "createdAt" } = req.query;
  let result = [...tasks];

  if (status) result = result.filter((t) => t.status === status);
  if (priority) result = result.filter((t) => t.priority === priority);

  // Simple sort support
  if (["createdAt", "updatedAt", "title"].includes(sort)) {
    result.sort((a, b) => (a[sort] > b[sort] ? -1 : 1));
  }

  logger.info("Tasks listed", { count: result.length, filters: { status, priority } });
  res.json({ data: result, meta: { total: result.length, filters: { status, priority } } });
});

/**
 * GET /api/tasks/:id
 */
router.get("/:id", (req, res) => {
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: { message: "Task not found", status: 404 } });
  res.json({ data: task });
});

/**
 * POST /api/tasks
 */
router.post("/", validateTask, (req, res) => {
  const { title, priority = "medium" } = req.body;
  const task = {
    id: uuidv4(),
    title: title.trim(),
    status: "todo",
    priority,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  tasks.push(task);
  logger.info("Task created", { id: task.id, title: task.title });
  res.status(201).json({ data: task });
});

/**
 * PATCH /api/tasks/:id
 */
router.patch("/:id", validateTask, (req, res) => {
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: { message: "Task not found", status: 404 } });

  const allowedFields = ["title", "status", "priority"];
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) task[field] = req.body[field];
  });
  task.updatedAt = new Date().toISOString();

  logger.info("Task updated", { id: task.id, changes: req.body });
  res.json({ data: task });
});

/**
 * DELETE /api/tasks/:id
 */
router.delete("/:id", (req, res) => {
  const index = tasks.findIndex((t) => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: { message: "Task not found", status: 404 } });
  const [removed] = tasks.splice(index, 1);
  logger.info("Task deleted", { id: removed.id });
  res.status(200).json({ data: { message: "Task deleted successfully", id: removed.id } });
});

// Expose store reset for testing
router._resetTasks = () => { tasks = []; };

module.exports = router;
