# Ops Next Actions

Ghi chú các việc còn lại sau nhánh `chore/ops-scale-readiness`.

## P0 - Trước Khi Demo/Review

- Tạo PR/MR từ `chore/ops-scale-readiness` và review các commit ops/Kafka/observability.
- Chạy lại full stack local bằng command có `--build`:

```powershell
docker compose --env-file backend/.env -f backend/docker-compose.yml -f backend/docker-compose.apps.yml -f backend/docker-compose.observability.yml up -d --build
```

- Kiểm tra app containers:
  - `docker compose --env-file backend/.env -f backend/docker-compose.yml -f backend/docker-compose.apps.yml -f backend/docker-compose.observability.yml ps`
  - `Invoke-RestMethod http://localhost:8080/actuator/health/readiness`
  - `Invoke-RestMethod http://localhost:8085/connectors/ecommerce-outbox-postgres/status`
- Lưu ý: chỉ `api-gateway` publish `8080` ra host; các service còn lại chạy nội bộ Docker network và gọi qua gateway/service DNS.

## P1 - Kafka/Debezium Production Readiness

- Tạo user replication riêng cho Debezium, giới hạn quyền theo publication `ecommerce_outbox_publication`.
- Bật alert cho Kafka Connect connector/task status, DLT topic depth, consumer lag, PostgreSQL WAL growth, và Redis payment-expiration queue depth.
- Xác nhận `snapshot.mode=when_needed` phù hợp môi trường staging/prod; ghi runbook reset offsets khi WAL offset stale.
- Chuẩn hóa topic naming dài hạn: thêm cột normalized topic hoặc migrate `aggregate_type` về lower-case có kiểm soát.
- Chạy smoke test end-to-end: checkout -> `outbox_events` -> Debezium -> Kafka -> email consumer -> `notification_deliveries`.

## P1 - Observability

- Bổ sung exporters cho Kafka broker/Connect, Redis, PostgreSQL, node/container metrics.
- Import/check Grafana dashboard `Ecommerce Backend SLO`, xác nhận panels có dữ liệu sau khi tạo order/webhook.
- Chuyển alert rules từ baseline local sang kênh cảnh báo thật: Slack/Email/PagerDuty tùy môi trường.
- Đặt SLO ban đầu cho checkout latency, HTTP 5xx, webhook failure rate, notification DLT rate.

## P2 - Kubernetes Rollout

- Tạo overlay riêng cho staging/prod: image registry tags, resource sizing, ingress/TLS, secrets, config maps.
- Thay placeholder secrets trong `backend/k8s/base/secrets.yaml` bằng External Secrets/Sealed Secrets hoặc secret manager.
- Thử rollout từng service: gateway trước, sau đó user/catalog/commerce/chat/assistant.
- Kiểm tra readiness/liveness, HPA scale behavior, graceful shutdown, và rollback.

## P2 - CI/CD

- Đảm bảo pipeline build image chạy `spring-boot:repackage` và push image theo commit SHA.
- Thêm bước smoke test container: `java -jar` boot được hoặc `/actuator/health/readiness` trả `UP`.
- Thêm deployment promotion: dev -> staging -> prod, có rollback rõ ràng.

## P3 - Cleanup/Hardening

- Giảm log noise Spring Data Redis repository scanning nếu cần bằng cấu hình repository scanning rõ hơn.
- Rà lại `.env` local và secret rotation trước khi dùng staging/prod.
- Kiểm tra dữ liệu outbox `pending`: trong Kafka-only runtime đây là trạng thái CDC-owned, không phải lỗi poller.
