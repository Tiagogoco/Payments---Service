import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

let replSet;

export const JWT_SECRET = "test_secret";
export const validToken = jwt.sign({ sub: "user_1", role: "service" }, JWT_SECRET);
export const authHeader = { Authorization: `Bearer ${validToken}` };

export async function startDb() {
  process.env.JWT_SECRET = JWT_SECRET;
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
}

export async function stopDb() {
  await mongoose.disconnect();
  await replSet.stop();
}

export async function clearDb() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
