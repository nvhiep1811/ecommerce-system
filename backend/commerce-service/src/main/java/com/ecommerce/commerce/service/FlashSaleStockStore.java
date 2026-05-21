package com.ecommerce.commerce.service;

public interface FlashSaleStockStore {

    void preload(Long campaignId, Long itemId, Integer stock, Integer perUserLimit);

    FlashSaleClaimResult claim(FlashSaleClaimCommand command, long ttlSeconds);

    FlashSaleConfirmResult confirm(Long campaignId, Long itemId, String reservationToken, java.util.UUID userId, Integer quantity);

    void restoreConfirmed(Long campaignId, Long itemId, java.util.UUID userId, Integer quantity);

    FlashSaleReleaseResult release(Long campaignId, Long itemId, String reservationToken);

    java.util.List<FlashSaleActiveItem> activeItems();

    java.util.List<String> expiredReservationTokens(Long campaignId, Long itemId, long nowEpochSeconds, int limit);
}
