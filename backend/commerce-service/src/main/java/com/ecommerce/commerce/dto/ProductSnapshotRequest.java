package com.ecommerce.commerce.dto;

import java.util.List;

public record ProductSnapshotRequest(
        List<Long> productIds
) {
}
