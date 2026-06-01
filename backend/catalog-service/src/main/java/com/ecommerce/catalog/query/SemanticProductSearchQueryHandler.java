package com.ecommerce.catalog.query;

import com.ecommerce.catalog.dto.ProductResponse;
import com.ecommerce.catalog.service.ProductQueryService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SemanticProductSearchQueryHandler {

    private final ProductQueryService productQueryService;

    public SemanticProductSearchQueryHandler(ProductQueryService productQueryService) {
        this.productQueryService = productQueryService;
    }

    public List<ProductResponse> handle(SemanticProductSearchQuery query) {
        return productQueryService.searchSemantic(query.query(), query.topK());
    }
}
