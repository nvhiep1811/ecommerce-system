# ShopVerse — Phân Tích & Nâng Cấp Hệ Thống Cho ≥10 Triệu Người Dùng

> **Phần 2/3: Kiến Trúc Nâng Cấp (SBA + Event-Driven + Space-Based)**

---

## 3. Tổng Quan Kiến Trúc Nâng Cấp

Giữ nguyên lõi **Service-Based Architecture**, chúng ta bổ sung các lớp bao bọc (Caching, Event-Broker, Processing Units) để hấp thụ (absorb) lưu lượng khổng lồ từ 10 triệu users.

```
┌─────────────────────────────────────────────────────────────────┐
│               HỆ THỐNG PHÂN TÁN CHO 10M+ USERS                 │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  CDN (CloudFront)│  │  WAF / DDoS Guard│                    │
│  └────────┬─────────┘  └────────┬─────────┘                    │
│           │                      │                              │
│  ┌────────▼──────────────────────▼─────────┐                    │
│  │   API Gateway (Spring Cloud Gateway)    │  Rate Limiting     │
│  │   + JWT Validation                      │  Circuit Breaker   │
│  └────────┬─────────────────────────┬──────┘                    │
│           │                         │                           │
│  ┌────────▼────────────────┐ ┌──────▼────────────────────────┐ │
│  │   SERVICE-BASED LAYER    │ │    SPACE-BASED LAYER         │ │
│  │    (Luồng bình thường)   │ │    (Module Flash Sale)       │ │
│  │                          │ │                              │ │
│  │ ┌────────┐ ┌───────────┐ │ │ ┌──────┐ ┌──────┐ ┌──────┐   │ │
│  │ │ User   │ │ Commerce  │ │ │ │ PU 1 │ │ PU 2 │ │ PU N │   │ │
│  │ │ Service│ │ Service   │ │ │ └──────┘ └──────┘ └──────┘   │ │
│  │ └────────┘ └───────────┘ │ │   (In-memory Processing)     │ │
│  │ ┌────────┐               │ │             │                │ │
│  │ │ Catalog│               │ │ ┌───────────▼──────────────┐ │ │
│  │ │ Service│               │ │ │   Redis Cluster (IMDG)   │ │ │
│  │ └────────┘               │ │ └──────────────────────────┘ │ │
│  └──────┬───────────────────┘ └─────────────┬────────────────┘ │
│         │                                   │                  │
│  ┌──────▼───────────────────────────────────▼──────────────┐   │
│  │                   EVENT-DRIVEN LAYER                     │   │
│  │     Kafka Cluster (Async Comms & Event Sourcing)         │   │
│  │   [order-events] [payment-events] [flash-sale-events]    │   │
│  └──────┬──────────────────────────────────────────────────┘   │
│         │                                                      │
│  ┌──────▼──────────────────────────────────────────────────┐   │
│  │                     DATA LAYER                          │   │
│  │   ┌───────────────┐ ┌──────────┐ ┌──────────────────┐   │   │
│  │   │ PgBouncer     │ │ Redis    │ │ Elasticsearch    │   │   │
│  │   ├───────────────┤ │ Cluster  │ │ (Search Engine)  │   │   │
│  │   │ PostgreSQL DB │ │ (Cache)  │ │                  │   │   │
│  │   └───────────────┘ └──────────┘ └──────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Áp Dụng Event-Driven Để Giảm Tải Commerce Service

Thay vì `commerce-service` phải gồng gánh toàn bộ flow một cách đồng bộ (sync), chúng ta "chẻ" luồng xử lý ra.

### 4.1. Dùng Debezium (CDC) Làm Outbox Relay

Cơ chế relay bằng `@Scheduled` đã được loại bỏ để tránh polling chậm. Áp dụng Change Data Capture (CDC):
1. **Hoạt động**: `commerce-service` lưu order vào DB + ghi 1 record vào bảng `outbox_events` (trong cùng 1 transaction).
2. **Debezium**: Lắng nghe transaction log (WAL) của PostgreSQL. Gần như ngay lập tức (real-time) bắt được record ở bảng `outbox` và đẩy (publish) vào **Kafka**.
3. **Kết quả**: Bỏ hoàn toàn thread chạy ngầm (polling), tăng throughput từ vài events/giây lên hàng trăm ngàn events/giây và gom event backbone về một nền tảng Kafka duy nhất.

### 4.2. Xử Lý Bất Đồng Bộ (Async Handlers)

Sử dụng Kafka để xử lý hậu kiểm, giải phóng thread cho API Checkout càng nhanh càng tốt.

- **Notification (Email/SMS)**: Tách logic gửi email ra khỏi `commerce-service` (hoặc chạy trong background consumer). `commerce-service` chỉ cần publish event `ORDER_PLACED`.
- **Payment Expiration**: Không dùng Kafka như delayed queue. `ORDER_PAYMENT_PENDING` được consume từ Kafka để schedule `paymentId` vào Redis sorted-set theo `expiredAt`; worker chỉ lấy payment đến hạn từ Redis và expire theo ID trong transaction. PostgreSQL vẫn là source of truth, Redis chỉ là timing index.

---

## 5. Áp Dụng Space-Based Architecture (SBA) Cho Flash Sale

Space-Based Architecture cực kỳ hoàn hảo cho bài toán Flash Sale, nơi mà bottleneck nằm ở Database write-locks.

### 5.1 Kiến Trúc Xử Lý Trên Bộ Nhớ (IMDG - In-Memory Data Grid)

Trong giờ Flash Sale, chúng ta bỏ qua hoàn toàn Database truyền thống (PostgreSQL). Mọi thao tác đặt hàng, trừ tồn kho diễn ra hoàn toàn trên RAM.

1. **Processing Units (PUs)**: Các instances của `commerce-service` được scale mạnh lên (auto-scaling x50). PUs không nối với Database mà nối thẳng với Redis Cluster.
2. **Redis Lua Scripting (Tính Nguyên Tử - Atomic)**: Sử dụng Lua Script để kiểm tra tồn kho và trừ kho cùng lúc trên Redis, giải quyết bài toán Race Condition mà không cần Database Lock.

**Luồng hoạt động (Data Pump):**
- User bấm Mua Hàng → PU nhận request → Gọi Redis Lua Script trừ kho.
- Nếu thành công → Ghi vào hàng đợi Kafka (Topic: `flash-sale-orders`). PU trả về response "Thành công" ngay lập tức cho user (< 50ms).
- **Data Pump (Asynchronous Updater)**: Một worker phía sau chạy từ tốn, đọc từ Kafka và `INSERT` orders, trừ inventory vào PostgreSQL dần dần để lưu trữ vĩnh viễn (Eventual Consistency). Database lúc này không bao giờ bị quá tải.

### 5.2 Mã Giả Lua Script Chống Overselling

```lua
-- Kiểm tra tồn kho và mua hàng chỉ với 1 thao tác (Atomic)
local product_key = KEYS[1]
local user_bought_key = KEYS[2]
local user_id = ARGV[1]

