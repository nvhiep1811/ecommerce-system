package com.ecommerce.commerce.notification;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Slf4j
@Component
public class OrderNotificationConsumer {

    private final MailService mailService;

    public OrderNotificationConsumer(MailService mailService) {
        this.mailService = mailService;
    }

    @RabbitListener(queues = "${events.rabbit.notification-email-queue:notification.email.order}")
    public void handle(JsonNode payload) {
        String email = text(payload, "userEmail");
        if (email == null || email.isBlank()) {
            log.warn("Skip order notification {} because userEmail is missing", text(payload, "eventType"));
            return;
        }

        EmailContent emailContent = buildEmail(payload);
        if (emailContent == null) {
            return;
        }
        try {
            mailService.send(email, emailContent.subject(), emailContent.body());
        } catch (Exception exception) {
            log.error("Failed to send order notification {} to {}", text(payload, "eventType"), email, exception);
        }
    }

    private EmailContent buildEmail(JsonNode payload) {
        String eventType = text(payload, "eventType");
        String orderCode = text(payload, "orderCode");
        String customerName = text(payload, "customerName");
        String paymentMethod = text(payload, "paymentMethod");
        String totalAmount = money(payload.path("totalAmount").decimalValue());
        return switch (eventType) {
            case "ORDER_CREATED" -> orderCreated(orderCode, customerName, paymentMethod, totalAmount);
            case "ORDER_PAYMENT_PENDING" -> paymentPending(orderCode, customerName, paymentMethod, totalAmount, payload);
            case "ORDER_PAID" -> new EmailContent(
                    "Thanh toán thành công cho đơn hàng " + orderCode,
                    "Chào " + customerName + "\n\nThanh toán cho đơn hàng " + orderCode
                            + " đã được xác nhận.\nTổng tiền: " + totalAmount
                            + ".\nThời gian thanh toán: " + text(payload, "paidAt")
                            + ".\nHệ thống sẽ tiếp tục xử lý đơn hàng."
            );
            case "PAYMENT_FAILED" -> new EmailContent(
                    "Thanh toán chưa hoàn tất cho đơn hàng " + orderCode,
                    "Chào " + customerName + "\n\nThanh toán cho đơn hàng " + orderCode
                            + " chưa hoàn tất hoặc đã bị hủy. Bạn có thể mở app và thử lại."
            );
            case "PAYMENT_EXPIRED" -> new EmailContent(
                    "Đơn hàng " + orderCode + " đã hết hạn thanh toán",
                    "Chào " + customerName + "\n\nĐơn hàng " + orderCode
                            + " chưa được thanh toán trong thời gian quy định. Bạn có thể tạo lại đơn hoặc thanh toán lại nếu hệ thống cho phép."
            );
            case "PAYMENT_MISMATCH" -> new EmailContent(
                    "Thanh toán đơn hàng " + orderCode + " cần được kiểm tra",
                    "Chào " + customerName + "\n\nHệ thống đã nhận thông tin thanh toán cho đơn hàng "
                            + orderCode + " nhưng số tiền chưa khớp. Bộ phận hỗ trợ sẽ kiểm tra trước khi xác nhận."
            );
            case "ORDER_STATUS_CHANGED" -> statusChanged(orderCode, customerName, text(payload, "status"));
            default -> null;
        };
    }

    private EmailContent orderCreated(String orderCode, String customerName, String paymentMethod, String totalAmount) {
        if ("COD".equalsIgnoreCase(paymentMethod)) {
            return new EmailContent(
                    "Đơn hàng " + orderCode + " đã được ghi nhận",
                    "Chào " + customerName + "\n\nĐơn hàng " + orderCode
                            + " đã được tạo thành công.\nPhương thức thanh toán: Thanh toán khi nhận hàng.\nTổng tiền: "
                            + totalAmount + ".\nĐơn hàng đang chờ người bán xác nhận."
            );
        }
        return new EmailContent(
                "Đơn hàng " + orderCode + " đã được tạo",
                "Chào " + customerName + "\n\nĐơn hàng " + orderCode
                        + " đã được tạo và đang chờ thanh toán.\nTổng tiền: " + totalAmount + "."
        );
    }

    private EmailContent paymentPending(String orderCode, String customerName, String paymentMethod, String totalAmount, JsonNode payload) {
        if ("SEPAY_QR".equalsIgnoreCase(paymentMethod)) {
            return new EmailContent(
                    "Hướng dẫn thanh toán đơn hàng " + orderCode,
                    "Chào " + customerName + "\n\nĐơn hàng " + orderCode
                            + " đã được tạo và đang chờ thanh toán.\nSố tiền cần thanh toán: " + totalAmount
                            + ".\nNội dung chuyển khoản: " + text(payload, "transferContent")
                            + ".\nHạn thanh toán: " + text(payload, "expiredAt")
                            + ".\nMã QR: " + text(payload, "qrCodeUrl")
            );
        }
        return new EmailContent(
                "Đơn hàng " + orderCode + " đang chờ thanh toán",
                "Chào " + customerName + "\n\nĐơn hàng " + orderCode
                        + " đang chờ thanh toán qua cổng thanh toán. Bạn có thể quay lại app để tiếp tục thanh toán."
        );
    }

    private EmailContent statusChanged(String orderCode, String customerName, String status) {
        return switch (status) {
            case "shipping" -> new EmailContent(
                    "Đơn hàng " + orderCode + " đang được giao",
                    "Chào " + customerName + "\n\nĐơn hàng " + orderCode + " đã được chuyển sang trạng thái giao hàng."
            );
            case "delivered" -> new EmailContent(
                    "Đơn hàng " + orderCode + " đã hoàn tất",
                    "Chào " + customerName + "\n\nĐơn hàng " + orderCode + " đã hoàn tất. Cảm ơn bạn đã mua hàng."
            );
            case "cancelled" -> new EmailContent(
                    "Đơn hàng " + orderCode + " đã bị hủy",
                    "Chào " + customerName + "\n\nĐơn hàng " + orderCode + " đã bị hủy."
            );
            case "confirmed" -> new EmailContent(
                    "Đơn hàng " + orderCode + " đã được xác nhận",
                    "Chào " + customerName + "\n\nNgười bán đã xác nhận đơn hàng " + orderCode + "."
            );
            default -> null;
        };
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? "" : value.asText();
    }

    private String money(BigDecimal amount) {
        return amount == null ? "0 VND" : amount.stripTrailingZeros().toPlainString() + " VND";
    }

    private record EmailContent(String subject, String body) {
    }
}
