# ShopVerse — Phân Tích & Nâng Cấp Hệ Thống Cho ≥10 Triệu Người Dùng

> **Phần 1/3: Đánh Giá Hiện Trạng & Phân Tích Nút Thắt (Bottlenecks)**

---

## 1. Tổng Quan Hệ Thống Hiện Tại (Service-Based Architecture)

Hệ thống hiện tại đang đi đúng hướng với mô hình **Service-Based Architecture (SBA)**. Việc giữ nguyên SBA là quyết định rất hợp lý, giúp tránh sự phức tạp quá mức (complexity overhead) của Microservices (phân tán transaction, network latency, data synchronization) trong khi vẫn đảm bảo khả năng scale và maintain.

### 1.1 Cấu Trúc Domain Hiện Tại

| Thành phần | Vai trò | Chịu tải |
|---|---|---|
| `api-gateway` | Spring Cloud Gateway, routing, CORS | Trung bình |
| `user-service` | Auth (JWT), Profile, Address, OTP | Trung bình |
| `catalog-service` | Categories, Products, Coupons, Reviews, Favourites | **Rất Cao** (Read-heavy) |
| `commerce-service` | Checkout orchestrator, Orders, Inventory, Payments (SePay/VietQR) | **Cao** (Write-heavy) |
| `shared-database` | PostgreSQL/RDS, 1 Database duy nhất | **Điểm nghẽn chính** |

### 1.2 Điểm Sáng Trong Thiết Kế Hiện Tại

- Đã phân chia domain khá rõ ràng (User, Catalog, Commerce) ở tầng ứng dụng.
- Đã áp dụng **Outbox Pattern** với `outbox_events` và Debezium/Kafka để đảm bảo tính nhất quán (Reliable Messaging).
- Áp dụng Resilience4j (Retry, Circuit Breaker, Bulkhead) bảo vệ các service call.
- Xử lý Inventory Reserve an toàn bằng Conditional Update.

---

## 2. Gap Analysis: Hiện Tại vs Yêu Cầu 10M+ Users

Dù SBA rất tốt, để phục vụ >= 10 triệu user (đặc biệt là các event Flash Sale, peak traffic), hệ thống đang gặp các giới hạn vật lý và kiến trúc cần được giải quyết bằng việc kết hợp các pattern khác (Event-Driven, Space-Based).

### 2.1 Bảng Phân Tích Gap

| Tiêu Chí | Hiện Trạng (SBA Thuần Tuý) | Yêu Cầu Để Scale (SBA Nâng Cấp) | Mức Độ |
|---|---|---|---|
| **Database Scaling** | Single DB Instance, dễ cạn kiệt Connection | Connection Pooling (PgBouncer), Read Replicas, Table Partitioning | 🔴 Critical |
| **Caching Layer** | Local Cache `ProductPageReadCache` (TTL 15s) | Distributed Cache (Redis Cluster) làm bộ đệm chính | 🔴 Critical |
| **Flash Sale Traffic** | Xử lý giao dịch trực tiếp trên Database | Space-Based Architecture (IMDG/Redis + In-memory Processing) | 🔴 Critical |
| **Event-Driven** | Outbox event đã bền vững, Kafka/Debezium là relay chính | Scale Kafka consumer, tối ưu Debezium connector, bổ sung DLT/lag alert | 🟡 High |
| **Search Catalog** | Truy vấn LIKE / `pg_trgm` GIN trực tiếp DB | Tích hợp Elasticsearch cho text search & filtering | 🟡 High |

### 2.2 Phân Tích Chi Tiết Các Bottleneck Chí Mạng

#### 🔴 Bottleneck #1: Shared Database Connection & Lock Contention

- **Cạn kiệt Connection**: Ở cấu trúc SBA dùng chung 1 DB, nếu 3 services cùng auto-scale lên 20 instances (tổng 60 instances), mỗi instance giữ 10-20 connections = 600-1200 concurrent connections. Một database PostgreSQL thông thường sẽ sập vì quá giới hạn kết nối (connection exhaustion).
- **Deadlock rủi ro**: Trong `commerce-service`, thao tác trừ kho (Inventory) là thao tác thay đổi trạng thái đồng bộ (`UPDATE inventory_items SET available_qty = ... WHERE ...`). Dưới tải Flash Sale, hàng chục ngàn người cùng tranh mua 1 món hàng sẽ dẫn đến nghẽn ở Row-level lock của PostgreSQL.

#### 🔴 Bottleneck #2: Thiết Kế Cache Nội Bộ (Local Cache)

- **Vấn đề**: `catalog-service` hiện dùng `ConcurrentHashMap` lưu 500 records. Khi scale out lên N instances, mỗi instance lại vào DB query để load cache của chính nó. Không những không giảm được bao nhiêu tải cho DB mà còn gây sai lệch dữ liệu (inconsistency) giữa các instances khi tồn kho hoặc giá sản phẩm thay đổi.

#### 🟡 Bottleneck #3: Synchronous API Calls Giữa Các Services

Trong `CheckoutOrchestrator`:
```java
userClient.getAddress();
catalogClient.getProductSnapshots();
catalogClient.validateCoupon();
```
Dù đã ở trong SBA, các luồng giao tiếp đồng bộ (HTTP/REST) khi chịu tải lớn sẽ tạo thành **Cascading Failure** (Lỗi dây chuyền). Ví dụ: `catalog-service` bị chậm → `commerce-service` bị giam thread (blocked) → API Gateway hết timeout → Toàn bộ hệ thống sập dẫu Database chưa quá tải.
bulkhead 20 concurrent request hiện tại quá bé so với lượng user 10M+.

#### 🟡 Bottleneck #4: Event Relay Cần Được Giám Sát Chặt

Code hiện tại đã bỏ polling và để Debezium CDC stream `outbox_events` sang Kafka.
- **Thực tế Flash Sale**: 1 phút có thể sinh ra 100,000 orders. Nếu Kafka Connect hoặc consumer lag tăng cao, event vẫn bền vững trong DB/Kafka nhưng email, projection, hoặc đồng bộ search sẽ bị trễ. Cần alert trên Kafka Connect status, consumer lag, WAL growth và DLT depth.

---

> **Kết luận phần 1:** Cấu trúc Service-Based hiện tại **KHÔNG CẦN đập đi xây lại** thành Microservices. Chúng ta chỉ cần giải quyết các vấn đề liên quan tới I/O (Database, Cache, Inter-service communication) bằng cách nhúng **Event-Driven Pattern** vào các luồng không cần phản hồi ngay, và nhúng **Space-Based Pattern** vào module Flash Sale. Chi tiết ở phần 2.
