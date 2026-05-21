package com.ecommerce.commerce.service;

public interface FlashSaleEventPublisher {

    void publishReservationClaimed(FlashSaleEventPayload payload);
}
