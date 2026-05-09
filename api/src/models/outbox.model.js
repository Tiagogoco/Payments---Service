import mongoose from "mongoose";

const outboxSchema = new mongoose.Schema(
  {
    eventType: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["pending", "published", "failed"],
      default: "pending",
    },
    attempts: { type: Number, default: 0 },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

outboxSchema.index({ status: 1, createdAt: 1 });

const Outbox = mongoose.model("Outbox", outboxSchema);

export default Outbox;
