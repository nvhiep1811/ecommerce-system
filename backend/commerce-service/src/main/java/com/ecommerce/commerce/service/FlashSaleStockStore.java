package com.ecommerce.commerce.service;

public interface FlashSaleStockStore {

    void preload(Long campaignId, Long itemId, Integer stock, Integer perUserLimit);

    FlashSaleClaimResult claim(FlashSaleClaimCommand command, long ttlSeconds);

    void release(Long campaignId, Long itemId, String reservationToken);
}
