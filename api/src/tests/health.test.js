import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { startDb, stopDb } from "./setup.js";

beforeAll(startDb);
afterAll(stopDb);

describe("GET /health", () => {
  it("devuelve 200 cuando la DB está conectada", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
