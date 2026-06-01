package com.ecommerce.commerce.repository;

import java.util.UUID;

public interface OrderSellerSummaryProjection {

    Long getOrderId();

    UUID getSellerId();

    String getSellerName();

    Long getItemCount();
}
