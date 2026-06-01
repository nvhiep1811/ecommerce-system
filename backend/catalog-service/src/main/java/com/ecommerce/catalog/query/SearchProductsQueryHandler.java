package com.ecommerce.catalog.query;

import com.ecommerce.catalog.dto.ProductPageResponse;
import com.ecommerce.catalog.service.ProductQueryService;
import org.springframework.stereotype.Service;

@Service
public class SearchProductsQueryHandler {

    private final ProductQueryService productQueryService;

    public SearchProductsQueryHandler(ProductQueryService productQueryService) {
        this.productQueryService = productQueryService;
    }

    public ProductPageResponse handle(SearchProductsQuery query) {
        return productQueryService.getProducts(query.keyword(), query.categoryId(), query.page(), query.size());
    }
}
