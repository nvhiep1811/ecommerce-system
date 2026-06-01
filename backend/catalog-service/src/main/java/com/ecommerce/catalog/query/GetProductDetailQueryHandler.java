package com.ecommerce.catalog.query;

import com.ecommerce.catalog.dto.ProductResponse;
import com.ecommerce.catalog.service.ProductQueryService;
import org.springframework.stereotype.Service;

@Service
public class GetProductDetailQueryHandler {

    private final ProductQueryService productQueryService;

    public GetProductDetailQueryHandler(ProductQueryService productQueryService) {
        this.productQueryService = productQueryService;
    }

    public ProductResponse handle(GetProductDetailQuery query) {
        return productQueryService.getProduct(query.productId());
    }
}
