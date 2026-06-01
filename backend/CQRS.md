# CQRS Implementation Plan

## 1. Mục tiêu

Tài liệu này mô tả kế hoạch implement CQRS cho hệ thống `ecommerce-system` theo 3 phase đầu, phù hợp với kiến trúc hiện tại:

- Service-Based Architecture
- Spring Boot multi-module backend
- Shared PostgreSQL schema
- API Gateway
- Redis cache
- Kafka/Debezium/Outbox pattern
- Checkout Orchestrator trong `commerce-service`

Mục tiêu hiện tại là áp dụng CQRS ở **code layer**, chưa tách read/write database, chưa dùng read replica và chưa áp dụng Event Sourcing.

CQRS ở giai đoạn này dùng để:

- Tách rõ đường ghi và đường đọc.
- Giảm việc controller/service bị trộn nhiều trách nhiệm.
- Giữ nguyên business behavior hiện tại.
- Không phá vỡ Orchestrator Pattern.
- Chuẩn bị nền tảng cho read model/projection sau này nếu cần.

---

## 2. Nguyên tắc thiết kế

### 2.1. CQRS không thay thế Orchestrator Pattern

CQRS trả lời câu hỏi:

```text
Request này là command hay query?
```

Orchestrator Pattern trả lời câu hỏi:

```text
Một workflow ghi phức tạp cần điều phối những service nào, theo thứ tự nào?
```

Vì vậy CQRS và Orchestrator Pattern không mâu thuẫn nhau.

Trong hệ thống hiện tại:

```text
PlaceOrder = Command
CancelOrder = Command
UpdateOrderStatus = Command
GetMyOrders = Query
GetOrderDetail = Query
```

Còn `CheckoutOrchestrator` vẫn giữ vai trò điều phối workflow checkout/order creation.

---

## 3. Ranh giới đúng giữa CQRS và Orchestrator

### 3.1. Đường command

```text
OrderCommandController
        ↓
PlaceOrderCommandHandler
        ↓
CheckoutOrchestrator
        ↓
UserClient / CatalogClient / InventoryService / PaymentService / OutboxService
```

### 3.2. Đường query

```text
OrderQueryController
        ↓
OrderQueryHandler / OrderQueryService
        ↓
OrderRepository / OrderItemRepository / PaymentRepository
```

### 3.3. Nguyên tắc quan trọng

Command Handler **không thay thế** Orchestrator.

Command Handler chỉ là entry point cho use case command.

Ví dụ đúng:

```java
public OrderResponse handle(PlaceOrderCommand command) {
    return checkoutOrchestrator.placeOrder(command.principal(), command.request());
}
```

Ví dụ không nên làm:

```text
PlaceOrderCommandHandler
    ├── gọi UserClient
    ├── gọi CatalogClient
    ├── reserve inventory
    ├── create payment
    ├── publish outbox
    └── tự điều phối toàn bộ workflow
```

Nếu Command Handler tự làm toàn bộ workflow thì `CheckoutOrchestrator` sẽ bị mất vai trò. Đây là hướng không nên dùng.

---

# Phase 1: CQRS nhẹ trong `commerce-service`

## 1. Mục tiêu phase 1

Phase 1 chỉ tách đường command/query trong `commerce-service`, không đổi database, không đổi API contract, không đổi business logic.

Mục tiêu:

- Tách `OrderCommandController`.
- Tách `OrderQueryController`.
- Thêm command/query handler.
- Giữ `CheckoutOrchestrator` như hiện tại.
- Giữ `OrderQueryService`, `OrderManagementService`, `PaymentService`.
- Không thay đổi URL public nếu mobile-app/admin-web đang dùng.

---

## 2. Cấu trúc package đề xuất

