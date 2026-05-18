import { connect } from "mongoose";
import logger from "./logger.js";

export const connectDB = async () => {
  try {
    await connect(process.env.MONGO_URI, {
      maxPoolSize: 50,
      serverSelectionTimeoutMS: 8_000,
      connectTimeoutMS: 8_000,
    });
    logger.info("Conexión a MongoDB establecida");
  } catch (error) {
    logger.error({ err: error }, "Error al conectar a MongoDB — verifica que el cluster de Atlas esté activo y que tu IP esté en la lista blanca");
    process.exit(1);
  }
};
