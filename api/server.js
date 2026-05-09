import "dotenv/config";
import mongoose from "mongoose";
import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";
import { outboxWorker } from "./src/workers/outbox.worker.js";
import logger from "./src/config/logger.js";

await connectDB();
outboxWorker.start();

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`Servicio de pagos corriendo en el puerto ${PORT}`);
});

const shutdown = async (signal) => {
  logger.info(`${signal} recibido, cerrando servidor...`);
  outboxWorker.stop();
  server.close(async () => {
    try {
      await mongoose.disconnect();
      logger.info("Conexión a MongoDB cerrada");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error al cerrar MongoDB");
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error("Timeout de shutdown alcanzado, forzando salida");
    process.exit(1);
  }, 30_000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
