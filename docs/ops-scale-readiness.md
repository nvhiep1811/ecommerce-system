# Ops Scale Readiness

Tài liệu này chốt lát cắt ưu tiên đầu tiên cho scale/elastic mà không thay đổi flow nghiệp vụ lõi.

## Mục Tiêu Lát Cắt Này

- Mỗi backend service expose `health`, `health/liveness`, `health/readiness`, và `prometheus`.
- Prometheus scrape được metrics HTTP/JVM/Hikari/Kafka listener nếu metric có mặt.
- Grafana có Prometheus datasource sẵn.
- Kubernetes base manifests có probes, resource requests/limits, HPA cho các service stateless chính.
- Chat media vẫn chạy 1 replica với PVC để tránh sai lệch file local khi scale ngang.

## Local Observability Stack

Chạy full stack app kèm Prometheus/Grafana:

```powershell
docker compose --env-file backend/.env `
  -f backend/docker-compose.yml `
  -f backend/docker-compose.apps.yml `
  -f backend/docker-compose.observability.yml `
  up -d --build
```

Endpoints:

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000`
- Service metrics: `/actuator/prometheus`
- Readiness: `/actuator/health/readiness`
- Liveness: `/actuator/health/liveness`

Default Grafana credential in local `.env.example` is `admin/admin`; staging/production must override it.

## Kubernetes Base

Manifests live in:

```text
backend/k8s/base
```

Apply to a dev cluster:

```powershell
kubectl apply -k backend/k8s/base
```

Before staging/production:

- Replace `backend/k8s/base/secret.example.yaml` with sealed secrets, external secrets, or CI-injected secrets.
- Replace image names/tags with immutable registry tags from CI.
- Point PostgreSQL, Redis, Kafka, and Kafka Connect to managed or separately operated endpoints.
- Keep `DB_POOL_MAX_SIZE` coordinated with PgBouncer/PostgreSQL connection budget before increasing HPA max replicas.
- Keep `chat-service` at 1 replica until media storage is moved to object storage or a shared ReadWriteMany volume.

## Alert Baseline

Prometheus rules currently cover:

- Service scrape down.
- HTTP 5xx rate above 5%.
- HTTP p95 latency above 1 second.
- Hikari pending DB connections.
- Kafka consumer lag if Micrometer exposes `kafka_consumer_records_lag_max`.

Next production step is adding infrastructure exporters for Kafka broker/Connect, Redis, PostgreSQL, and node/container metrics. App metrics alone cannot tell DLT topic depth, Kafka Connect task status, WAL growth, or Redis eviction pressure.

## Safety Notes

- These changes do not alter checkout, payment, inventory, catalog, chat, or assistant business logic.
- `/actuator/prometheus` is permitted for scrape access. In production, restrict it at network level with Kubernetes NetworkPolicy, ingress rules, or private service networking.
- `/actuator/health/**` is public for Kubernetes probes and load balancer health checks.
