# ecommerce-system

Service-based e-commerce system with a Spring Boot backend and Expo mobile client.

## What is in this repo

- `backend/api-gateway`: single entrypoint for mobile traffic.
- `backend/user-service`: authentication, profile, address management.
- `backend/catalog-service`: categories, products, coupons.
- `backend/commerce-service`: checkout, orders, inventory reservations, payments.
- `backend/shared-kernel`: JWT, shared web errors, base entities.
- `mobile-app`: Expo application that now talks to backend APIs only.

## Architecture

The backend follows a service-based architecture on top of the shared PostgreSQL schema from the provided SQL file. Table ownership is explicit by domain, while cross-service workflows stay in Java services instead of database triggers.

Key patterns already applied:

- API Gateway for client entry and route composition.
- Orchestrator in `commerce-service` for checkout flow.
- Strategy pattern in payment handling.
- Outbox pattern for integration events.
- Retry, Circuit Breaker, and Bulkhead via Resilience4j.
- Optimistic locking via `@Version`-ready base entities.

More detail lives in [backend/docs/architecture.md](backend/docs/architecture.md).
Payment methods, SePay QR/checkout, webhook, RabbitMQ notification, and manual test notes live in [backend/docs/payments-sepay.md](backend/docs/payments-sepay.md).
GitLab CI/CD and Jenkins setup notes live in [docs/ci-cd.md](docs/ci-cd.md).

## Mobile app contract

`mobile-app` no longer uses Supabase or SQLite for server business data. The app now calls:

- `/api/auth/**`
- `/api/users/**`
- `/api/catalog/**`
- `/api/commerce/**`

The Expo client now reads `mobile-app/.env` automatically. Default local config:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api
```

For Android emulator, the app already falls back to `http://10.0.2.2:8080/api`.

## Backend configuration

Each Spring Boot service now tries to import shared values from `backend/.env`. Local defaults point to a local PostgreSQL database; use Supabase by setting the JDBC URL and credentials in `backend/.env`:

```bash
ECOMMERCE_DB_URL=jdbc:postgresql://db.dglfcdxadwvvvhlqnkyp.supabase.co:5432/postgres
ECOMMERCE_DB_USERNAME=postgres
ECOMMERCE_DB_PASSWORD=your-password
ECOMMERCE_JWT_SECRET=<generated-secret>
```

For an existing Supabase database, run these scripts before booting services with `ddl-auto=validate`:

- `backend/db/phase1_order_idempotency.sql`: adds checkout idempotency support.
- `backend/db/phase2_data_readiness_indexes.sql`: adds indexes for hot catalog/search, favourites, reviews, order lists, seller order joins, and outbox relay queries.

Production-readiness knobs added in Phase 1:

- Redis cache/rate limit: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `CATALOG_READ_CACHE_STORE`, `GATEWAY_RATE_LIMIT_ENABLED`.
- Pool/thread tuning: `DB_POOL_MAX_SIZE`, `SERVER_TOMCAT_MAX_THREADS`, `SERVER_TOMCAT_ACCEPT_COUNT`.
- Resilience tuning: `*_CB_*`, `*_BULKHEAD_*`, `OUTBOX_RELAY_DELAY_MS`.

Related files added for handoff:

- `backend/.env`
- `backend/.env.example`
- `mobile-app/.env`
- `mobile-app/.env.example`

Default ports:

- `api-gateway`: `8080`
- `user-service`: `8081`
- `catalog-service`: `8082`
- `commerce-service`: `8083`

## Suggested startup order

1. Bootstrap the PostgreSQL schema.
2. Start `user-service`, `catalog-service`, `commerce-service`.
3. Start `api-gateway`.
4. Start the Expo app.

## Important note

The Spring services use `spring.jpa.hibernate.ddl-auto=validate`, so the database schema must exist before booting the backend.