```text
backend/commerce-service/src/main/java/com/ecommerce/commerce/
├── command/
│   ├── PlaceOrderCommand.java
│   ├── PlaceOrderCommandHandler.java
│   ├── QuoteOrderCommand.java
│   ├── QuoteOrderCommandHandler.java
│   ├── CancelOrderCommand.java
│   ├── CancelOrderCommandHandler.java
│   ├── AdvanceOrderCommand.java
│   ├── AdvanceOrderCommandHandler.java
│   ├── UpdateOrderStatusCommand.java
│   └── UpdateOrderStatusCommandHandler.java
│
├── query/
│   ├── GetMyOrdersQuery.java
│   ├── GetMyOrdersQueryHandler.java
│   ├── GetSellerOrdersQuery.java
│   ├── GetSellerOrdersQueryHandler.java
│   ├── GetAdminOrdersQuery.java
│   ├── GetAdminOrdersQueryHandler.java
│   ├── GetOrderDetailQuery.java
│   ├── GetOrderDetailQueryHandler.java
│   ├── GetOrderPaymentStatusQuery.java
│   └── GetOrderPaymentStatusQueryHandler.java
│
├── controller/
│   ├── OrderCommandController.java
│   ├── OrderQueryController.java
│   └── AdminOrderQueryController.java
│
├── service/
│   ├── CheckoutOrchestrator.java
│   ├── OrderQueryService.java
│   ├── OrderManagementService.java
│   ├── PaymentService.java
│   └── ...
```

---

## 3. Tách controller

### 3.1. `OrderCommandController`

Phụ trách các API ghi hoặc có khả năng thay đổi state.

```text
POST  /commerce/orders/quote
POST  /commerce/orders
PATCH /commerce/orders/{id}/status
POST  /commerce/orders/{id}/next
POST  /commerce/orders/{id}/cancel
```

Lưu ý: `quote` là read-only về mặt database, nhưng vẫn thuộc checkout use case. Có thể đặt trong command side hoặc checkout side để giữ gần `CheckoutOrchestrator`.

### 3.2. `OrderQueryController`

Phụ trách các API đọc.

```text
GET /commerce/orders/mine
GET /commerce/orders/seller
GET /commerce/orders/{id}
GET /commerce/orders/{id}/items
GET /commerce/orders/{id}/payment-status
```

### 3.3. `AdminOrderQueryController`

Phụ trách API đọc cho admin.

```text
GET /commerce/admin/orders
GET /admin/orders
```

Có thể giữ mapping cũ để không ảnh hưởng frontend.

---

## 4. Mapping handler trong phase 1

```text
QuoteOrderCommandHandler
    → CheckoutOrchestrator.quote(...)

PlaceOrderCommandHandler
    → CheckoutOrchestrator.placeOrder(...)

CancelOrderCommandHandler
    → OrderManagementService.cancel(...)

AdvanceOrderCommandHandler
    → OrderManagementService.advance(...)

UpdateOrderStatusCommandHandler
    → OrderManagementService.updateStatus(...)

GetMyOrdersQueryHandler
    → OrderQueryService.listMine(...)

GetSellerOrdersQueryHandler
    → OrderQueryService.listSeller(...)

GetAdminOrdersQueryHandler
    → OrderQueryService.listAdmin(...)

GetOrderDetailQueryHandler
    → OrderQueryService.getForUser(...)

GetOrderPaymentStatusQueryHandler
    → PaymentService.getPaymentStatus(...)
```

---

## 5. Ví dụ command object

```java
package com.ecommerce.commerce.command;

import com.ecommerce.commerce.dto.PlaceOrderRequest;
import com.ecommerce.shared.security.AuthenticatedUser;

public record PlaceOrderCommand(
        AuthenticatedUser principal,
        PlaceOrderRequest request
) {
}
```

---

## 6. Ví dụ command handler

```java
package com.ecommerce.commerce.command;

import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.service.CheckoutOrchestrator;
import org.springframework.stereotype.Service;

@Service
public class PlaceOrderCommandHandler {

    private final CheckoutOrchestrator checkoutOrchestrator;

    public PlaceOrderCommandHandler(CheckoutOrchestrator checkoutOrchestrator) {
        this.checkoutOrchestrator = checkoutOrchestrator;
    }

    public OrderResponse handle(PlaceOrderCommand command) {
        return checkoutOrchestrator.placeOrder(command.principal(), command.request());
    }
}
```

---

## 7. Ví dụ query object

```java
package com.ecommerce.commerce.query;

import com.ecommerce.shared.security.AuthenticatedUser;

public record GetMyOrdersQuery(
        AuthenticatedUser principal,
        String status
) {
}
```

---

## 8. Ví dụ query handler

