import mongoose from "mongoose";
import express from "express";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { authenticate } from "./middleware/auth.js";
import paymentRoutes from "./routes/payment.routes.js";
import logger from "./config/logger.js";

const app = express();

app.use(express.json());

app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));

const readLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "TooManyRequests", message: "Rate limit exceeded, try again later" },
});

const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "TooManyRequests", message: "Rate limit exceeded, try again later" },
});

app.get("/health", (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  return res.status(ready ? 200 : 503).json({ status: ready ? "ok" : "unavailable" });
});

app.use("/api", authenticate);
app.use("/api/payments", readLimiter);
app.post("/api/payments", writeLimiter);
app.post("/api/payments/external", writeLimiter);
app.use("/api", paymentRoutes);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error({ err, reqId: req.id }, "Unhandled error");
  res.status(500).json({ error: "InternalServerError", message: "An unexpected error occurred" });
});

export default app;
