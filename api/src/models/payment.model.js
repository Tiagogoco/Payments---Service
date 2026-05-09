import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    currency: {
      type: String,
      required: true,
      default: "MXN",
    },

    method: {
      type: String,
      enum: ["card", "cash", "paypal"],
      required: true,
    },

    status: {
      type: String,
      enum: ["created", "approved", "declined", "failed"],
      default: "created",
    },

    provider: {
      type: String,
      enum: ["internal", "paypal"],
      default: "internal",
    },

    providerReference: {
      type: String,
    },

    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },

    message: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

paymentSchema.index({ orderId: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
