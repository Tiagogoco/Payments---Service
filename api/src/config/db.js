import { connect } from "mongoose";
import logger from "./logger.js";

export const connectDB = async () => {
  try {
    await connect(process.env.MONGO_URI, { maxPoolSize: 50 });
    logger.info("Conexión a MongoDB establecida");
  } catch (error) {
    logger.error({ err: error }, "Error al conectar a MongoDB");
    process.exit(1);
  }
};
