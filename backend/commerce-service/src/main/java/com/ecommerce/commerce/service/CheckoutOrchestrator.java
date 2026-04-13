package com.ecommerce.commerce.service;

import com.ecommerce.commerce.client.CatalogClient;
import com.ecommerce.commerce.client.UserClient;
import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.domain.OrderItemEntity;
import com.ecommerce.commerce.dto.AddressSnapshotResponse;
import com.ecommerce.commerce.dto.CouponValidationResponse;
import com.ecommerce.commerce.dto.OrderLineRequest;
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.dto.PlaceOrderRequest;
import com.ecommerce.commerce.dto.ProductSnapshotResponse;
import com.ecommerce.commerce.repository.OrderItemRepository;
import com.ecommerce.commerce.repository.OrderRepository;
import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.web.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CheckoutOrchestrator {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final UserClient userClient;
    private final CatalogClient catalogClient;
    private final InventoryService inventoryService;
    private final PaymentService paymentService;
    private final OrderQueryService orderQueryService;
    private final OutboxService outboxService;

    public CheckoutOrchestrator(
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            UserClient userClient,
            CatalogClient catalogClient,
            InventoryService inventoryService,
            PaymentService paymentService,
            OrderQueryService orderQueryService,
            OutboxService outboxService
    ) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.userClient = userClient;
        this.catalogClient = catalogClient;
        this.inventoryService = inventoryService;
        this.paymentService = paymentService;
        this.orderQueryService = orderQueryService;
        this.outboxService = outboxService;
    }

    @Transactional
    public OrderResponse placeOrder(AuthenticatedUser principal, PlaceOrderRequest request) {
        AddressSnapshotResponse address = userClient.getAddress(request.addressId());
        List<ProductSnapshotResponse> snapshots = catalogClient.getProductSnapshots(
                request.items().stream().map(OrderLineRequest::productId).toList()
        );

        Map<Long, ProductSnapshotResponse> snapshotMap = snapshots.stream()
                .collect(Collectors.toMap(ProductSnapshotResponse::productId, Function.identity()));

        request.items().forEach(item -> {
            ProductSnapshotResponse snapshot = snapshotMap.get(item.productId());
            if (snapshot == null || !snapshot.active()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "Product " + item.productId() + " is unavailable");
            }
        });

        BigDecimal subtotal = request.items().stream()
                .map(item -> snapshotMap.get(item.productId()).price().multiply(BigDecimal.valueOf(item.quantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        CouponValidationResponse couponValidation = null;
        BigDecimal discount = BigDecimal.ZERO;
        if (request.couponCode() != null && !request.couponCode().isBlank()) {
            couponValidation = catalogClient.validateCoupon(request.couponCode(), subtotal);
            if (!couponValidation.valid()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, couponValidation.message());
            }
            discount = couponValidation.discount().setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal shippingFee = BigDecimal.valueOf(5).setScale(2, RoundingMode.HALF_UP);
        BigDecimal tax = subtotal.multiply(BigDecimal.valueOf(0.10)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = subtotal.add(shippingFee).add(tax).subtract(discount).setScale(2, RoundingMode.HALF_UP);

        OrderEntity order = new OrderEntity();
        order.setOrderNo(generateOrderNo());
        order.setUserId(UUID.fromString(principal.userId()));
        order.setCouponId(couponValidation != null && couponValidation.coupon() != null ? couponValidation.coupon().id() : null);
        order.setCouponCode(couponValidation != null && couponValidation.coupon() != null ? couponValidation.coupon().code() : null);
        order.setShippingMethodName("Standard Delivery");
        order.setOrderStatus("pending");
        order.setPaymentStatus("unpaid");
        order.setFulfillmentStatus("pending");
        order.setReceiverName(address.fullName());
        order.setReceiverPhone(address.phone());
        order.setShippingAddressLine(address.addressLine());
        order.setShippingCity(address.city());
        order.setShippingProvince(address.province());
        order.setShippingPostalCode(address.postalCode());
        order.setShippingCountry("Vietnam");
        order.setPaymentMethodCode(normalizePaymentMethod(request.paymentMethod()));
        order.setSubtotal(subtotal);
        order.setShippingFee(shippingFee);
        order.setTaxAmount(tax);
        order.setDiscountAmount(discount);
        order.setGrandTotal(total);
        order.setPlacedAt(OffsetDateTime.now());

        OrderEntity savedOrder = orderRepository.save(order);

        List<OrderItemEntity> orderItems = request.items().stream()
                .map(item -> {
                    ProductSnapshotResponse snapshot = snapshotMap.get(item.productId());
                    OrderItemEntity entity = new OrderItemEntity();
                    entity.setOrderId(savedOrder.getId());
                    entity.setProductId(item.productId());
                    entity.setVariantId(item.variantId());
                    entity.setProductName(snapshot.name());
                    entity.setVariantName(null);
                    entity.setSku(snapshot.sku());
                    entity.setThumbnailUrl(snapshot.thumbnailUrl());
                    entity.setUnitPrice(snapshot.price());
                    entity.setQuantity(item.quantity());
                    entity.setLineTotal(snapshot.price().multiply(BigDecimal.valueOf(item.quantity())).setScale(2, RoundingMode.HALF_UP));
                    entity.setCreatedAt(OffsetDateTime.now());
                    return entity;
                })
                .toList();

        orderItemRepository.saveAll(orderItems);
        inventoryService.reserve(savedOrder.getId(), request.items());
        paymentService.createInitialPayment(savedOrder);

        if (couponValidation != null && couponValidation.coupon() != null) {
            catalogClient.consumeCoupon(couponValidation.coupon().id(), savedOrder.getUserId(), savedOrder.getId());
        }

        outboxService.publish("ORDER", savedOrder.getId().toString(), "ORDER_CREATED", Map.of(
                "orderId", savedOrder.getId(),
                "userId", savedOrder.getUserId(),
                "total", savedOrder.getGrandTotal()
        ));

        return orderQueryService.getInternal(savedOrder.getId());
    }

    private String normalizePaymentMethod(String paymentMethod) {
        if (paymentMethod == null || paymentMethod.isBlank()) {
            return "COD";
        }

        return switch (paymentMethod.trim().toUpperCase()) {
            case "MEGAPAY", "MOMO" -> "MOMO";
            case "CARD" -> "CARD";
            case "BANK_TRANSFER" -> "BANK_TRANSFER";
            case "VNPAY" -> "VNPAY";
            case "PAYPAL" -> "PAYPAL";
            default -> "COD";
        };
    }

    private String generateOrderNo() {
        return "ORD-" + OffsetDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) + "-"
                + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    }
}
