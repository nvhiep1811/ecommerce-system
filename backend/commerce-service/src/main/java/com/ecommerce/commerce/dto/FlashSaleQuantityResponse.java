package com.ecommerce.commerce.dto;

public class FlashSaleQuantityResponse {
    private Long quantity;
    private String timestamp;

    public FlashSaleQuantityResponse(Long quantity, String timestamp) {
        this.quantity = quantity;
        this.timestamp = timestamp;
    }

    public Long getQuantity() {
        return quantity;
    }

    public String getTimestamp() {
        return timestamp;
    }
}
