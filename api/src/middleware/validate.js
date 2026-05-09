export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const first = result.error.issues[0];
    const field = first.path.join(".");
    const message = field ? `${field}: ${first.message}` : first.message;
    return res.status(400).json({ error: "BadRequest", message });
  }
  req.body = result.data;
  next();
};
