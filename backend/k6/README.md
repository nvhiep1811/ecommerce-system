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

## Smoke Test

From `backend/k6`:

```powershell
$env:BASE_URL="http://localhost:8080/api"
$env:CAMPAIGN_ID="1"
$env:ITEM_ID="1"
$env:ACCESS_TOKEN="<customer-jwt>"
$env:ADMIN_TOKEN="<admin-jwt>"
$env:PRELOAD="true"
$env:PRELOAD_STOCK="100"
$env:PRELOAD_PER_USER_LIMIT="1"
.\run-flash-sale.ps1 -Profile smoke
```

Or run with Docker:

```powershell
.\run-flash-sale.ps1 -Profile smoke -Docker
```

When running through Docker, the script defaults `BASE_URL` to `http://host.docker.internal:8080/api` so the container can reach the host API Gateway.

## Profiles

- `smoke`: 1 VU for 30s by default.
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

## Useful Environment Variables

```properties
BASE_URL=http://localhost:8080/api
PROFILE=local
CAMPAIGN_ID=1
ITEM_ID=1
QUANTITY=1
PRELOAD=true
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
