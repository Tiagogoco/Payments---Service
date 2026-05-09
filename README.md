# Payments Service

Microservicio REST de pagos para la plataforma ShopScale. Gestiona pagos internos (tarjeta y efectivo) y externos (PayPal), con idempotencia, autenticación JWT y publicación de eventos.

---

## Base URL

| Entorno | URL |
|---|---|
| Desarrollo | `http://localhost:3011` |
| Docker / Producción | `http://localhost:3000` |

---

## Autenticación

Todos los endpoints bajo `/api` requieren un token JWT en el header:

```
Authorization: Bearer <token>
```

El token se verifica con la clave `JWT_SECRET` configurada en el servicio. Si falta o es inválido, el servicio responde con `401`.

---

## Idempotencia

Los endpoints `POST` requieren el header `Idempotency-Key` (entre 8 y 128 caracteres). Si se repite la misma clave, el servicio devuelve el pago original sin crear uno nuevo.

```
Idempotency-Key: <uuid-u-string-único>
```

| Escenario | Respuesta |
|---|---|
| Primera solicitud | `201 Created` |
| Solicitud repetida con misma clave | `200 OK` (mismo cuerpo) |

---

## Rate Limits

| Tipo | Límite |
|---|---|
| Escritura (`POST`) | 30 req / minuto |
| Lectura (`GET`) | 120 req / minuto |

Al superarlo: `429 Too Many Requests`.

---

## Endpoints

### `GET /health`

Verifica que el servicio y la base de datos estén disponibles. No requiere autenticación.

**Respuesta exitosa**
```json
{ "status": "ok" }
```

**Servicio no disponible**
```json
{ "status": "unavailable" }
```

---

### `POST /api/payments`

Crea un pago interno con tarjeta o efectivo.

**Headers requeridos**

| Header | Descripción |
|---|---|
| `Authorization` | `Bearer <token>` |
| `Idempotency-Key` | String único (8–128 caracteres) |
| `Content-Type` | `application/json` |

**Body**

```json
{
  "orderId": "ord_abc123",
  "amount": 150.00,
  "currency": "MXN",
  "method": "card"
}
```

| Campo | Tipo | Requerido | Valores |
|---|---|---|---|
| `orderId` | string | Sí | Debe existir en el servicio de Órdenes |
| `amount` | number | Sí | Mayor a 0 |
| `currency` | string | Sí | Código ISO 4217 de 3 letras (ej. `MXN`, `USD`) |
| `method` | string | Sí | `card` \| `cash` |
| `metadata` | object | No | Datos adicionales libres |

**Respuesta `201 Created`**

```json
{
  "id": "664f1a2b3c4d5e6f7a8b9c0d",
  "orderId": "ord_abc123",
  "amount": 150.00,
  "currency": "MXN",
  "method": "card",
  "status": "approved",
  "provider": "internal",
  "providerReference": null,
  "idempotencyKey": "uuid-aqui",
  "message": "Payment approved",
  "createdAt": "2026-05-09T12:00:00.000Z"
}
```

---

### `POST /api/payments/external`

Crea un pago externo via PayPal.

**Headers requeridos**

| Header | Descripción |
|---|---|
| `Authorization` | `Bearer <token>` |
| `Idempotency-Key` | String único (8–128 caracteres) |
| `Content-Type` | `application/json` |

**Body**

```json
{
  "orderId": "ord_abc123",
  "amount": 299.99,
  "currency": "USD",
  "method": "paypal",
  "provider": "paypal",
  "payer": {
    "email": "comprador@ejemplo.com"
  }
}
```

| Campo | Tipo | Requerido | Valores |
|---|---|---|---|
| `orderId` | string | Sí | Debe existir en el servicio de Órdenes |
| `amount` | number | Sí | Mayor a 0 |
| `currency` | string | Sí | Código ISO 4217 de 3 letras |
| `method` | string | Sí | `paypal` |
| `provider` | string | Sí | `paypal` |
| `payer.email` | string | No | Email del pagador |

**Respuesta `201 Created`**

```json
{
  "id": "664f1a2b3c4d5e6f7a8b9c0e",
  "orderId": "ord_abc123",
  "amount": 299.99,
  "currency": "USD",
  "method": "paypal",
  "status": "approved",
  "provider": "paypal",
  "providerReference": "PAYPAL-1715256000000",
  "idempotencyKey": "uuid-aqui",
  "message": "Approved by PayPal",
  "createdAt": "2026-05-09T12:00:00.000Z"
}
```

---

### `GET /api/payments/:paymentId`

Consulta un pago por su ID.

**Headers requeridos**

| Header | Descripción |
|---|---|
| `Authorization` | `Bearer <token>` |

**Parámetros de ruta**

| Parámetro | Descripción |
|---|---|
| `paymentId` | ID del pago (MongoDB ObjectId) |

**Respuesta `200 OK`**

```json
{
  "id": "664f1a2b3c4d5e6f7a8b9c0d",
  "orderId": "ord_abc123",
  "amount": 150.00,
  "currency": "MXN",
  "method": "card",
  "status": "approved",
  "provider": "internal",
  "providerReference": null,
  "idempotencyKey": "uuid-aqui",
  "message": "Payment approved",
  "createdAt": "2026-05-09T12:00:00.000Z"
}
```

---

## Códigos de error

Todos los errores siguen el mismo formato:

```json
{
  "error": "NombreDelError",
  "message": "Descripción legible del problema"
}
```

| Código | `error` | Causa |
|---|---|---|
| `400` | `BadRequest` | Campos inválidos o faltantes |
| `401` | `Unauthorized` | Token JWT ausente o inválido |
| `404` | `NotFound` | `paymentId` o `orderId` no existe |
| `422` | `UnprocessableEntity` | El body no cumple el esquema |
| `429` | `TooManyRequests` | Rate limit superado |
| `500` | `InternalServerError` | Error inesperado en el servidor |
| `503` | `ServiceUnavailable` | Servicio de Órdenes no disponible |

---

## Integración con el servicio de Órdenes

El servicio valida que el `orderId` exista antes de crear un pago. Para ello consulta:

```
GET {ORDERS_SERVICE_URL}/api/orders/:orderId
```

- Si el servicio de Órdenes responde `404` → el pago se rechaza con `404`.
- Si el servicio no está disponible o tarda más de **2 segundos** → el pago se rechaza con `503`.
- Si `ORDERS_SERVICE_URL` no está configurado → se aplica validación local: el `orderId` debe comenzar con `ord_`.

---

## Eventos publicados

Cuando se crea un pago nuevo (no repetido), se publica un evento a Redis en el canal `payments:events`:

```json
{
  "eventType": "payment.created",
  "payload": { ...payment }
}
```

Los demás servicios pueden suscribirse a este canal para reaccionar al pago.

---

## Variables de entorno requeridas

| Variable | Descripción | Ejemplo |
|---|---|---|
| `MONGO_URI` | Cadena de conexión a MongoDB | `mongodb+srv://...` |
| `JWT_SECRET` | Clave secreta para verificar tokens | `supersecret` |
| `PORT` | Puerto del servidor | `3011` |
| `ORDERS_SERVICE_URL` | URL base del servicio de Órdenes | `http://orders-service:3010` |
| `REDIS_URL` | URL de Redis para el outbox | `redis://localhost:6379` |

---

## Levantar en local con Docker

```bash
docker compose up --build
```

Levanta: API (puerto 3000) + MongoDB replica set + Redis.
