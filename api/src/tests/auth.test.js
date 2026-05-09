import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { startDb, stopDb, validToken } from "./setup.js";

beforeAll(startDb);
afterAll(stopDb);

describe("Middleware de autenticación JWT", () => {
  it("401 sin header Authorization", async () => {
    const res = await request(app).get("/api/payments/000000000000000000000001");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("401 con token malformado", async () => {
    const res = await request(app)
      .get("/api/payments/000000000000000000000001")
      .set("Authorization", "Bearer token_invalido");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("401 con esquema incorrecto (sin Bearer)", async () => {
    const res = await request(app)
      .get("/api/payments/000000000000000000000001")
      .set("Authorization", validToken);
    expect(res.status).toBe(401);
  });

  it("pasa con token válido", async () => {
    const res = await request(app)
      .get("/api/payments/000000000000000000000001")
      .set("Authorization", `Bearer ${validToken}`);
    // 404 porque el ID no existe, pero pasó autenticación
    expect(res.status).toBe(404);
  });
});