```java
package com.ecommerce.commerce.query;

import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.service.OrderQueryService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class GetMyOrdersQueryHandler {

    private final OrderQueryService orderQueryService;

    public GetMyOrdersQueryHandler(OrderQueryService orderQueryService) {
        this.orderQueryService = orderQueryService;
    }

    public List<OrderResponse> handle(GetMyOrdersQuery query) {
        return orderQueryService.listMine(query.principal(), query.status());
    }
}
```

---

## 9. Kết quả mong muốn sau phase 1

Sau phase 1:

- Controller gọn hơn.
- Command và Query tách rõ.
- `CheckoutOrchestrator` không bị phá vỡ.
- Business logic gần như không đổi.
- API contract giữ nguyên.
- Không cần thay đổi database.
- Không cần thêm read replica.

---

# Phase 2: Refactor bên trong Checkout Orchestrator

## 1. Mục tiêu phase 2

Sau khi tách command/query ở phase 1, phase 2 refactor dần logic bên trong `CheckoutOrchestrator`.

Mục tiêu:

- Giảm kích thước `CheckoutOrchestrator`.
- Tách các trách nhiệm chuyên biệt thành service nhỏ.
- Vẫn giữ `CheckoutOrchestrator` là lớp điều phối chính.
- Không đưa workflow orchestration vào Command Handler.

---

## 2. Cấu trúc đề xuất

```text
backend/commerce-service/src/main/java/com/ecommerce/commerce/service/
├── CheckoutOrchestrator.java
├── CheckoutPricingService.java
├── CheckoutValidationService.java
├── OrderFactory.java
├── OrderPaymentCreator.java
├── OrderEventPublisher.java
├── CouponConsumptionService.java
├── FlashSaleCheckoutService.java
└── ...
```

---

## 3. Vai trò của từng thành phần

### 3.1. `CheckoutOrchestrator`

Giữ vai trò điều phối chính.

Nhiệm vụ:

```text
1. Nhận request place order
2. Kiểm tra idempotency
3. Lấy address snapshot từ user-service
4. Gọi CheckoutPricingService
5. Tạo OrderEntity thông qua OrderFactory
6. Lưu order và order items
7. Reserve inventory
8. Tạo payment
9. Confirm flash sale reservation nếu có
10. Consume coupon sau commit nếu có
11. Publish outbox event
12. Trả OrderResponse
```

### 3.2. `CheckoutPricingService`

Chỉ xử lý tính toán giá.

Nhiệm vụ:

```text
- Lấy product snapshot
- Validate product active/unavailable
- Tính unit price
- Áp dụng flash sale price
- Validate coupon
- Tính subtotal
- Tính tax
- Tính shipping fee
- Tính discount
- Tính grand total
```

### 3.3. `CheckoutValidationService`

Chỉ xử lý validation.

Nhiệm vụ:

```text
- Validate request items
- Validate payment method
- Validate shipping method
- Validate clientRequestId
- Validate flash sale reservation
```

### 3.4. `OrderFactory`

Chỉ tạo entity.

Nhiệm vụ:

```text
- Build OrderEntity
- Build OrderItemEntity
- Generate order number
- Set order status/payment status ban đầu
- Set shipping snapshot
- Set pricing snapshot
```

### 3.5. `OrderPaymentCreator`

Chỉ xử lý tạo payment ban đầu.

Nhiệm vụ:

```text
- Gọi PaymentService.createInitialPayment(...)
- Chuẩn hóa payment method
- Trả payment instruction nếu cần
```

### 3.6. `OrderEventPublisher`

Chỉ xử lý outbox event.

Nhiệm vụ:

```text
- Publish ORDER_CREATED
- Publish ORDER_CANCELLED
- Publish ORDER_STATUS_UPDATED
- Publish PAYMENT_STATUS_UPDATED
```

### 3.7. `CouponConsumptionService`

Chỉ xử lý consume coupon.

Nhiệm vụ:

```text
- Consume coupon sau khi transaction chính commit thành công
- Đảm bảo không consume coupon nếu order tạo thất bại
```

---

## 4. Luồng sau phase 2

