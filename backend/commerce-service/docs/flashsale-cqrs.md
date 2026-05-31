# Flash Sale CQRS Design

## Overview
The flash‑sale domain now follows the **Command‑Query Responsibility Segregation (CQRS)** pattern:

- **Command side** – `FlashSaleCommandController` (`/api/flashsale/commands`) handles write operations (`preload` and `claim`).
- **Query side** – `FlashSaleReadModelController` (`/api/flashsale`) provides read‑only endpoints (`/claimed`, `/event/{eventId}/processed`).
- **Read Model** – `FlashSaleReadModelService` maintains a MongoDB collection that is updated asynchronously by the `FlashSaleReadModelConsumer` listening to the `flashsale-claimed` Kafka topic.
- **Event flow** – `FlashSaleClaimCommandHandler` publishes a `FlashSaleClaimedEvent` to Kafka. The consumer deserialises the event and updates the read model, guaranteeing eventual consistency and idempotency.

## Benefits
- **Scalability** – Write and read workloads can be scaled independently.
- **Performance** – Reads hit a lightweight Mongo read model instead of the write‑model (Redis/DB).
- **Isolation** – Business logic for writes stays clean, while read‑model concerns (projection, indexing) are encapsulated in their own service.

## API Summary
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/flashsale/commands/{campaignId}/{itemId}/preload` | Pre‑load stock for a flash‑sale campaign. |
| `POST` | `/api/flashsale/commands/{campaignId}/{itemId}/claim` | Claim a quantity; publishes `FlashSaleClaimedEvent`. |
| `GET`  | `/api/flashsale/{saleId}/claimed` | Returns the total claimed quantity from the read model. |
| `GET`  | `/api/flashsale/{saleId}/event/{eventId}/processed` | Checks if a claim event has already been processed (idempotency). |

## Testing
- Unit tests for both controllers are located in `src/test/java/com/ecommerce/commerce/controller`.
- The read‑model consumer is exercised indirectly through the command‑handler unit test and can be verified with an embedded‑Kafka integration test (optional).

## Future Work
- Add an embedded‑Kafka integration test to validate end‑to‑end event flow.
- Implement metrics and health checks for the read‑model projection service.
