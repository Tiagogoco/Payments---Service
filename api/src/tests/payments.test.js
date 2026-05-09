import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { paymentResponseSchema } from "../../src/schemas/payment.schemas.js";
import { startDb, stopDb, clearDb, authHeader } from "./setup.js";

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const basePayload = {
  orderId: "ord_123",
  amount: 100,
  currency: "MXN",
  method: "card",
};

const idempotencyKey = () => `idem_key-${Date.now()}-${Math.random()}`;

// ---------------------------------------------------------------------------
// POST /api/payments
// ---------------------------------------------------------------------------
describe("POST /api/payments", () => {
  it("400 sin Idempotency-Key", async () => {
    const res = await request(app)
      .post("/api/payments")
      .set(authHeader)
      .send(basePayload);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("BadRequest");
  });

  it("400 sin orderId", async () => {
    const res = await request(app)
      .post("/api/payments")
      .set({ ...authHeader, "Idempotency-Key": idempotencyKey() })
      .send({ ...basePayload, orderId: undefined });
    expect(res.status).toBe(400);
  });

  it("404 orderId sin prefijo ord_", async () => {
    const res = await request(app)
      .post("/api/payments")
      .set({ ...authHeader, "Idempotency-Key": idempotencyKey() })
      .send({ ...basePayload, orderId: "invalid_order" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("NotFound");
  });

  it("400 amount <= 0", async () => {
    const res = await request(app)
      .post("/api/payments")
      .set({ ...authHeader, "Idempotency-Key": idempotencyKey() })
      .send({ ...basePayload, amount: -5 });
    expect(res.status).toBe(400);
  });

  it("400 currency inválida (no 3 letras)", async () => {
    const res = await request(app)
      .post("/api/payments")
      .set({ ...authHeader, "Idempotency-Key": idempotencyKey() })
      .send({ ...basePayload, currency: "PESO" });
    expect(res.status).toBe(400);
  });

  it("400 method no permitido (paypal en ruta interna)", async () => {
    const res = await request(app)
      .post("/api/payments")
      .set({ ...authHeader, "Idempotency-Key": idempotencyKey() })
      .send({ ...basePayload, method: "paypal" });
    expect(res.status).toBe(400);
  });

  it("400 rechaza campos extra (additionalProperties: false)", async () => {
    const res = await request(app)
      .post("/api/payments")
      .set({ ...authHeader, "Idempotency-Key": idempotencyKey() })
      .send({ ...basePayload, campoExtra: "no-permitido" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("BadRequest");
  });

  it("201 crea pago nuevo con respuesta conforme al contrato", async () => {
    const res = await request(app)
      .post("/api/payments")
      .set({ ...authHeader, "Idempotency-Key": idempotencyKey() })
      .send(basePayload);
    expect(res.status).toBe(201);
    expect(paymentResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.status).toBe("approved");
    expect(res.body.provider).toBe("internal");
  });

  it("200 retorna pago existente (idempotencia)", async () => {
    const key = idempotencyKey();
    const first = await request(app)
      .post("/api/payments")
      .set({ ...authHeader, "Idempotency-Key": key })
      .send(basePayload);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/payments")
      .set({ ...authHeader, "Idempotency-Key": key })
      .send(basePayload);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
  });

  it("idempotencia bajo concurrencia — mismo id, un solo 201", async () => {
    const key = idempotencyKey();
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post("/api/payments")
          .set({ ...authHeader, "Idempotency-Key": key })
          .send(basePayload)
      )
    );
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 200)).toHaveLength(4);
    const ids = new Set(responses.map((r) => r.body.id));
    expect(ids.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/payments/external
// ---------------------------------------------------------------------------
describe("POST /api/payments/external", () => {
  const externalPayload = {
    orderId: "ord_456",
    amount: 200,
    currency: "USD",
    method: "paypal",
    provider: "paypal",
  };

  it("400 method no permitido (card en ruta externa)", async () => {
    const res = await request(app)
      .post("/api/payments/external")
      .set({ ...authHeader, "Idempotency-Key": idempotencyKey() })
      .send({ ...externalPayload, method: "card", provider: "paypal" });
    expect(res.status).toBe(400);
  });

  it("400 rechaza campos extra (additionalProperties: false)", async () => {
    const res = await request(app)
      .post("/api/payments/external")
      .set({ ...authHeader, "Idempotency-Key": idempotencyKey() })
      .send({ ...externalPayload, campoExtra: "no-permitido" });
    expect(res.status).toBe(400);
  });

  it("201 crea pago PayPal con respuesta conforme al contrato", async () => {
    const res = await request(app)
      .post("/api/payments/external")
      .set({ ...authHeader, "Idempotency-Key": idempotencyKey() })
      .send(externalPayload);
    expect(res.status).toBe(201);
    expect(paymentResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.provider).toBe("paypal");
    expect(res.body.providerReference).toMatch(/^PAYPAL-/);
  });

  it("200 retorna pago existente (idempotencia)", async () => {
    const key = idempotencyKey();
    const first = await request(app)
      .post("/api/payments/external")
      .set({ ...authHeader, "Idempotency-Key": key })
      .send(externalPayload);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/payments/external")
      .set({ ...authHeader, "Idempotency-Key": key })
      .send(externalPayload);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
  });

  it("idempotencia bajo concurrencia — mismo id, un solo 201", async () => {
    const key = idempotencyKey();
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post("/api/payments/external")
          .set({ ...authHeader, "Idempotency-Key": key })
          .send(externalPayload)
      )
    );
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 200)).toHaveLength(4);
    const ids = new Set(responses.map((r) => r.body.id));
    expect(ids.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/payments/:paymentId
// ---------------------------------------------------------------------------
describe("GET /api/payments/:paymentId", () => {
  it("404 con ObjectId inexistente", async () => {
    const res = await request(app)
      .get("/api/payments/000000000000000000000001")
      .set(authHeader);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("NotFound");
  });

  it("404 con ID con formato inválido", async () => {
    const res = await request(app)
      .get("/api/payments/no-es-un-id")
      .set(authHeader);
    expect(res.status).toBe(404);
  });

  it("200 retorna el pago con respuesta conforme al contrato", async () => {
    const createRes = await request(app)
      .post("/api/payments")
      .set({ ...authHeader, "Idempotency-Key": idempotencyKey() })
      .send(basePayload);
    expect(createRes.status).toBe(201);

    const getRes = await request(app)
      .get(`/api/payments/${createRes.body.id}`)
      .set(authHeader);
    expect(getRes.status).toBe(200);
    expect(paymentResponseSchema.safeParse(getRes.body).success).toBe(true);
    expect(getRes.body.id).toBe(createRes.body.id);
  });
});
