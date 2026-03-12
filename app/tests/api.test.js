const request = require("supertest");
const app = require("../src/server");
const taskRouter = require("../src/routes/tasks");

// Reset task store before each test for isolation
beforeEach(() => taskRouter._resetTasks());

// ── Health Endpoints ───────────────────────────────────────────
describe("Health", () => {
  test("GET /health → 200 with healthy status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("version");
  });

  test("GET /health/ready → 200", async () => {
    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
  });

  test("GET /health/metrics → 200 with system stats", async () => {
    const res = await request(app).get("/health/metrics");
    expect(res.status).toBe(200);
    expect(res.body.process).toHaveProperty("memoryMB");
    expect(res.body.system).toHaveProperty("cpus");
  });
});

// ── API Info ───────────────────────────────────────────────────
describe("API Info", () => {
  test("GET /api → returns endpoint manifest", async () => {
    const res = await request(app).get("/api");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("endpoints");
  });
});

// ── Tasks — Read ───────────────────────────────────────────────
describe("Tasks — Read", () => {
  test("GET /api/tasks → returns empty list after reset", async () => {
    const res = await request(app).get("/api/tasks");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.total).toBe(0);
  });

  test("GET /api/tasks/:id → 404 for unknown id", async () => {
    const res = await request(app).get("/api/tasks/nonexistent-id");
    expect(res.status).toBe(404);
    expect(res.body.error.status).toBe(404);
  });

  test("GET /api/tasks → filters by status", async () => {
    await request(app).post("/api/tasks").send({ title: "Task A", priority: "high" });
    const created = await request(app).post("/api/tasks").send({ title: "Task B" });
    await request(app).patch(`/api/tasks/${created.body.data.id}`).send({ status: "done" });

    const res = await request(app).get("/api/tasks?status=done");
    expect(res.body.data.every((t) => t.status === "done")).toBe(true);
  });

  test("GET /api/tasks → filters by priority", async () => {
    await request(app).post("/api/tasks").send({ title: "High", priority: "high" });
    await request(app).post("/api/tasks").send({ title: "Low", priority: "low" });

    const res = await request(app).get("/api/tasks?priority=high");
    expect(res.body.data.every((t) => t.priority === "high")).toBe(true);
  });
});

// ── Tasks — Create ─────────────────────────────────────────────
describe("Tasks — Create", () => {
  test("POST /api/tasks → 201 with valid payload", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .send({ title: "Set up Docker", priority: "high" });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("Set up Docker");
    expect(res.body.data.status).toBe("todo");
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data).toHaveProperty("createdAt");
  });

  test("POST /api/tasks → 422 without title", async () => {
    const res = await request(app).post("/api/tasks").send({ priority: "high" });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toContain("title is required and must be a non-empty string");
  });

  test("POST /api/tasks → 422 with invalid priority", async () => {
    const res = await request(app).post("/api/tasks").send({ title: "Test", priority: "critical" });
    expect(res.status).toBe(422);
  });

  test("POST /api/tasks → 422 with title exceeding 200 chars", async () => {
    const res = await request(app).post("/api/tasks").send({ title: "x".repeat(201) });
    expect(res.status).toBe(422);
  });

  test("POST /api/tasks → default priority is medium", async () => {
    const res = await request(app).post("/api/tasks").send({ title: "No priority" });
    expect(res.body.data.priority).toBe("medium");
  });
});

// ── Tasks — Update ─────────────────────────────────────────────
describe("Tasks — Update", () => {
  test("PATCH /api/tasks/:id → 200 updates status", async () => {
    const create = await request(app).post("/api/tasks").send({ title: "Patch me" });
    const id = create.body.data.id;

    const res = await request(app).patch(`/api/tasks/${id}`).send({ status: "in-progress" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("in-progress");
    expect(res.body.data.updatedAt).toBeDefined();
  });

  test("PATCH /api/tasks/:id → 404 for unknown id", async () => {
    const res = await request(app).patch("/api/tasks/bad-id").send({ status: "done" });
    expect(res.status).toBe(404);
  });

  test("PATCH /api/tasks/:id → 422 with invalid status", async () => {
    const create = await request(app).post("/api/tasks").send({ title: "Test" });
    const res = await request(app)
      .patch(`/api/tasks/${create.body.data.id}`)
      .send({ status: "invalid" });
    expect(res.status).toBe(422);
  });
});

// ── Tasks — Delete ─────────────────────────────────────────────
describe("Tasks — Delete", () => {
  test("DELETE /api/tasks/:id → 200 removes task", async () => {
    const create = await request(app).post("/api/tasks").send({ title: "Delete me" });
    const id = create.body.data.id;

    const del = await request(app).delete(`/api/tasks/${id}`);
    expect(del.status).toBe(200);

    const get = await request(app).get(`/api/tasks/${id}`);
    expect(get.status).toBe(404);
  });

  test("DELETE /api/tasks/:id → 404 for unknown id", async () => {
    const res = await request(app).delete("/api/tasks/bad-id");
    expect(res.status).toBe(404);
  });
});

// ── Error Handling ─────────────────────────────────────────────
describe("Error Handling", () => {
  test("Unknown route → 404 with structured error", async () => {
    const res = await request(app).get("/api/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body.error).toHaveProperty("message");
  });
});
