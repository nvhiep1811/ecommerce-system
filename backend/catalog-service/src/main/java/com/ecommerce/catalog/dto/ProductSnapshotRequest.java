package com.ecommerce.catalog.dto;

import java.util.List;

public record ProductSnapshotRequest(
        List<Long> productIds
) {
}
