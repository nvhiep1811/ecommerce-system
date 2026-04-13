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

Each Spring Boot service now tries to import shared values from `backend/.env`. The current local setup uses your Supabase JDBC URI directly:

```bash
ECOMMERCE_DB_URL=jdbc:postgresql://db.dglfcdxadwvvvhlqnkyp.supabase.co:5432/postgres?user=postgres&password=your-password
ECOMMERCE_JWT_SECRET=<generated-secret>
```

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
