package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.domain.OrderItemEntity;
import com.ecommerce.commerce.dto.AddressSnapshotResponse;
import com.ecommerce.commerce.dto.OrderLineRequest;
import com.ecommerce.commerce.dto.ProductSnapshotResponse;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
public class OrderFactory {

    /**
     * Build OrderEntity từ checkout context.
     * Không save — chỉ tạo object, việc save thuộc về Orchestrator.
     */
    public OrderEntity buildOrder(
            UUID userId,
            String clientRequestId,
            AddressSnapshotResponse address,
            CheckoutPricing pricing
    ) {
        OrderEntity order = new OrderEntity();
        order.setOrderNo(generateOrderNo());
        order.setClientRequestId(clientRequestId);
        order.setUserId(userId);
        order.setCouponId(pricing.couponId());
        order.setCouponCode(pricing.couponCode());
        order.setShippingMethodId(pricing.shippingMethodId());
        order.setShippingMethodName(pricing.shippingMethodName());

        if (PaymentConstants.ONLINE_SEPAY_METHODS.contains(pricing.paymentMethod())) {
            order.setOrderStatus(PaymentConstants.ORDER_PENDING_PAYMENT);
            order.setPaymentStatus(PaymentConstants.PAYMENT_PENDING);
        } else {
            order.setOrderStatus(PaymentConstants.ORDER_PENDING);
            order.setPaymentStatus(PaymentConstants.PAYMENT_UNPAID);
        }

        order.setFulfillmentStatus("pending");
        order.setReceiverName(address.fullName());
        order.setReceiverPhone(address.phone());
        order.setShippingAddressLine(address.addressLine());
        order.setShippingWard(address.ward());
        order.setShippingDistrict(address.district());
        order.setShippingCity(address.city());
        order.setShippingProvince(address.province());
        order.setShippingPostalCode(address.postalCode());
        order.setShippingCountry(
                address.country() == null || address.country().isBlank() ? "Việt Nam" : address.country()
        );
        order.setPaymentMethodCode(pricing.paymentMethod());
        order.setSubtotal(pricing.subtotal());
        order.setShippingFee(pricing.shippingFee());
        order.setTaxAmount(pricing.tax());
        order.setDiscountAmount(pricing.discount());
        order.setGrandTotal(pricing.total());
        order.setPlacedAt(OffsetDateTime.now());

        return order;
    }

    /**
     * Build danh sách OrderItemEntity từ order đã save và pricing.
     * Không save — chỉ tạo objects, việc save thuộc về Orchestrator.
     */
    public List<OrderItemEntity> buildOrderItems(Long orderId, List<OrderLineRequest> items, CheckoutPricing pricing) {
        return items.stream()
                .map(item -> {
                    String key = lineKey(item.productId(), item.variantId());
                    ProductSnapshotResponse snapshot = pricing.snapshotMap().get(key);
                    BigDecimal unitPrice = pricing.unitPrice(item);

                    OrderItemEntity entity = new OrderItemEntity();
                    entity.setOrderId(orderId);
                    entity.setProductId(item.productId());
                    entity.setVariantId(item.variantId());
                    entity.setProductName(snapshot.name());
                    entity.setVariantName(snapshot.variantName());
                    entity.setSku(snapshot.sku());
                    entity.setThumbnailUrl(snapshot.thumbnailUrl());
                    entity.setUnitPrice(unitPrice);
                    entity.setQuantity(item.quantity());
                    entity.setLineTotal(
                            unitPrice.multiply(BigDecimal.valueOf(item.quantity())).setScale(2, RoundingMode.HALF_UP)
                    );
                    entity.setCreatedAt(OffsetDateTime.now());
                    return entity;
                })
                .toList();
    }

    private String generateOrderNo() {
        return "ORD-" + OffsetDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) + "-"
                + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    }

    private static String lineKey(Long productId, Long variantId) {
        return productId + ":" + (variantId == null ? "" : variantId);
    }
}
