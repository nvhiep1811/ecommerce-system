package com.ecommerce.catalog.query;

import com.ecommerce.catalog.dto.ProductPageResponse;
import com.ecommerce.catalog.service.ProductQueryService;
import org.springframework.stereotype.Service;

@Service
public class GetProductPageQueryHandler {

    private final ProductQueryService productQueryService;

    public GetProductPageQueryHandler(ProductQueryService productQueryService) {
        this.productQueryService = productQueryService;
    }

    public ProductPageResponse handle(GetProductPageQuery query) {
        return productQueryService.getProductsPage(query.page(), query.size(), query.categoryId(), query.sellerId(), query.keyword(), query.sort(), query.direction());
    }
}
