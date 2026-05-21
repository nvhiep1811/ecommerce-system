package com.ecommerce.commerce.service;

public interface FlashSaleEventPublisher {

    void publish(FlashSaleEventPayload payload);

    default void publishReservationClaimed(FlashSaleEventPayload payload) {
        publish(payload);
    }

    default void publishReservationExpired(FlashSaleEventPayload payload) {
        publish(payload);
    }
}