```text
PlaceOrderCommandHandler
        ↓
CheckoutOrchestrator
        ├── CheckoutValidationService
        ├── UserClient
        ├── CheckoutPricingService
        │       ├── CatalogClient
        │       ├── ShippingMethodService
        │       └── FlashSaleCheckoutService
        ├── OrderFactory
        ├── OrderRepository
        ├── OrderItemRepository
        ├── InventoryService
        ├── OrderPaymentCreator
        ├── CouponConsumptionService
        ├── OrderEventPublisher
        └── OrderQueryService.getInternal(...)
```

---

## 5. Quy tắc giữ Orchestrator Pattern

Không để service con tự điều phối toàn bộ checkout.

Ví dụ:

- `CheckoutPricingService` không được tự tạo order.
- `OrderFactory` không được gọi payment.
- `OrderPaymentCreator` không được reserve inventory.
- `OrderEventPublisher` không được thay đổi order status.
- `CommandHandler` không được thay thế `CheckoutOrchestrator`.

Mỗi service chỉ làm một phần cụ thể. `CheckoutOrchestrator` quyết định thứ tự workflow.

---

## 6. Kết quả mong muốn sau phase 2

Sau phase 2:

- `CheckoutOrchestrator` vẫn tồn tại.
- Orchestrator Pattern rõ hơn, không bị phá.
- Logic checkout dễ test hơn.
- Pricing, validation, entity creation, payment, event publishing tách biệt.
- Dễ maintain khi thêm payment method, shipping method, flash sale hoặc coupon rule mới.

---

# Phase 3: CQRS cho `catalog-service`

## 1. Mục tiêu phase 3

Sau khi ổn định `commerce-service`, áp dụng CQRS tương tự cho `catalog-service`.

Lý do:

`CatalogService` hiện có cả read và write logic:

```text
- list products
- product page
- product detail
- semantic search
- get categories
- create product
- update product
- upload product image
- create/update/delete coupon
- validate coupon
- create/update embedding
- sync inventory
- evict product cache
- publish outbox event
```

Do đó cần tách read và write để code rõ ràng hơn.

---

## 2. Cấu trúc package đề xuất

```text
backend/catalog-service/src/main/java/com/ecommerce/catalog/
├── command/
│   ├── CreateProductCommand.java
│   ├── CreateProductCommandHandler.java
│   ├── UpdateProductCommand.java
│   ├── UpdateProductCommandHandler.java
│   ├── UploadProductImageCommand.java
│   ├── UploadProductImageCommandHandler.java
│   ├── CreateCouponCommand.java
│   ├── CreateCouponCommandHandler.java
│   ├── UpdateCouponCommand.java
│   ├── UpdateCouponCommandHandler.java
│   ├── DeleteCouponCommand.java
│   └── DeleteCouponCommandHandler.java
│
├── query/
│   ├── GetProductPageQuery.java
│   ├── GetProductPageQueryHandler.java
│   ├── GetProductDetailQuery.java
│   ├── GetProductDetailQueryHandler.java
│   ├── SearchProductsQuery.java
│   ├── SearchProductsQueryHandler.java
│   ├── SemanticProductSearchQuery.java
│   ├── SemanticProductSearchQueryHandler.java
│   ├── GetCategoriesQuery.java
│   ├── GetCategoriesQueryHandler.java
│   ├── GetCouponsQuery.java
│   ├── GetCouponsQueryHandler.java
│   ├── GetCouponDetailQuery.java
│   └── GetCouponDetailQueryHandler.java
│
├── controller/
│   ├── ProductCommandController.java
│   ├── ProductQueryController.java
│   ├── CouponCommandController.java
│   ├── CouponQueryController.java
│   └── CategoryQueryController.java
│
├── service/
│   ├── ProductCommandService.java
│   ├── ProductQueryService.java
│   ├── CouponCommandService.java
│   ├── CouponQueryService.java
│   ├── CategoryQueryService.java
│   ├── ProductPageReadCache.java
│   ├── ProductImageStorageService.java
│   └── OutboxService.java
```

---

## 3. Tách Product controller

### 3.1. `ProductQueryController`

Phụ trách API đọc:

```text
GET /catalog/products
GET /catalog/products/page
GET /catalog/products/semantic
GET /catalog/products/{id}
```

### 3.2. `ProductCommandController`

