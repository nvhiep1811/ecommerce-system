# Service-Based Architecture

## Topology

The system uses a service-based architecture with one shared PostgreSQL database and clear ownership boundaries:

- `user-service`
  - Owns `users`, `user_roles`, `addresses`, `customer_payment_methods`
  - Exposes auth, profile, and address APIs
- `catalog-service`
  - Owns `categories`, `products`, `coupons`, `coupon_usages`
  - Publishes outbox events for catalog and coupon changes
- `commerce-service`
  - Owns `inventory_items`, `inventory_reservations`, `inventory_movements`, `orders`, `order_items`, `payments`
  - Orchestrates checkout and seller order updates
- `api-gateway`
  - Single mobile entrypoint
  - Routes `/api/auth`, `/api/users`, `/api/catalog`, `/api/commerce`

## Why service-based instead of many microservices

The schema is broad, but the current product scope does not justify splitting every domain into an independently deployed microservice. This shape keeps domain boundaries real without forcing premature operational complexity.

## Domain workflow

Checkout flow in `commerce-service`:

1. Read shipping address from `user-service`
2. Read product snapshots from `catalog-service`
3. Validate coupon through `catalog-service`
4. Create order and order items
5. Reserve inventory
6. Create initial payment attempt
7. Consume coupon
8. Publish outbox event

This keeps business workflow in Java services as requested by the schema notes.

## Design patterns in use

- `API Gateway`
  - Client isolation and route consolidation
- `Orchestrator`
  - `CheckoutOrchestrator` coordinates multi-service checkout
- `Strategy`
  - Payment handling uses `PaymentMethodStrategy`
- `Outbox`
  - `outbox_events` is used for reliable integration/event relay
- `Shared Kernel`
  - JWT, exception model, and entity base classes are centralized

## Fault tolerance

Inter-service calls use Resilience4j:

- `Retry`
  - transient failures when calling other services
- `CircuitBreaker`
  - prevents cascading failure on user/catalog dependencies
- `Bulkhead`
  - bounds concurrent remote calls to protect service health

Fallback behavior is explicit:

- user/catalog dependencies fail fast with `503 Service Unavailable`
- checkout stops instead of creating half-valid business state
- outbox events keep integration intent durable in the database

## Supabase hardening

The current Supabase project has been prepared for backend-only access:

- schema bootstrap and FK index hardening migrations have been applied
- `citext` has been moved to the `extensions` schema
- `public` tables are locked with backend-only deny policies for `anon` and `authenticated`

This keeps the JDBC-based Spring services as the only intended business-data entrypoint.

## Mobile boundary

`mobile-app` must not access PostgreSQL or Supabase tables directly anymore. Its responsibility is now:

- authenticate against backend
- render API data
- keep only local UX state such as cart/session helpers

## Known extension points

- payment gateway callback/webhook handlers
- shipment service integration
- dedicated outbox relay worker
- cart merge endpoint for guest-to-user cart merge
- review and favourite services
