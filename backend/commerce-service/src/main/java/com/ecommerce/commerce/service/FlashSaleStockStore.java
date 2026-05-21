package com.ecommerce.commerce.service;

public interface FlashSaleStockStore {

    void preload(Long campaignId, Long itemId, Integer stock, Integer perUserLimit);

    FlashSaleClaimResult claim(FlashSaleClaimCommand command, long ttlSeconds);

    FlashSaleReleaseResult release(Long campaignId, Long itemId, String reservationToken);

    java.util.List<FlashSaleActiveItem> activeItems();

    java.util.List<String> expiredReservationTokens(Long campaignId, Long itemId, long nowEpochSeconds, int limit);
}