Phụ trách API ghi:

```text
POST /catalog/products
PUT  /catalog/products/{id}
POST /catalog/products/images
GET  /catalog/products/backfill-embeddings
```

Lưu ý:

`backfill-embeddings` hiện đang dùng `GET`, nhưng bản chất là mutation vì nó cập nhật embedding. Nên đổi thành:

```text
POST /catalog/products/backfill-embeddings
```

Nếu sợ ảnh hưởng client hiện tại, có thể giữ endpoint cũ tạm thời và đánh dấu deprecated.

---

## 4. Tách Coupon controller

### 4.1. `CouponQueryController`

Phụ trách API đọc:

```text
GET  /catalog/coupons
GET  /catalog/coupons/{id}
POST /catalog/coupons/validate
```

`validate coupon` không thay đổi state nên có thể coi là query, dù dùng POST vì body phức tạp.

### 4.2. `CouponCommandController`

Phụ trách API ghi:

```text
POST   /catalog/coupons
PUT    /catalog/coupons/{id}
DELETE /catalog/coupons/{id}
POST   /catalog/coupons/consume
```

`consume coupon` là command vì làm thay đổi usage count/coupon usage.

---

## 5. Tách service trong catalog

### 5.1. `ProductQueryService`

Nhiệm vụ:

```text
- getProducts
- getProductsPage
- searchSemantic
- getProduct
- getProductSnapshots
- loadStockMap
- loadSellerNameMap
- map ProductEntity → ProductResponse
```

### 5.2. `ProductCommandService`

Nhiệm vụ:

```text
- createProduct
- updateProduct
- saveProductEmbedding
- backfillEmbeddings
- sync inventory after product create/update
- evict ProductPageReadCache
- publish PRODUCT_CREATED / PRODUCT_UPDATED outbox event
- delete old managed product image if thumbnail changed
```

### 5.3. `CouponQueryService`

Nhiệm vụ:

```text
- getCoupons
- getCouponById
- validateCoupon
```

### 5.4. `CouponCommandService`

Nhiệm vụ:

```text
- createCoupon
- updateCoupon
- deleteCoupon
- consumeCoupon
- publish COUPON_CREATED / COUPON_UPDATED / COUPON_DELETED outbox event
```

### 5.5. `CategoryQueryService`

Nhiệm vụ:

```text
- getCategories
- resolveCategoryIds
```

Nếu sau này có admin CRUD category thì thêm:

```text
CategoryCommandService
```

---

## 6. Redis cache trong catalog

Giữ nguyên `ProductPageReadCache`.

Không cần tách read database.

Cơ chế hiện tại vẫn phù hợp:

```text
ProductQueryService
        ↓
ProductPageReadCache
        ↓
Redis hoặc local cache
        ↓
ProductRepository
```

Khi command thay đổi product:

```text
ProductCommandService
        ↓
save/update product
        ↓
sync inventory
        ↓
evict ProductPageReadCache
        ↓
publish outbox event
```

---

## 7. Kết quả mong muốn sau phase 3

Sau phase 3:

- `CatalogService` không còn ôm quá nhiều trách nhiệm.
- Product read và write tách rõ.
- Coupon read và write tách rõ.
- Cache nằm ở query side.
- Cache eviction nằm ở command side.
- Outbox event nằm ở command side.
- Không cần read replica.
- Không cần Event Sourcing.

---

# Những việc chưa làm trong 3 phase này

## 1. Chưa tách read/write database

Không dùng:

```text
primary database cho write
read replica cho read
```

Lý do:

- Chưa có bằng chứng DB bottleneck do read query.
- Hệ thống đã có Redis cache và index.
- Read replica làm tăng complexity.
- Có thể gặp replication lag.
- Người dùng vừa tạo đơn xong có thể chưa thấy đơn nếu đọc từ replica.

---

## 2. Chưa thêm read model/projection

Chưa cần tạo ngay:

```text
order_read_model
seller_order_summary
daily_revenue_summary
product_sales_summary
```

Các bảng này chỉ nên thêm khi:

```text
- admin dashboard chậm
- seller order list join quá nặng
- reporting query ảnh hưởng checkout
- PostgreSQL primary bị tải SELECT cao
```

---

