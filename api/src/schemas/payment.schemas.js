import { z } from "zod";

// Idempotency-Key header — minLength: 8, maxLength: 128
export const idempotencyKeySchema = z.string().min(8).max(128);

// POST /api/payments — CreatePaymentRequest
export const createPaymentSchema = z
  .object({
    orderId: z.string().min(1),
    amount: z.number().positive(),
    currency: z.string().length(3),
    method: z.enum(["card", "cash", "paypal"]),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict(); // additionalProperties: false

// POST /api/payments/external — CreateExternalPaymentRequest
export const createExternalPaymentSchema = z
  .object({
    orderId: z.string().min(1),
    amount: z.number().positive(),
    currency: z.string().length(3),
    method: z.enum(["paypal"]),
    provider: z.enum(["paypal"]),
    payer: z
      .object({ email: z.string().email() })
      .strict()
      .optional(),
  })
  .strict(); // additionalProperties: false

// Respuesta Payment — para validación en tests
export const paymentResponseSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  amount: z.number(),
  currency: z.string().length(3),
  method: z.enum(["card", "cash", "paypal"]),
  status: z.enum(["created", "approved", "declined", "failed"]),
  provider: z.enum(["internal", "paypal"]),
  providerReference: z.string().nullable(),
  idempotencyKey: z.string(),
  message: z.string().nullable(),
  createdAt: z.string(),
});
