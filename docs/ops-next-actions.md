# Ops/Scale Next Actions

Checklist theo thu tu uu tien cho muc tieu nang cap he thong: Kubernetes scale/elastic, Kafka/Debezium event backbone, observability voi Prometheus/Grafana, CQRS/read models, va Event Sourcing co kiem soat.

## P0 - Review Va Giu Flow Cot Loi Dung

- Tao PR/MR tu `chore/ops-scale-readiness` va review cac commit da lam: Kafka/Debezium, payment expiration Redis queue, observability, Docker/Kubernetes baseline.
- Chay lai full stack local bang command co `--build` de tranh dung stale app image:

```powershell
docker compose --env-file backend/.env -f backend/docker-compose.yml -f backend/docker-compose.apps.yml -f backend/docker-compose.observability.yml up -d --build
```

- Kiem tra health toi thieu:
  - `docker compose --env-file backend/.env -f backend/docker-compose.yml -f backend/docker-compose.apps.yml -f backend/docker-compose.observability.yml ps`
  - `Invoke-RestMethod http://localhost:8080/actuator/health/readiness`
  - `Invoke-RestMethod http://localhost:8085/connectors/ecommerce-outbox-postgres/status`
- Smoke test cac flow chinh truoc khi lam tiep: login, catalog read, checkout COD, checkout online, SePay webhook, order email, payment expiration.
- Luu y local compose: chi `api-gateway` publish `8080` ra host; cac service con lai chay noi bo Docker network va goi qua gateway/service DNS.

## P1 - Observability Va SLO Truoc Khi Scale

- Bo sung exporters cho Kafka broker/Connect, Redis, PostgreSQL, node/container metrics. App metrics hien tai chua du de debug lag, WAL growth, Redis eviction, hay container saturation.
- Xac nhan Grafana dashboard `Ecommerce Backend SLO` co du lieu sau khi tao order/webhook.
- Dat SLO ban dau:
  - checkout p95 latency,
  - HTTP 5xx rate,
  - payment webhook failure rate,
  - notification DLT rate,
  - Kafka Connect task down time,
  - payment expiration delay.
- Chuyen alert rules local sang kenh canh bao that: Slack/Email/PagerDuty tuy moi truong.
- Them structured logs/correlation id theo request va event id de trace checkout -> outbox -> Kafka -> consumer.

## P1 - Kafka/Debezium Production Readiness

- Tao database replication user rieng cho Debezium, gioi han quyen theo publication `ecommerce_outbox_publication`.
- Xac nhan logical replication, replication slot, WAL retention, va monitoring WAL growth tren PostgreSQL/RDS.
- Giu `snapshot.mode=when_needed` cho local/staging recovery; ghi runbook reset offsets khi WAL offset stale.
- Chuan hoa topic naming dai han: them cot normalized topic hoac migrate `aggregate_type` ve lower-case co kiem soat.
- Tao smoke test end-to-end: checkout -> `outbox_events` -> Debezium -> Kafka -> consumer -> `notification_deliveries`.
- Dat DLT handling policy: ai xu ly, replay bang command nao, replay co idempotent khong.

## P1 - Kubernetes Elastic Baseline

- Tao overlay rieng cho staging/prod: image registry tags, resources, ingress/TLS, config maps, secrets.
- Thay placeholder secrets trong `backend/k8s/base/secrets.yaml` bang External Secrets/Sealed Secrets hoac secret manager.
- Rollout tung service theo thu tu: `api-gateway`, `user-service`, `catalog-service`, `commerce-service`, `chat-service`, `assistant-service`.
- Kiem tra readiness/liveness, startup probe, graceful shutdown, rolling update, rollback.
- Cau hinh HPA dua tren CPU/memory truoc; sau do mo rong sang metric custom nhu request rate, checkout latency, Kafka consumer lag.
- Tach stateful dependencies ra managed services hoac chart rieng: PostgreSQL/RDS, Redis, Kafka/Kafka Connect, Prometheus/Grafana.

## P2 - CQRS Va Read Models

- Uu tien CQRS cho read-heavy flows truoc: catalog search/listing, product detail, order history, seller order management.
- Dung Kafka consumer nen ngam de sync read models/search index thay vi dong bo trong checkout request.
- Them read model versioning va rebuild script de co the replay tu Kafka/outbox khi schema thay doi.
- Dinh nghia read/write API boundary ro rang: write side giu transaction consistency, read side toi uu latency/denormalized data.
- Bo sung cache strategy cho catalog/product pages: TTL, invalidation theo event, stampede protection.

## P2 - Resilience Va Capacity

- Chay load test cho checkout, catalog listing, webhook, notification consumer, payment expiration queue.
- Dinh nghia capacity signals: CPU, memory, DB pool pending, Redis latency, Kafka lag, p95/p99 latency.
- Them rate limit/backpressure o gateway va cac consumer khi downstream cham.
- Kiem tra circuit breaker/bulkhead hien co voi failure modes that: catalog down, Redis down, Kafka down, DB slow.
- Xac nhan idempotency cho webhook, notification, payment expiration, checkout retry.

## P3 - Event Sourcing Co Kiem Soat

- Khong nen chuyen toan bo he thong sang Event Sourcing ngay. Hien tai outbox + CDC + Kafka phu hop hon cho commerce flow.
- Neu can Event Sourcing, bat dau bang audit/event history cho domain quan trong: order lifecycle, payment lifecycle, inventory reservation.
- Dinh nghia event schema versioning, compatibility rules, replay tooling, va snapshot strategy truoc khi dung event log lam source of truth.
- Chi can nhac full Event Sourcing cho aggregate co loi ich ro rang ve audit/replay/time-travel, vi no tang do phuc tap operational va migration.

## P3 - CI/CD Va Hardening

- Dam bao pipeline build image luon tao executable Spring Boot JAR qua `spring-boot:repackage`.
- Them container smoke test: image boot duoc va `/actuator/health/readiness` tra `UP`.
- Them deployment promotion: dev -> staging -> prod, co rollback ro rang.
- Giam log noise Spring Data Redis repository scanning neu can bang cau hinh repository scanning ro hon.
- Ra soat `.env`, secret rotation, va khong commit connector local config co secret.
- Kiem tra `outbox_events.status = pending`: trong Kafka-only runtime day la "persisted and CDC-owned", khong phai loi poller.
