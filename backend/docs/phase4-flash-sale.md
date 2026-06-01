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

`FlashSaleReservationKafkaConsumer` consumes `FLASH_SALE_RESERVED` events in batches and persists reservation facts into PostgreSQL idempotently by `reservationToken` and `(campaignId, itemId, userId, requestId)`. Redis remains the immediate source of truth during the sale; PostgreSQL is an eventually consistent projection. After a large K6 run, `flash_sale_reservations` can lag behind Redis/Kafka briefly while the batch consumer catches up.

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
FLASH_SALE_RESERVATION_SYNC_CONCURRENCY=3
FLASH_SALE_RESERVATION_SYNC_MAX_POLL_RECORDS=500
FLASH_SALE_RESERVATION_SYNC_POLL_TIMEOUT_MS=1000
FLASH_SALE_TEST_OPS_ENABLED=false
```

Use the local runtime stack:

```powershell
docker compose --env-file backend/.env -f backend/docker-compose.kafka.yml up -d
```

The local compose file runs single-node Redis for development. Production should use Redis Cluster.

For local Kafka, the flash sale topic is created with 6 partitions. Set `FLASH_SALE_RESERVATION_SYNC_CONCURRENCY` up to the partition count when the DB has enough connection pool headroom. The consumer uses JDBC batch insert for reserved events and refreshes `flash_sale_items.reserved_count`/`sold_count` from `flash_sale_reservations`, so duplicate Kafka delivery does not inflate counts. Release/expired events are also applied through idempotent SQL updates to avoid JPA optimistic-lock conflicts with batch reserved sync.

## Demo Seed

Seed enough catalog and flash sale data before running load tests.

In your PostgreSQL/RDS SQL client, open and run the contents of:

```text
backend/db/phase4_flash_sale_demo_seed.sql
```

With `psql`, run:

```powershell
psql "$env:DATABASE_URL" -f backend/db/phase4_flash_sale_demo_seed.sql
```

The seed is idempotent and adds:

- Vietnamese categories, brands, products, variants, product images, and inventory.
- 200 verified load-test customers:
  `loadtest.customer001@ecommerce.local` to `loadtest.customer200@ecommerce.local`,
  all using password `Customer@123`.
- Active flash sale campaigns:
  `Mega Mall Flash Sale Hôm nay` and `K6 Hot Sale 10K Users`.
- Scheduled campaign:
  `Mega Mall Flash Sale Cuối tuần`.

Lookup the active campaign/item IDs for API or K6:

```sql
select fsc.name,
       fsc.id as campaign_id,
       fsi.id as item_id,
       p.slug,
       pv.sku as variant_sku,
       fsi.sale_price,
       fsi.stock_limit,
       fsi.per_user_limit,
       fsi.status
from public.flash_sale_items fsi
join public.flash_sale_campaigns fsc on fsc.id = fsi.campaign_id
join public.products p on p.id = fsi.product_id
left join public.product_variants pv on pv.id = fsi.variant_id
where fsc.name in ('Mega Mall Flash Sale Hôm nay', 'K6 Hot Sale 10K Users')
order by fsc.name, fsi.id;
```

## APIs

Preload stock, admin only:

```http
POST /commerce/flash-sales/{campaignId}/items/{itemId}/preload
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "stock": 1000,
  "perUserLimit": 1,
  "resetProjection": false
}
```

`resetProjection=true` is only accepted when `FLASH_SALE_TEST_OPS_ENABLED=true`. Use it for repeated
K6 runs on the same item to delete unlinked projection rows before Redis preload. Do not enable it
in production.

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

## K6 Flow

Generate a local users file from the seeded load-test accounts:

```powershell
cd backend/k6
.\generate-loadtest-users.ps1 -Count 200 -Output users.local.json
```

Run smoke first. Use `K6 Hot Sale 10K Users` for load testing because it has large stock limits:

```powershell
.\run-flash-sale.ps1 `
  -Profile smoke `
  -BaseUrl "http://localhost:8080/api" `
  -AuthBaseUrl "http://localhost:8081" `
  -CampaignId "<campaign_id>" `
  -ItemId "<item_id>" `
  -Preload `
  -PreloadResetProjection `
  -PreloadStock 1000 `
  -PreloadPerUserLimit 1 `
  -UseSeededDemoCredentials
```

Then raise the profile gradually:

```powershell
.\run-flash-sale.ps1 `
  -Profile claim-once `
  -BaseUrl "http://localhost:8080/api" `
  -AuthBaseUrl "http://localhost:8081" `
  -CampaignId "<campaign_id>" `
  -ItemId "<item_id>" `
  -Preload `
  -PreloadResetProjection `
  -PreloadStock 200 `
  -PreloadPerUserLimit 1 `
  -UseSeededDemoCredentials `
  -LoginUsers `
  -LoginUsersLimit 200 `
  -Iterations 200 `
  -Vus 50

.\run-flash-sale.ps1 `
  -Profile local `
  -BaseUrl "http://localhost:8080/api" `
  -AuthBaseUrl "http://localhost:8081" `
  -CampaignId "<campaign_id>" `
  -ItemId "<item_id>" `
  -Preload `
  -PreloadResetProjection `
  -PreloadStock 10000 `
  -PreloadPerUserLimit 1 `
  -UseSeededDemoCredentials

.\run-flash-sale.ps1 `
  -Profile flash-1k `
  -BaseUrl "http://localhost:8080/api" `
  -AuthBaseUrl "http://localhost:8081" `
  -CampaignId "<campaign_id>" `
  -ItemId "<item_id>" `
  -Preload `
  -PreloadResetProjection `
  -PreloadStock 50000 `
  -PreloadPerUserLimit 1 `
  -UseSeededDemoCredentials
```

Only run `flash-5k` or `flash-10k` after smoke/local/1k pass and the machine has enough CPU, Redis, Kafka, and database headroom. These profiles can overwhelm a laptop, which is expected.

After a large run, validate the projection with:

```sql
select fsi.stock_limit,
       fsi.reserved_count,
       fsi.sold_count,
       count(*) filter (where fsr.status = 'reserved') as reserved_rows,
       count(*) filter (where fsr.status = 'expired') as expired_rows,
       count(*) filter (where fsr.status = 'released') as released_rows,
       count(*) filter (where fsr.status = 'confirmed') as confirmed_rows
from public.flash_sale_items fsi
left join public.flash_sale_reservations fsr
       on fsr.campaign_id = fsi.campaign_id
      and fsr.item_id = fsi.id
where fsi.campaign_id = <campaign_id>
  and fsi.id = <item_id>
group by fsi.stock_limit, fsi.reserved_count, fsi.sold_count;
```

## Next Work

- Add a flash sale checkout integration test that runs against Redis/Kafka test containers before production hardening.
