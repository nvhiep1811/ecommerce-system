package com.ecommerce.assistant.client.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import lombok.Data;

public class ClientDtos {

    @Data
    public static class ProductResponse {
        private Long id;
        private String name;
        private String description;
        private String thumbnail;
        private BigDecimal price;
        private Integer stock;
        private BigDecimal rating;
        private Integer reviewCount;
        private String brand;
        private String sellerName;
    }

    @Data
    public static class ProductPageResponse {
        private List<ProductResponse> content;
        private int totalPages;
        private long totalElements;
        private int number;
        private int size;
    }

    @Data
    public static class OrderResponse {
        private Long id;
        private String status;
        private BigDecimal totalAmount;
        private Instant createdAt;
        private List<OrderLineResponse> items;
    }

    @Data
    public static class OrderLineResponse {
        private Long productId;
        private String productName;
        private Integer quantity;
        private BigDecimal price;
    }

    @Data
    public static class PaymentStatusResponse {
        private Long orderId;
        private String paymentStatus;
        private String paymentMethod;
    }

    @Data
    public static class OrderQuoteRequest {
        private Long addressId;
        private String couponCode;
        private String paymentMethod;
        private Long shippingMethodId;
        private List<OrderLineRequest> items;
    }

    @Data
    public static class OrderLineRequest {
        private Long productId;
        private Integer quantity;
    }

    @Data
    public static class OrderQuoteResponse {
        private BigDecimal subtotal;
        private BigDecimal discount;
        private BigDecimal shippingFee;
        private BigDecimal total;
    }
}
