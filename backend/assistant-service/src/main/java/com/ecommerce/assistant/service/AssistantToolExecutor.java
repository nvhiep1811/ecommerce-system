package com.ecommerce.assistant.service;

import com.ecommerce.assistant.client.CatalogClient;
import com.ecommerce.assistant.client.CommerceClient;
import com.ecommerce.assistant.dto.AssistantActionDto;
import com.ecommerce.assistant.dto.SuggestedProductDto;
import com.google.genai.types.FunctionCall;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class AssistantToolExecutor {

    private final CatalogClient catalogClient;
    private final CommerceClient commerceClient;

    public Map<String, Object> execute(FunctionCall functionCall, String authorization, List<SuggestedProductDto> suggestedProducts, List<AssistantActionDto> actions) {
        String name = functionCall.name().orElse(null);
        Map<String, Object> args = functionCall.args().orElse(new HashMap<>());
        if (args == null) {
            args = new HashMap<>();
        }

        try {
            switch (name) {
                case "search_products":
                    return executeSearchProducts(args, suggestedProducts, actions);
                case "get_product_detail":
                    return executeGetProductDetail(args, actions);
                case "get_my_orders":
                    return executeGetMyOrders(authorization, args);
                case "get_order_detail":
                    return executeGetOrderDetail(authorization, args);
                case "get_payment_status":
                    return executeGetPaymentStatus(authorization, args);
                default:
                    return Map.of("error", "Unknown tool: " + name);
            }
        } catch (Exception e) {
            log.error("Error executing tool {}", name, e);
            return Map.of("error", "TOOL_EXECUTION_ERROR", "message", "There was an error executing the requested tool.");
        }
    }

    private Map<String, Object> executeSearchProducts(Map<String, Object> args, List<SuggestedProductDto> suggestedProducts, List<AssistantActionDto> actions) {
        String search = (String) args.get("search");
        Long categoryId = getLong(args.get("categoryId"));
        Boolean featured = (Boolean) args.get("featured");
        Integer page = getInteger(args.get("page"));
        Integer size = getInteger(args.get("size"));
        String sort = (String) args.get("sort");
        String direction = (String) args.get("direction");

        var response = catalogClient.searchProducts(search, categoryId, featured, page, size, sort, direction);
        
        // Add to suggested products
        if (response != null && response.getContent() != null) {
            for (var p : response.getContent()) {
                suggestedProducts.add(new SuggestedProductDto(
                        p.getId(), p.getName(), p.getDescription(), p.getThumbnail(),
                        p.getPrice(), p.getStock(), p.getRating(), p.getReviewCount(),
                        p.getBrand(), p.getSellerName()
                ));
            }
        }

        return Map.of("products", response != null ? response.getContent() : new ArrayList<>());
    }

    private Map<String, Object> executeGetProductDetail(Map<String, Object> args, List<AssistantActionDto> actions) {
        Long productId = getLong(args.get("productId"));
        var response = catalogClient.getProduct(productId);
        if (response != null) {
            actions.add(new AssistantActionDto("VIEW_PRODUCT", "Xem chi tiết " + response.getName(), String.valueOf(productId)));
        }
        return Map.of("product", response != null ? response : "Not found");
    }

    private Map<String, Object> executeGetMyOrders(String authorization, Map<String, Object> args) {
        if (authorization == null || authorization.isBlank()) {
            return authRequired();
        }
        String status = (String) args.get("status");
        var response = commerceClient.getMyOrders(authorization, status);
        return Map.of("orders", response != null ? response : new ArrayList<>());
    }

    private Map<String, Object> executeGetOrderDetail(String authorization, Map<String, Object> args) {
        if (authorization == null || authorization.isBlank()) {
            return authRequired();
        }
        Long orderId = getLong(args.get("orderId"));
        var response = commerceClient.getOrderDetail(authorization, orderId);
        return Map.of("order", response != null ? response : "Not found");
    }

    private Map<String, Object> executeGetPaymentStatus(String authorization, Map<String, Object> args) {
        if (authorization == null || authorization.isBlank()) {
            return authRequired();
        }
        Long orderId = getLong(args.get("orderId"));
        var response = commerceClient.getPaymentStatus(authorization, orderId);
        return Map.of("paymentStatus", response != null ? response : "Not found");
    }

    private Map<String, Object> authRequired() {
        return Map.of("error", "AUTH_REQUIRED", "message", "Bạn cần đăng nhập để xem thông tin này.");
    }

    private Long getLong(Object val) {
        if (val instanceof Number) return ((Number) val).longValue();
        if (val instanceof String) return Long.parseLong((String) val);
        return null;
    }

    private Integer getInteger(Object val) {
        if (val instanceof Number) return ((Number) val).intValue();
        if (val instanceof String) return Integer.parseInt((String) val);
        return null;
    }
}
