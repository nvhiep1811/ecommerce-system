# Phase 4A Flash Sale Hot Path

This phase adds a separate flash sale flow. Normal checkout remains unchanged.

## Runtime Model

Flash sale claim requests avoid PostgreSQL on the critical path:

```text
Mobile claim request
-> commerce-service FlashSaleController
-> Redis Lua atomic claim
-> Kafka event publish
-> Kafka consumer syncs reservation facts into PostgreSQL
```

PostgreSQL stores campaign metadata in:

- `flash_sale_campaigns`
- `flash_sale_items`
- `flash_sale_reservations`

Redis is the source of truth for active flash sale stock while the campaign is running. Kafka is the bridge for durable downstream sync.

## Redis Keys

Keys use Redis Cluster hash tags so Lua scripts can run in a cluster:

```text
flash-sale:{campaignId:itemId}:stock
flash-sale:{campaignId:itemId}:buyers
flash-sale:{campaignId:itemId}:reservations
flash-sale:{campaignId:itemId}:reservation-expirations
flash-sale:{campaignId:itemId}:per-user-limit
flash-sale:{campaignId:itemId}:request:{requestId}
flash-sale:active-items
```

The claim script is atomic:

- rejects when stock is not preloaded,
- rejects sold out items,
- enforces per-user quantity limit,
- handles idempotency by `requestId`,
- creates a reservation token with TTL,
- decrements Redis stock without touching PostgreSQL.

If Kafka publish fails after Redis reserves stock, commerce-service releases the Redis reservation before returning an error.

`FlashSaleReservationKafkaConsumer` consumes `FLASH_SALE_RESERVED` events and persists reservation facts into PostgreSQL idempotently by `reservationToken` and `(campaignId, itemId, userId, requestId)`.

`FlashSaleExpirationService` scans Redis reservation zsets and releases expired tokens through Lua. A release restores Redis stock, reduces the per-user reserved quantity, publishes `FLASH_SALE_EXPIRED`, and the Kafka consumer marks the PostgreSQL reservation as `expired` while decrementing `flash_sale_items.reserved_count`. The sync is idempotent and can tolerate an expired event arriving before the original reserved event.

Checkout can consume a reservation by sending the reservation reference on the matching order line. The confirmation Lua script validates user ownership, quantity, and expiration before removing the token from the Redis expiration set. Commerce then marks the reservation as `confirmed`, links it to `order_id`, decrements `reserved_count`, and increments `sold_count`.

If the order is cancelled before shipment or an online payment expires/fails/mismatches while the order is still pending payment, commerce releases confirmed flash sale reservations for that order. The release path marks the reservation as `released`, decrements `sold_count`, restores the Redis hot stock when the item is still preloaded, and reduces the user's Redis purchase counter so the buyer can try again when business rules allow it.

## Config

```properties
FLASH_SALE_ENABLED=true
FLASH_SALE_RESERVATION_TTL_SECONDS=600
FLASH_SALE_EXPIRATION_SCAN_DELAY_MS=5000
FLASH_SALE_EXPIRATION_BATCH_SIZE=100
FLASH_SALE_EVENTS_KAFKA_ENABLED=true
FLASH_SALE_EVENTS_TOPIC=ecommerce.flash-sale.events
FLASH_SALE_RESERVATION_SYNC_GROUP_ID=flash-sale.reservation-sync
FLASH_SALE_EVENTS_PUBLISH_REQUIRED=true
FLASH_SALE_EVENTS_PUBLISH_TIMEOUT_MS=800
```

Use the local runtime stack:

```powershell
docker compose --env-file backend/.env -f backend/docker-compose.kafka.yml up -d
```

The local compose file runs single-node Redis for development. Production should use Redis Cluster.

## APIs

Preload stock, admin only:

```http
POST /commerce/flash-sales/{campaignId}/items/{itemId}/preload
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "stock": 1000,
  "perUserLimit": 1
}
```

Claim reservation, authenticated user:

```http
POST /commerce/flash-sales/{campaignId}/items/{itemId}/claim
Authorization: Bearer <customer-token>
Content-Type: application/json

{
  "requestId": "device-or-checkout-idempotency-key",
  "quantity": 1
}
```

Success:

```json
{
  "campaignId": 1,
  "itemId": 10,
  "status": "RESERVED",
  "reservationToken": "fsr_...",
  "quantity": 1,
  "remainingStock": 999,
  "expiresAt": "2026-05-21T10:00:00Z",
  "message": "Flash sale reservation created"
}
```

Checkout with a flash sale reservation:

```json
{
  "addressId": 10,
  "paymentMethod": "SEPAY_QR",
  "shippingMethodId": 1,
  "items": [
    {
      "productId": 100,
      "variantId": null,
      "quantity": 1,
      "flashSaleCampaignId": 1,
      "flashSaleItemId": 10,
      "flashSaleReservationToken": "fsr_..."
    }
  ],
  "clientRequestId": "checkout-idempotency-key"
}
```

## Next Work

- Add K6 load scenarios for 1k, 5k, then 10k virtual users.
- Add a flash sale checkout integration test that runs against Redis/Kafka test containers before production hardening.
