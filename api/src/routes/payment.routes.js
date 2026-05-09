import { Router } from "express";
import { createExternalPayment, createPayment, getPaymentById } from "../controllers/payment.controller.js";
import { validateOrder } from "../middleware/validateOrder.js";
import { validate } from "../middleware/validate.js";
import { createPaymentSchema, createExternalPaymentSchema } from "../schemas/payment.schemas.js";

const router = Router();

router.post("/payments", validate(createPaymentSchema), validateOrder, createPayment);
router.post("/payments/external", validate(createExternalPaymentSchema), validateOrder, createExternalPayment);
router.get("/payments/:paymentId", getPaymentById);

export default router;
