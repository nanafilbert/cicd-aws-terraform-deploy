const VALID_STATUSES = ["todo", "in-progress", "done"];
const VALID_PRIORITIES = ["low", "medium", "high"];

const validateTask = (req, res, next) => {
  const { title, status, priority } = req.body;
  const errors = [];

  if (req.method === "POST") {
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      errors.push("title is required and must be a non-empty string");
    }
    if (title && title.length > 200) {
      errors.push("title must be 200 characters or fewer");
    }
  }

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
    errors.push(`priority must be one of: ${VALID_PRIORITIES.join(", ")}`);
  }

  if (errors.length > 0) {
    return res.status(422).json({ error: { message: "Validation failed", details: errors, status: 422 } });
  }

  next();
};

module.exports = { validateTask };