-- 1. Check user đã mua chưa (giới hạn 1 món/người)
if redis.call('SISMEMBER', user_bought_key, user_id) == 1 then
    return -1 -- "Đã mua rồi"
end

-- 2. Check tồn kho
local stock = tonumber(redis.call('GET', product_key))
if stock and stock > 0 then
    redis.call('DECR', product_key)
    redis.call('SADD', user_bought_key, user_id)
    return 1 -- "Mua thành công"
else
    return 0 -- "Hết hàng"
end
```

---

## 6. Tối Ưu Hóa Tầng Dữ Liệu (Shared Database Optimizations)

Vì chúng ta giữ mô hình Service-Based (dùng chung 1 DB hoặc 1 DB Instance), Database sẽ là "trái tim" của hệ thống. Cần bảo vệ nó bằng mọi giá.

### 6.1. Connection Pooling Nâng Cao (PgBouncer)

Không kết nối trực tiếp các instances của Spring Boot tới PostgreSQL. Hãy đặt **PgBouncer** ở giữa.
- Các services mở 500 connections tới PgBouncer.
- PgBouncer chỉ mở tối đa 50 connections thực tế tới PostgreSQL, và luân chuyển (multiplex) các query rất nhanh. Giúp Database không bị nghẽn RAM và CPU do handle quá nhiều TCP connections.

### 6.2. CQRS (Command Query Responsibility Segregation) Trên Cùng 1 DB

- **Read Replica**: Setup PostgreSQL Replication. Các thao tác ghi (Checkout, Update Profile) trỏ tới Primary Node. Toàn bộ thao tác đọc (`catalog-service` get danh sách sản phẩm) trỏ tới Read Replicas (có thể có 2-3 replicas).
- Spring Boot hỗ trợ cấu hình đa `DataSource` thông qua annotation `@Transactional(readOnly = true)` để tự động định tuyến (route) câu query sang Replica.

### 6.3 Tích Hợp Elasticsearch Cho Tìm Kiếm

Khi lượng sản phẩm lên hàng triệu, việc dùng `LIKE` hay `pg_trgm` GIN index trên PostgreSQL cho tính năng tìm kiếm (Search) sẽ ăn mòn CPU của DB, ảnh hưởng luồng Checkout.
- **Giải pháp**: Đồng bộ danh mục sản phẩm từ Database sang Elasticsearch thông qua Logstash hoặc Kafka (CDC).
- Chuyển toàn bộ API tìm kiếm, filter theo giá, rating sang truy vấn Elasticsearch. Tốc độ sẽ giảm từ 500ms xuống còn <50ms và giảm tải hoàn toàn cho Primary DB.
