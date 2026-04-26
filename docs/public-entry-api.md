# Public Entry API

This endpoint lets a third-party app create a normal finance entry in FinanzApp.

It is designed for tools like `n8n`, `Zapier`, `Make`, custom scripts, or mobile shortcuts.

## Endpoint

- Method: `POST`
- URL: `/api/v1/entries`

Local example:

```text
http://localhost:3000/api/v1/entries
```

## Authentication

You must send a valid API key.

Supported headers:

```http
X-API-Key: <your_api_key>
```

or

```http
Authorization: Bearer <your_api_key>
```

Create and manage keys from the user page in the app.

## Content Type

Send JSON:

```http
Content-Type: application/json
```

## Single Entry Body

Expected JSON body:

```json
{
  "fecha": "2026-04-26T20:15:00.000Z",
  "tipo": "Salario",
  "accion": "Ingreso",
  "que": "Trabajo",
  "plataforma_pago": "Transferencia",
  "cantidad": 2500.5,
  "detalle1": "optional",
  "detalle2": "optional",
  "quien": "Yo"
}
```

### Required fields

- `fecha`: ISO 8601 datetime string
- `tipo`: string, 1 to 255 chars
- `accion`: one of `Ingreso`, `Gasto`, `Inversión`
- `que`: string, 1 to 255 chars
- `plataforma_pago`: string, 1 to 255 chars
- `cantidad`: positive number

### Optional fields

- `detalle1`: string, `null`, or omitted
- `detalle2`: string, `null`, or omitted
- `quien`: string, defaults to `Yo`

## Batch Body

You can also create multiple entries in one request.

```json
{
  "entries": [
    {
      "fecha": "2026-04-26T20:15:00.000Z",
      "tipo": "Salario",
      "accion": "Ingreso",
      "que": "Trabajo",
      "plataforma_pago": "Transferencia",
      "cantidad": 2500.5,
      "quien": "Yo"
    },
    {
      "fecha": "2026-04-26T20:20:00.000Z",
      "tipo": "Comida",
      "accion": "Gasto",
      "que": "Cena",
      "plataforma_pago": "Tarjeta",
      "cantidad": 18.9
    }
  ]
}
```

Batch limits:

- minimum: `1` entry
- maximum: `100` entries

Batch writes are transactional. If one entry fails, none are inserted.

## Success Response

### Single entry success

Status:

```http
201 Created
```

Body:

```json
{
  "success": true,
  "data": {
    "id": "71b63e4c-5ef2-47b1-8928-8cbc1cb6c2fe",
    "fecha": "2026-04-26T20:15:00.000Z",
    "tipo": "API Verification",
    "accion": "Ingreso",
    "que": "Final verification call",
    "plataforma_pago": "Webhook",
    "cantidad": "42.50",
    "detalle1": "final-disposable-verification",
    "detalle2": "public-endpoint-doc-pass",
    "quien": "Yo"
  }
}
```

### Batch success

Status:

```http
201 Created
```

Body:

```json
{
  "success": true,
  "data": [
    {
      "id": "entry-id-1",
      "fecha": "2026-04-26T20:15:00.000Z",
      "tipo": "Salario",
      "accion": "Ingreso",
      "que": "Trabajo",
      "plataforma_pago": "Transferencia",
      "cantidad": "2500.50",
      "detalle1": null,
      "detalle2": null,
      "quien": "Yo"
    }
  ]
}
```

## Error Responses

### Invalid or missing API key

Status:

```http
401 Unauthorized
```

Body:

```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing API key. Provide it via X-API-Key header or Authorization: Bearer <key>."
}
```

### Invalid JSON body

Status:

```http
400 Bad Request
```

Body:

```json
{
  "error": "Bad Request",
  "message": "Invalid JSON body."
}
```

### Validation error

Status:

```http
422 Unprocessable Entity
```

Body:

```json
{
  "error": "Validation Error",
  "message": "Request body failed validation.",
  "issues": [
    {
      "path": "cantidad",
      "message": "cantidad must be a positive number"
    }
  ]
}
```

### Rate limit exceeded

Status:

```http
429 Too Many Requests
```

Body:

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in 60 seconds.",
  "retryAfter": 60
}
```

## Rate Limit Headers

Successful requests return rate-limit headers:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1767171717
```

Current limit:

- `60` requests per minute per API key

## cURL Example

```bash
curl -X POST http://localhost:3000/api/v1/entries \
  -H "Content-Type: application/json" \
  -H "X-API-Key: fa_your_real_key_here" \
  -d '{
    "fecha": "2026-04-26T20:15:00.000Z",
    "tipo": "Salario",
    "accion": "Ingreso",
    "que": "Trabajo",
    "plataforma_pago": "Transferencia",
    "cantidad": 2500.5,
    "detalle1": "webhook-run-001",
    "detalle2": "zapier",
    "quien": "Yo"
  }'
```

## JavaScript Example

```js
const response = await fetch("http://localhost:3000/api/v1/entries", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": process.env.FINANZAPP_API_KEY,
  },
  body: JSON.stringify({
    fecha: new Date().toISOString(),
    tipo: "Salario",
    accion: "Ingreso",
    que: "Trabajo",
    plataforma_pago: "Transferencia",
    cantidad: 2500.5,
    detalle1: "webhook-run-001",
    detalle2: "n8n",
    quien: "Yo",
  }),
})

const data = await response.json()

if (!response.ok) {
  throw new Error(JSON.stringify(data))
}

console.log(data)
```

## Verified Behavior

This endpoint was verified live against the real app runtime and database:

- invalid key returns `401`
- valid key returns `201`
- created entry is persisted in `finance_entries`
- API key `last_used_at` is updated on success
- response returns confirmation payload with created entry data

## Operational Notes

- Revoke any key immediately if it leaks
- Use one key per integration when possible
- Use `detalle1` or `detalle2` to attach an external run ID for traceability
- If you need idempotency later, add an external reference field or dedupe layer on top
