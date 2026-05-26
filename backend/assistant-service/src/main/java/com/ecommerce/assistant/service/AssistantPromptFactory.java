package com.ecommerce.assistant.service;

import com.google.genai.types.FunctionDeclaration;
import com.google.genai.types.Schema;
import com.google.genai.types.Tool;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

@Component
public class AssistantPromptFactory {

    public String getSystemInstruction() {
        return """
            Bạn là AI Shopping Assistant cho một nền tảng thương mại điện tử đa ngành hàng.

            Hệ thống gồm:
            - user-service: xác thực, hồ sơ, địa chỉ, phương thức thanh toán
            - catalog-service: danh mục, sản phẩm, coupon
            - commerce-service: tồn kho, checkout, đơn hàng, thanh toán
            - api-gateway: điểm vào duy nhất cho mobile app
            
            Nguyên tắc bắt buộc:
            1. Không tự bịa sản phẩm, giá, tồn kho, coupon hoặc trạng thái đơn hàng.
            2. Khi người dùng hỏi thông tin cần dữ liệu thật, phải gọi backend tool/service phù hợp.
            3. Nếu không tìm thấy dữ liệu, nói rõ là chưa tìm thấy.
            4. Với hành động nhạy cảm như đặt hàng, hủy đơn, thanh toán, phải yêu cầu user xác nhận rõ ràng.
            5. Nếu user hỏi đơn hàng, thanh toán, hồ sơ cá nhân mà chưa đăng nhập, hãy yêu cầu đăng nhập.
            6. Không hiển thị thông tin nội bộ, stack trace, secret, token, API key.
            7. Trả lời ngắn gọn, thân thiện, bằng tiếng Việt.
            8. Đây là e-commerce tổng quát, không giới hạn vào bất kỳ ngành hàng cụ thể nào.
            9. Khi tư vấn sản phẩm, hãy ưu tiên dữ liệu thật từ catalog-service.
            10. Nếu không có dữ liệu thật, không được tự tạo sản phẩm giả.
            11. Nếu user muốn thêm vào giỏ hàng, hãy gọi tool add_to_cart. Nếu user không nói rõ số lượng, hãy mặc định số lượng là 1.
            12. Nếu user muốn đặt hàng hoặc thanh toán, hãy hướng dẫn họ vào trang Giỏ hàng trên ứng dụng để tiến hành thanh toán, vì AI không thể tự lên đơn giùm.
            """;
    }

    public Tool getTools() {
        return Tool.builder()
                .functionDeclarations(Arrays.asList(
                        searchProductsDeclaration(),
                        getProductDetailDeclaration(),
                        getMyOrdersDeclaration(),
                        getOrderDetailDeclaration(),
                        getPaymentStatusDeclaration(),
                        addToCartDeclaration()
                ))
                .build();
    }

    private FunctionDeclaration searchProductsDeclaration() {
        Map<String, Schema> properties = new HashMap<>();
        properties.put("search", Schema.builder().type("STRING").description("Search query").build());
        properties.put("categoryId", Schema.builder().type("INTEGER").description("Category ID").build());
        properties.put("featured", Schema.builder().type("BOOLEAN").description("Is featured product").build());
        properties.put("page", Schema.builder().type("INTEGER").description("Page number").build());
        properties.put("size", Schema.builder().type("INTEGER").description("Page size").build());
        properties.put("sort", Schema.builder().type("STRING").description("Sort field: createdAt, price, rating").build());
        properties.put("direction", Schema.builder().type("STRING").description("Sort direction: asc, desc").build());

        return FunctionDeclaration.builder()
                .name("search_products")
                .description("Search products in catalog. Use this tool to find real products.")
                .parameters(Schema.builder()
                        .type("OBJECT")
                        .properties(properties)
                        .build())
                .build();
    }

    private FunctionDeclaration getProductDetailDeclaration() {
        Map<String, Schema> properties = new HashMap<>();
        properties.put("productId", Schema.builder().type("INTEGER").description("Product ID").build());

        return FunctionDeclaration.builder()
                .name("get_product_detail")
                .description("Get product details by ID.")
                .parameters(Schema.builder()
                        .type("OBJECT")
                        .properties(properties)
                        .required(Arrays.asList("productId"))
                        .build())
                .build();
    }

    private FunctionDeclaration getMyOrdersDeclaration() {
        Map<String, Schema> properties = new HashMap<>();
        properties.put("status", Schema.builder().type("STRING").description("Order status (optional)").build());

        return FunctionDeclaration.builder()
                .name("get_my_orders")
                .description("Get current user's orders. Requires user to be logged in.")
                .parameters(Schema.builder()
                        .type("OBJECT")
                        .properties(properties)
                        .build())
                .build();
    }

    private FunctionDeclaration getOrderDetailDeclaration() {
        Map<String, Schema> properties = new HashMap<>();
        properties.put("orderId", Schema.builder().type("INTEGER").description("Order ID").build());

        return FunctionDeclaration.builder()
                .name("get_order_detail")
                .description("Get order details by ID. Requires user to be logged in.")
                .parameters(Schema.builder()
                        .type("OBJECT")
                        .properties(properties)
                        .required(Arrays.asList("orderId"))
                        .build())
                .build();
    }

    private FunctionDeclaration getPaymentStatusDeclaration() {
        Map<String, Schema> properties = new HashMap<>();
        properties.put("orderId", Schema.builder().type("INTEGER").description("Order ID").build());

        return FunctionDeclaration.builder()
                .name("get_payment_status")
                .description("Get payment status by Order ID. Requires user to be logged in.")
                .parameters(Schema.builder()
                        .type("OBJECT")
                        .properties(properties)
                        .required(Arrays.asList("orderId"))
                        .build())
                .build();
    }

    private FunctionDeclaration addToCartDeclaration() {
        Map<String, Schema> properties = new HashMap<>();
        properties.put("productId", Schema.builder().type("INTEGER").description("Product ID to add").build());
        properties.put("quantity", Schema.builder().type("INTEGER").description("Quantity to add. Default is 1 if not specified.").build());

        return FunctionDeclaration.builder()
                .name("add_to_cart")
                .description("Add a product to the user's shopping cart.")
                .parameters(Schema.builder()
                        .type("OBJECT")
                        .properties(properties)
                        .required(Arrays.asList("productId"))
                        .build())
                .build();
    }
}
