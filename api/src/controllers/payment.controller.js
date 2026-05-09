import mongoose from "mongoose";
import Payment from "../models/payment.model.js";
import Outbox from "../models/outbox.model.js";

const ALLOWED_INTERNAL = new Set(["card", "cash"]);

const toPaymentResponse = (payment) => ({
  id: String(payment._id),
  orderId: payment.orderId,
  amount: payment.amount,
  currency: payment.currency,
  method: payment.method,
  status: payment.status,
  provider: payment.provider,
  providerReference: payment.providerReference ?? null,
  idempotencyKey: payment.idempotencyKey,
  message: payment.message ?? null,
  createdAt: payment.createdAt,
});

const upsertWithOutbox = async (filter, doc, eventType) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await Payment.findOneAndUpdate(
        filter,
        { $setOnInsert: doc },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, includeResultMetadata: true, session }
      );

      if (!result.lastErrorObject.updatedExisting) {
        await Outbox.create([{ eventType, payload: toPaymentResponse(result.value) }], { session });
      }
    });
    return result;
  } finally {
    await session.endSession();
  }
};

export const createPayment = async (req, res) => {
  const idempotencyKey = req.get("Idempotency-Key");
  if (!idempotencyKey) {
    return res.status(400).json({ error: "BadRequest", message: "Idempotency-Key header is required" });
  }

  const { orderId, amount, method, currency } = req.body;

  if (!ALLOWED_INTERNAL.has(method)) {
    return res.status(400).json({ error: "BadRequest", message: "method is not allowed for internal payments" });
  }

  const result = await upsertWithOutbox(
    { idempotencyKey },
    {
      orderId,
      amount,
      method,
      currency: currency.toUpperCase(),
      status: "approved",
      provider: "internal",
      providerReference: null,
      idempotencyKey,
      message: "Payment approved",
    },
    "payment.created"
  );

  const isNew = !result.lastErrorObject.updatedExisting;
  return res.status(isNew ? 201 : 200).json(toPaymentResponse(result.value));
};

export const createExternalPayment = async (req, res) => {
  const idempotencyKey = req.get("Idempotency-Key");
  if (!idempotencyKey) {
    return res.status(400).json({ error: "BadRequest", message: "Idempotency-Key header is required" });
  }

  const { orderId, amount, method, currency, provider } = req.body;

  const result = await upsertWithOutbox(
    { idempotencyKey },
    {
      orderId,
      amount,
      method,
      currency: currency.toUpperCase(),
      status: "approved",
      provider,
      providerReference: `PAYPAL-${Date.now()}`,
      idempotencyKey,
      message: "Approved by PayPal",
    },
    "payment.created"
  );

  const isNew = !result.lastErrorObject.updatedExisting;
  return res.status(isNew ? 201 : 200).json(toPaymentResponse(result.value));
};

export const getPaymentById = async (req, res) => {
  const { paymentId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(paymentId)) {
    return res.status(404).json({ error: "NotFound", message: "paymentId does not exist" });
  }

  const payment = await Payment.findById(paymentId).lean();

  if (!payment) {
    return res.status(404).json({ error: "NotFound", message: "paymentId does not exist" });
  }

  return res.status(200).json(toPaymentResponse(payment));
};
