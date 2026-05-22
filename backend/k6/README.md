# K6 Flash Sale Load Tests

These scripts exercise the Phase 4 flash sale Redis hot path through the API Gateway.

## Prerequisites

- Backend services are running.
- Redis and Kafka are running:

```powershell
docker compose --env-file backend/.env -f backend/docker-compose.kafka.yml up -d
```

- `FLASH_SALE_ENABLED=true`
- `FLASH_SALE_EVENTS_KAFKA_ENABLED=true`
- A flash sale campaign/item exists in PostgreSQL and the item is `active`.
- Customer tokens are available. Use many different users for realistic per-user-limit behavior.
- For repeated local runs on the same flash sale item, set `FLASH_SALE_TEST_OPS_ENABLED=true`
  on commerce-service and use `-PreloadResetProjection`. Keep this disabled outside dev/load tests.

## Seed Data

Run `backend/db/phase4_flash_sale_demo_seed.sql` before load testing. It adds:

- more Vietnamese categories, products, variants, product images, and inventory,
- `K6 Hot Sale 10K Users` with high-stock flash sale items,
- 200 verified customer accounts:
  `loadtest.customer001@ecommerce.local` to `loadtest.customer200@ecommerce.local`,
  password `Customer@123`.

Lookup campaign/item IDs:

```sql
select fsc.name,
       fsc.id as campaign_id,
       fsi.id as item_id,
       p.slug,
       pv.sku as variant_sku,
       fsi.stock_limit,
       fsi.per_user_limit
from public.flash_sale_items fsi
join public.flash_sale_campaigns fsc on fsc.id = fsi.campaign_id
join public.products p on p.id = fsi.product_id
left join public.product_variants pv on pv.id = fsi.variant_id
where fsc.name = 'K6 Hot Sale 10K Users'
order by fsi.id;
```

Generate the local K6 users file:

```powershell
cd backend/k6
.\generate-loadtest-users.ps1 -Count 200 -Output users.local.json
```

## Smoke Test

From `backend/k6`:

```powershell
.\run-flash-sale.ps1 `
  -Profile smoke `
  -BaseUrl "http://localhost:8080/api" `
  -AuthBaseUrl "http://localhost:8081" `
  -CampaignId "1" `
  -ItemId "1" `
  -Preload `
  -PreloadResetProjection `
  -PreloadStock 100 `
  -PreloadPerUserLimit 1 `
  -UseSeededDemoCredentials
```

The expanded environment-variable form is still supported:

```powershell
$env:BASE_URL = "http://localhost:8080/api"
$env:AUTH_BASE_URL = "http://localhost:8081"
$env:CAMPAIGN_ID = "1"
$env:ITEM_ID = "1"
$env:PRELOAD = "true"
$env:PRELOAD_RESET_PROJECTION = "true"
$env:PRELOAD_STOCK = "100"
$env:PRELOAD_PER_USER_LIMIT = "1"
$env:ADMIN_EMAIL = "admin@ecommerce.local"
$env:ADMIN_PASSWORD = "Admin@123"
$env:LOGIN_USERS = "true"
$env:USERS_FILE = "./users.local.json"
.\run-flash-sale.ps1 -Profile smoke
```

Or run with Docker:

```powershell
.\run-flash-sale.ps1 -Profile smoke -Docker
```

When running through Docker, the script defaults `BASE_URL` to `http://host.docker.internal:8080/api` so the container can reach the host API Gateway.

## Profiles

- `smoke`: 1 VU for 30s by default.
- `claim-once`: one claim attempt per seeded user, useful for checking successful reservation capacity without repeated per-user-limit rejects.
- `local`: ramps to 200 VUs for local development.
- `flash-1k`: ramps to 1,000 VUs.
- `flash-5k`: ramps to 5,000 VUs.
- `flash-10k`: ramps to 10,000 VUs.

Large profiles should run from a machine or K6 Cloud setup that has enough CPU/network capacity. A laptop result mostly measures the laptop.

## Token Strategies

The claim endpoint is authenticated and per-user-limited. For realistic flash-sale tests, use many users:

```powershell
$env:TOKENS="jwt-user-1,jwt-user-2,jwt-user-3"
```

For small smoke tests, one token is enough:

```powershell
$env:ACCESS_TOKEN="<customer-jwt>"
```

For a test user file, copy `users.example.json` to a local ignored file and either put `token`/`accessToken` values in it or enable login:

```powershell
$env:USERS_FILE="./users.local.json"
$env:LOGIN_USERS="true"
```

Do not commit real tokens or passwords.

For local flash-sale testing, prefer `AUTH_BASE_URL=http://localhost:8081` so K6 obtains tokens directly from user-service. That keeps the flash-sale test focused on the claim hot path and avoids gateway auth rate limits during setup.

## Useful Environment Variables

```properties
BASE_URL=http://localhost:8080/api
PROFILE=local
CAMPAIGN_ID=1
ITEM_ID=1
QUANTITY=1
PRELOAD=true
PRELOAD_RESET_PROJECTION=false
PRELOAD_STOCK=10000
PRELOAD_PER_USER_LIMIT=1
ADMIN_TOKEN=
ACCESS_TOKEN=
TOKENS=
USERS_FILE=./users.local.json
LOGIN_USERS=false
SLEEP_MS=0
REQUEST_TIMEOUT=5s
RAMP_UP=2m
HOLD=5m
RAMP_DOWN=2m
SUMMARY_PATH=results/flash-sale-local.json
```

## Interpreting Results

Important metrics:

- `flash_sale_claim_reserved_total`: successful Redis reservations.
- `flash_sale_claim_rejected_total`: sold out, limit exceeded, rate limited, or unavailable responses.
- `flash_sale_claim_reserved_rate`: share of requests that actually reserved stock.
- `flash_sale_deterministic_response_rate`: should stay near 1.0; unexpected HTTP statuses are a red flag.
- `http_req_duration{type:flash-sale-claim}`: end-to-end API latency for the claim endpoint.

Expected production-like behavior:

- With enough stock and enough unique users, most early requests should return `200 RESERVED`.
- After stock is exhausted, `409 SOLD_OUT` is valid and should not be treated as a system failure.
- If using one customer token, most requests after the first claim will be rejected by per-user-limit. That is correct, but it is not a realistic capacity test.

## One Claim Per User

Use this before ramp tests when `perUserLimit=1`:

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
```

Expected result with enough stock: about `reserved=200` and very few rejects. If you see only one reservation here, the test is still reusing one token or the item/user limit was already consumed in Redis. Re-run with a fresh item, higher per-user limit, or clear/preload the Redis keys for that campaign item.

## Resetting Between Repeated Runs

`PRELOAD=true` resets Redis stock for the hot path. It does not automatically delete the
PostgreSQL projection, because production reservations must remain auditable. If you reuse the
same campaign item for K6, old projected reservations can make `flash_sale_reservations` and
`flash_sale_items.reserved_count` look larger than the current preload stock.

For dev/load-test only:

```properties
FLASH_SALE_TEST_OPS_ENABLED=true
```

Then run K6 with `-PreloadResetProjection`. The API deletes unlinked reservation projection rows
for that campaign item and refreshes `reserved_count`/`sold_count` from the remaining rows before
preloading Redis. It does not delete rows already linked to orders.