## 3. Chưa dùng Event Sourcing

CQRS không bắt buộc Event Sourcing.

Hiện tại chỉ cần:

```text
Command Handler
Query Handler
Service tách trách nhiệm
Outbox event
Redis cache
PostgreSQL hiện tại
```

---

# Checklist implement

## Phase 1 checklist

```text
[ ] Tạo package commerce/command
[ ] Tạo package commerce/query
[ ] Tạo OrderCommandController
[ ] Tạo OrderQueryController
[ ] Tách AdminOrderQueryController nếu cần
[ ] Tạo PlaceOrderCommand + Handler
[ ] Tạo QuoteOrderCommand + Handler
[ ] Tạo CancelOrderCommand + Handler
[ ] Tạo AdvanceOrderCommand + Handler
[ ] Tạo UpdateOrderStatusCommand + Handler
[ ] Tạo GetMyOrdersQuery + Handler
[ ] Tạo GetSellerOrdersQuery + Handler
[ ] Tạo GetAdminOrdersQuery + Handler
[ ] Tạo GetOrderDetailQuery + Handler
[ ] Tạo GetOrderPaymentStatusQuery + Handler
[ ] Giữ CheckoutOrchestrator như hiện tại
[ ] Giữ API URL cũ
[ ] Chạy test mobile-app/admin-web
```

---

## Phase 2 checklist

```text
[ ] Tạo CheckoutPricingService
[ ] Tạo CheckoutValidationService
[ ] Tạo OrderFactory
[ ] Tạo OrderPaymentCreator
[ ] Tạo OrderEventPublisher
[ ] Tạo CouponConsumptionService nếu cần
[ ] Di chuyển logic pricing khỏi CheckoutOrchestrator
[ ] Di chuyển logic validate khỏi CheckoutOrchestrator
[ ] Di chuyển logic build entity khỏi CheckoutOrchestrator
[ ] Di chuyển logic publish event khỏi CheckoutOrchestrator
[ ] Giữ CheckoutOrchestrator là lớp điều phối chính
[ ] Không đưa orchestration logic vào Command Handler
[ ] Test lại checkout COD
[ ] Test lại checkout SePay QR/checkout
[ ] Test lại cancel/advance/update status
```

---

## Phase 3 checklist

```text
[ ] Tạo package catalog/command
[ ] Tạo package catalog/query
[ ] Tạo ProductCommandController
[ ] Tạo ProductQueryController
[ ] Tạo CouponCommandController
[ ] Tạo CouponQueryController
[ ] Tạo CategoryQueryController
[ ] Tạo ProductCommandService
[ ] Tạo ProductQueryService
[ ] Tạo CouponCommandService
[ ] Tạo CouponQueryService
[ ] Tạo CategoryQueryService
[ ] Di chuyển product list/page/detail/search sang ProductQueryService
[ ] Di chuyển create/update/backfill embedding sang ProductCommandService
[ ] Di chuyển coupon validate/list/detail sang CouponQueryService
[ ] Di chuyển coupon create/update/delete/consume sang CouponCommandService
[ ] Giữ ProductPageReadCache
[ ] Giữ cache eviction ở command side
[ ] Giữ outbox publish ở command side
[ ] Cân nhắc đổi GET backfill-embeddings thành POST
[ ] Test product listing mobile
[ ] Test product CRUD seller/admin
[ ] Test coupon validate/consume
```

---

# Kết luận

Trong 3 phase đầu, hệ thống chỉ cần CQRS ở code layer:

```text
Phase 1:
Tách command/query trong commerce-service, giữ CheckoutOrchestrator.

Phase 2:
Refactor bên trong CheckoutOrchestrator thành các service nhỏ, nhưng Orchestrator vẫn điều phối workflow.

Phase 3:
Áp dụng CQRS tương tự cho catalog-service.
```

Không làm trong giai đoạn này:

```text
- Không tách read/write database
- Không thêm read replica
- Không thêm Event Sourcing
- Không thêm read model nếu chưa có nhu cầu thực tế
```

Hướng phù hợp nhất hiện tại:

```text
CQRS nhẹ + Orchestrator Pattern + shared PostgreSQL + Redis cache + Outbox/Kafka cho mở rộng sau này
```
