import Redis from "ioredis";
import Outbox from "../models/outbox.model.js";
import logger from "../config/logger.js";

const POLL_INTERVAL_MS = 5_000;
const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 50;

class OutboxWorker {
  #timer = null;
  #redis = null;

  start() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      logger.warn("REDIS_URL no configurado — outbox worker deshabilitado");
      return;
    }

    this.#redis = new Redis(redisUrl, { lazyConnect: true, enableOfflineQueue: false });
    this.#redis.on("error", (err) => logger.error({ err }, "Redis error en outbox worker"));

    logger.info("Outbox worker iniciado");
    this.#poll();
  }

  stop() {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    if (this.#redis) {
      this.#redis.disconnect();
      this.#redis = null;
    }
    logger.info("Outbox worker detenido");
  }

  async #poll() {
    try {
      await this.#processBatch();
    } catch (err) {
      logger.error({ err }, "Error en ciclo de outbox worker");
    }
    this.#timer = setTimeout(() => this.#poll(), POLL_INTERVAL_MS);
  }

  async #processBatch() {
    const events = await Outbox.find({ status: "pending", attempts: { $lt: MAX_ATTEMPTS } })
      .sort({ createdAt: 1 })
      .limit(BATCH_SIZE)
      .lean();

    if (events.length === 0) return;

    logger.info(`Outbox: procesando ${events.length} evento(s)`);

    await Promise.allSettled(events.map((event) => this.#publish(event)));
  }

  async #publish(event) {
    try {
      await this.#redis.lpush("payments:events", JSON.stringify({ eventType: event.eventType, payload: event.payload }));

      await Outbox.findByIdAndUpdate(event._id, {
        status: "published",
        publishedAt: new Date(),
        $inc: { attempts: 1 },
      });

      logger.info({ eventType: event.eventType, eventId: event._id }, "Evento publicado");
    } catch (err) {
      const nextAttempts = (event.attempts ?? 0) + 1;
      await Outbox.findByIdAndUpdate(event._id, {
        status: nextAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
        $inc: { attempts: 1 },
      });
      logger.error({ err, eventId: event._id }, "Error publicando evento");
    }
  }
}

export const outboxWorker = new OutboxWorker();
