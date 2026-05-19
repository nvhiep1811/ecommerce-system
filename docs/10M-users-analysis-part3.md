# ShopVerse — Phân Tích & Nâng Cấp Hệ Thống Cho ≥10 Triệu Người Dùng

> **Phần 3/3: Tối Ưu Cục Bộ, CI/CD & Lộ Trình Triển Khai**

---

## 7. Tối Ưu Hóa Cục Bộ Trong Source Code (Local Optimizations)

Dù có hạ tầng khủng, code không được tối ưu vẫn sẽ làm sập hệ thống. Dựa trên source code hiện tại, đây là những điểm cần cấu hình lại:

### 7.1 Distributed Cache Với Redis

Xoá bỏ `ProductPageReadCache` (dùng ConcurrentHashMap nội bộ).
- Cài đặt **Spring Data Redis**.
- Áp dụng cấu hình TTL: Cache sản phẩm (5 phút), Cache danh mục (30 phút).
- Khi có sự kiện Cập nhật sản phẩm, xoá (invalidate) cache trên Redis. Do dùng Redis tập trung, tất cả các instances của `catalog-service` đều được cập nhật ngay lập tức.

### 7.2 Nâng Cấp Cấu Hình Resilience4j

Mặc định của dự án đang cho phép Bulkhead max 20, Circuit Breaker threshold 50%. Cần điều chỉnh để chịu tải 10M users:

```yaml
resilience4j:
  circuitbreaker:
    instances:
      catalogService:
        sliding-window-size: 100         # Đủ rộng để thu thập mẫu chính xác
        failure-rate-threshold: 40       # Giảm xuống 40% để ngắt mạch sớm hơn
        slow-call-rate-threshold: 80     # Nếu 80% request bị chậm
        slow-call-duration-threshold: 2s # Ngưỡng chậm là 2s
  bulkhead:
    instances:
      catalogService:
        max-concurrent-calls: 200        # Tăng limit khi auto-scale
        max-wait-duration: 50ms          # Trả lỗi ngay nếu hàng chờ đầy
```

### 7.3 Tuning HikariCP (Connection Pool)

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 30           # Phù hợp nếu dùng kèm PgBouncer
      minimum-idle: 10
      idle-timeout: 300000            # Giải phóng conn nhàn rỗi (5 mins)
      max-lifetime: 1800000           # Tái tạo kết nối (30 mins) để tránh leak
      connection-timeout: 5000        # Timeout kết nối DB nhanh, tránh treo thread
```

---

## 8. Observability & DevOps (Giám Sát Hệ Thống)

### 8.1 Giám Sát Cấp Độ Micro-Level (APM)

Với mô hình SBA phân tán ra nhiều instances, việc dò lỗi không thể dùng lệnh `tail -f log` được.
- Bổ sung thư viện **Micrometer Tracing** (tương thích Spring Boot 3).
- Mỗi request sẽ có 1 `traceId`. Gửi log tập trung về ELK Stack (Elasticsearch, Logstash, Kibana).
- Tích hợp **Prometheus + Grafana**: Giám sát JVM Memory, HikariCP Connection Pool, RabbitMQ/Kafka queue depth. Nếu queue depth quá cao → Bật cảnh báo (Alert) để scale thêm Consumer.

### 8.2 Tối Ưu Hóa CI/CD

Pipeline hiện tại trong `.gitlab-ci.yml` dừng lại ở bước `package` (đóng gói JAR file). Đối với dự án 10M users, Containerization là bắt buộc.

1. **Bổ sung Dockerfile**: Mỗi service (User, Catalog, Commerce) cần 1 Dockerfile build dựa trên Base image JRE 17 (như `eclipse-temurin:17-jre-alpine`).
2. **Push Registry**: GitLab CI tự động push Docker Image lên Container Registry sau khi Unit Test chạy pass.
3. **Triển Khai Bằng Kubernetes**: Viết Helm charts và cấu hình **HPA (Horizontal Pod Autoscaler)** để tự động nhân bản số lượng pods của `commerce-service` từ 3 lên 50 pods khi CPU Usage vượt qua 60% trong những khung giờ cao điểm.

---

## 9. Lộ Trình Triển Khai Khuyến Nghị (Roadmap)

Việc chuyển đổi không làm một lần (Big Bang), mà nên chia thành các bước lặp lại (Iterative):

### 🟢 Giai đoạn 1: Sửa Sai Tầng Ứng Dụng (1 Tháng)
- **Hành động**: Đưa Redis vào thay thế Local Cache. Chuyển đổi Rate Limiter của API Gateway sang Redis. Tinh chỉnh cấu hình HikariCP, Tomcat Thread Pool, Resilience4j.
- **Kết quả**: Cải thiện ngay lập tức độ ổn định dưới tải vừa, không còn sai lệch cache nội bộ.

### 🟡 Giai đoạn 2: Gia Cố Tầng Dữ Liệu (1-2 Tháng)
- **Hành động**: Thiết lập Read Replicas cho PostgreSQL. Triển khai PgBouncer. Refactor code để tách luồng read/write (dùng `@Transactional(readOnly = true)`).
- **Kết quả**: Giải quyết bài toán nghẽn cổ chai của Database. Sẵn sàng phục vụ lượng người xem (Browser/Read) tăng vọt.

### 🟠 Giai đoạn 3: Áp Dụng Event-Driven Bậc Cao (2 Tháng)
- **Hành động**: Cài đặt Kafka, cấu hình Debezium CDC thay cho RabbitMQ `@Scheduled`. Đẩy module xử lý gửi Email, đồng bộ Elasticsearch, hết hạn Payment sang Kafka Consumer chạy ngầm.
- **Kết quả**: Tối ưu tốc độ Checkout (giảm latency API), tăng sức chịu đựng (Throughput) cho các giao dịch quan trọng.

### 🔴 Giai đoạn 4: Vận Hành Space-Based Cho Flash Sale (Chạy Song Song)
- **Hành động**: Tách logic Flash Sale thành 1 flow riêng xử lý hoàn toàn trên Redis Cluster bằng Lua Script. Xây dựng Data Pump bằng Kafka để sync số liệu về PostgreSQL. Load Testing bằng K6 (như mục tiêu mô phỏng 10,000 concurrent requests).
- **Kết quả**: Hệ thống trở nên "Bất tử" (Indestructible) trước các đợt Flash Sale / Black Friday. Sẵn sàng đón >= 10,000,000 users.

> **Tài liệu tham chiếu:**
> - `10M-users-analysis-part1.md`: Đánh giá hiện trạng & Bottleneck của Service-Based Architecture.
> - `10M-users-analysis-part2.md`: Thiết kế Kiến trúc Event-Driven & Space-Based tích hợp.
> - `10M-users-analysis-part3.md`: Tối ưu mã nguồn, Cấu hình hệ thống và Lộ trình (File này).
