export const validateOrder = async (req, res, next) => {
  const orderId = req.body?.orderId;

  if (!orderId) return next();

  const ordersUrl = process.env.ORDERS_SERVICE_URL;

  if (!ordersUrl) {
    // Sin URL configurada se aplica validación local básica
    if (!orderId.startsWith("ord_")) {
      return res.status(404).json({ error: "NotFound", message: "orderId does not exist" });
    }
    return next();
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${ordersUrl}/api/orders/${encodeURIComponent(orderId)}`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.status === 404) {
      return res.status(404).json({ error: "NotFound", message: "orderId does not exist" });
    }

    if (!response.ok) {
      return res.status(503).json({ error: "ServiceUnavailable", message: "Orders service error" });
    }

    next();
  } catch (err) {
    const isTimeout = err.name === "AbortError";
    return res.status(503).json({
      error: "ServiceUnavailable",
      message: isTimeout ? "Orders service timed out" : "Unable to reach Orders service",
    });
  }
};
