package com.ecommerce.commerce.dto;

public class FlashSaleEventProcessedResponse {
    private boolean processed;
    private String timestamp;

    public FlashSaleEventProcessedResponse(boolean processed, String timestamp) {
        this.processed = processed;
        this.timestamp = timestamp;
    }

    public boolean isProcessed() {
        return processed;
    }

    public String getTimestamp() {
        return timestamp;
    }
}
