package com.ecommerce.commerce.notification;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Locale;

@Slf4j
@Component
public class OrderNotificationConsumer {

    private static final Locale VIETNAMESE = Locale.forLanguageTag("vi-VN");
    private static final ZoneId VIETNAM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter EMAIL_DATE_TIME_FORMATTER =
            DateTimeFormatter.ofPattern("'ngày' dd/MM/yyyy 'lúc' HH:mm", VIETNAMESE);

    private final MailService mailService;

    public OrderNotificationConsumer(MailService mailService) {
        this.mailService = mailService;
    }

    @RabbitListener(queues = "${events.rabbit.notification-email-queue:notification.email.order}")
    public void handle(JsonNode payload) {
        try {
            String eventType = text(payload, "eventType");
            String email = firstNotBlank(text(payload, "userEmail"), text(payload, "customerEmail"), text(payload, "email"));
            if (email == null || email.isBlank()) {
                log.warn("Skip order notification {} because recipient email is missing", eventType);
                return;
            }

            EmailContent emailContent = buildEmail(payload);
            if (emailContent == null) {
                log.info("Skip order notification {} because no email template is configured", eventType);
                return;
            }

            mailService.send(email, emailContent.subject(), emailContent.body());
            log.info("Sent order notification {} for order {} to {}", eventType, text(payload, "orderCode"), email);
        } catch (Exception exception) {
            log.error("Failed to handle order notification {} for order {}", text(payload, "eventType"), text(payload, "orderCode"), exception);
        }
    }

    private EmailContent buildEmail(JsonNode payload) {
        String eventType = text(payload, "eventType");
        String orderCode = text(payload, "orderCode");
        String customerName = customerName(payload);
        String paymentMethod = text(payload, "paymentMethod");
        String totalAmount = money(payload.path("totalAmount").decimalValue());
        return switch (eventType) {
            case "ORDER_CREATED" -> orderCreated(orderCode, customerName, paymentMethod, totalAmount);
            case "ORDER_PAYMENT_PENDING" -> paymentPending(orderCode, customerName, paymentMethod, totalAmount, payload);
            case "ORDER_PAID" -> orderPaid(orderCode, customerName, totalAmount, payload);
            case "PAYMENT_FAILED" -> paymentFailed(orderCode, customerName, paymentMethod, totalAmount);
            case "PAYMENT_EXPIRED" -> paymentExpired(orderCode, customerName, totalAmount, payload);
            case "PAYMENT_MISMATCH" -> paymentMismatch(orderCode, customerName, totalAmount);
            case "ORDER_STATUS_CHANGED" -> statusChanged(orderCode, customerName, text(payload, "status"));
            default -> null;
        };
    }

    private EmailContent orderCreated(String orderCode, String customerName, String paymentMethod, String totalAmount) {
        if ("COD".equalsIgnoreCase(paymentMethod)) {
            return new EmailContent(
                    "Đơn hàng " + orderCode + " đã được ghi nhận",
                    greeting(customerName)
                            + "Cảm ơn bạn đã đặt hàng tại Mega Mall.\n\n"
                            + "Thông tin đơn hàng\n"
                            + "- Mã đơn hàng: " + orderCode + "\n"
                            + "- Phương thức thanh toán: Thanh toán khi nhận hàng (COD)\n"
                            + "- Tổng thanh toán: " + totalAmount + "\n"
                            + "- Trạng thái: Chờ người bán xác nhận\n\n"
                            + "Đơn hàng sẽ được người bán kiểm tra và xác nhận trong thời gian sớm nhất. "
                            + "Bạn có thể theo dõi trạng thái đơn hàng trong ứng dụng.\n\n"
                            + signature()
            );
        }
        return new EmailContent(
                "Đơn hàng " + orderCode + " đang chờ thanh toán",
                greeting(customerName)
                        + "Đơn hàng của bạn đã được tạo thành công và đang chờ hoàn tất thanh toán.\n\n"
                        + "Thông tin đơn hàng\n"
                        + "- Mã đơn hàng: " + orderCode + "\n"
                        + "- Phương thức thanh toán: " + paymentMethodName(paymentMethod) + "\n"
                        + "- Tổng thanh toán: " + totalAmount + "\n"
                        + "- Trạng thái: Chờ thanh toán\n\n"
                        + "Vui lòng mở ứng dụng để tiếp tục thanh toán và theo dõi trạng thái đơn hàng.\n\n"
                        + signature()
        );
    }

    private EmailContent paymentPending(String orderCode, String customerName, String paymentMethod, String totalAmount, JsonNode payload) {
        if ("SEPAY_QR".equalsIgnoreCase(paymentMethod)) {
            String transferContent = text(payload, "transferContent");
            String expiredAt = dateTime(text(payload, "expiredAt"));
            String qrCodeUrl = text(payload, "qrCodeUrl");
            String qrLine = qrCodeUrl.isBlank() ? "" : "- Mã QR: " + qrCodeUrl + "\n";
            return new EmailContent(
                    "Hướng dẫn thanh toán đơn hàng " + orderCode,
                    greeting(customerName)
                            + "Đơn hàng của bạn đã được tạo và đang chờ thanh toán bằng mã QR.\n\n"
                            + "Thông tin thanh toán\n"
                            + "- Mã đơn hàng: " + orderCode + "\n"
                            + "- Số tiền cần thanh toán: " + totalAmount + "\n"
                            + "- Nội dung chuyển khoản: " + fallback(transferContent, "Theo hướng dẫn trong ứng dụng") + "\n"
                            + "- Hạn thanh toán: " + expiredAt + "\n"
                            + qrLine
                            + "\nVui lòng chuyển khoản đúng số tiền và đúng nội dung để hệ thống xác nhận tự động. "
                            + "Trạng thái thanh toán sẽ được cập nhật sau khi cổng thanh toán gửi xác nhận.\n\n"
                            + signature()
            );
        }
        return new EmailContent(
                "Đơn hàng " + orderCode + " đang chờ thanh toán",
                greeting(customerName)
                        + "Đơn hàng của bạn đang chờ thanh toán qua cổng thanh toán online.\n\n"
                        + "Thông tin thanh toán\n"
                        + "- Mã đơn hàng: " + orderCode + "\n"
                        + "- Phương thức thanh toán: " + paymentMethodName(paymentMethod) + "\n"
                        + "- Tổng thanh toán: " + totalAmount + "\n"
                        + "- Trạng thái: Chờ thanh toán\n\n"
                        + "Bạn có thể quay lại ứng dụng để tiếp tục thanh toán. Đơn hàng chỉ được xác nhận sau khi cổng thanh toán phản hồi thành công.\n\n"
                        + signature()
        );
    }

    private EmailContent orderPaid(String orderCode, String customerName, String totalAmount, JsonNode payload) {
        return new EmailContent(
                "Thanh toán thành công cho đơn hàng " + orderCode,
                greeting(customerName)
                        + "Mega Mall đã nhận được xác nhận thanh toán cho đơn hàng của bạn.\n\n"
                        + "Thông tin thanh toán\n"
                        + "- Mã đơn hàng: " + orderCode + "\n"
                        + "- Số tiền đã thanh toán: " + totalAmount + "\n"
                        + "- Thời gian thanh toán: " + dateTime(text(payload, "paidAt")) + "\n"
                        + "- Trạng thái: Đã thanh toán\n\n"
                        + "Đơn hàng sẽ được chuyển sang bước xử lý tiếp theo. Bạn có thể theo dõi tiến trình giao hàng trong ứng dụng.\n\n"
                        + signature()
        );
    }

    private EmailContent paymentFailed(String orderCode, String customerName, String paymentMethod, String totalAmount) {
        return new EmailContent(
                "Thanh toán chưa hoàn tất cho đơn hàng " + orderCode,
                greeting(customerName)
                        + "Thanh toán cho đơn hàng của bạn chưa hoàn tất hoặc đã bị hủy.\n\n"
                        + "Thông tin đơn hàng\n"
                        + "- Mã đơn hàng: " + orderCode + "\n"
                        + "- Phương thức thanh toán: " + paymentMethodName(paymentMethod) + "\n"
                        + "- Tổng thanh toán: " + totalAmount + "\n"
                        + "- Trạng thái: Chưa thanh toán thành công\n\n"
                        + "Bạn có thể mở ứng dụng để thử lại phương thức thanh toán hoặc chọn phương thức khác nếu hệ thống hỗ trợ.\n\n"
                        + signature()
        );
    }

    private EmailContent paymentExpired(String orderCode, String customerName, String totalAmount, JsonNode payload) {
        return new EmailContent(
                "Đơn hàng " + orderCode + " đã hết hạn thanh toán",
                greeting(customerName)
                        + "Đơn hàng chưa được thanh toán trong thời gian quy định nên phiên thanh toán đã hết hạn.\n\n"
                        + "Thông tin đơn hàng\n"
                        + "- Mã đơn hàng: " + orderCode + "\n"
                        + "- Tổng thanh toán: " + totalAmount + "\n"
                        + "- Hạn thanh toán: " + dateTime(text(payload, "expiredAt")) + "\n"
                        + "- Trạng thái: Hết hạn thanh toán\n\n"
                        + "Bạn có thể tạo đơn hàng mới hoặc thanh toán lại nếu ứng dụng còn hỗ trợ thao tác này.\n\n"
                        + signature()
        );
    }

    private EmailContent paymentMismatch(String orderCode, String customerName, String totalAmount) {
        return new EmailContent(
                "Thanh toán đơn hàng " + orderCode + " cần được kiểm tra",
                greeting(customerName)
                        + "Hệ thống đã nhận được thông tin thanh toán nhưng số tiền chưa khớp với đơn hàng.\n\n"
                        + "Thông tin kiểm tra\n"
                        + "- Mã đơn hàng: " + orderCode + "\n"
                        + "- Số tiền đơn hàng: " + totalAmount + "\n"
                        + "- Trạng thái: Cần kiểm tra thanh toán\n\n"
                        + "Bộ phận hỗ trợ sẽ kiểm tra giao dịch trước khi xác nhận trạng thái đơn hàng. "
                        + "Vui lòng không thực hiện thanh toán lặp lại nếu bạn đã chuyển khoản.\n\n"
                        + signature()
        );
    }

    private EmailContent statusChanged(String orderCode, String customerName, String status) {
        return switch (normalizeStatus(status)) {
            case "confirmed" -> new EmailContent(
                    "Đơn hàng " + orderCode + " đã được xác nhận",
                    greeting(customerName)
                            + "Người bán đã xác nhận đơn hàng của bạn.\n\n"
                            + orderStatusBlock(orderCode, "Đã xác nhận")
                            + "Đơn hàng sẽ được chuẩn bị và chuyển sang bước giao hàng trong thời gian sớm nhất.\n\n"
                            + signature()
            );
            case "shipping" -> new EmailContent(
                    "Đơn hàng " + orderCode + " đang được giao",
                    greeting(customerName)
                            + "Đơn hàng của bạn đã được chuyển sang trạng thái giao hàng.\n\n"
                            + orderStatusBlock(orderCode, "Đang giao")
                            + "Vui lòng chú ý điện thoại để đơn vị vận chuyển có thể liên hệ khi cần.\n\n"
                            + signature()
            );
            case "delivered" -> new EmailContent(
                    "Đơn hàng " + orderCode + " đã hoàn tất",
                    greeting(customerName)
                            + "Đơn hàng của bạn đã được giao thành công.\n\n"
                            + orderStatusBlock(orderCode, "Hoàn tất")
                            + "Cảm ơn bạn đã mua sắm tại Mega Mall. Nếu có thời gian, bạn có thể đánh giá sản phẩm trong ứng dụng.\n\n"
                            + signature()
            );
            case "cancelled" -> new EmailContent(
                    "Đơn hàng " + orderCode + " đã bị hủy",
                    greeting(customerName)
                            + "Đơn hàng của bạn đã được cập nhật sang trạng thái hủy.\n\n"
                            + orderStatusBlock(orderCode, "Đã hủy")
                            + "Nếu bạn cần hỗ trợ thêm, vui lòng liên hệ bộ phận chăm sóc khách hàng.\n\n"
                            + signature()
            );
            default -> null;
        };
    }

    private String orderStatusBlock(String orderCode, String statusLabel) {
        return "Thông tin đơn hàng\n"
                + "- Mã đơn hàng: " + orderCode + "\n"
                + "- Trạng thái mới: " + statusLabel + "\n\n";
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? "" : value.asText();
    }

    private String firstNotBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private String money(BigDecimal amount) {
        if (amount == null) {
            return "0 đ";
        }
        NumberFormat formatter = NumberFormat.getCurrencyInstance(VIETNAMESE);
        formatter.setMaximumFractionDigits(0);
        return formatter.format(amount);
    }

    private String dateTime(String value) {
        if (value == null || value.isBlank()) {
            return "chưa cập nhật";
        }
        try {
            return OffsetDateTime.parse(value)
                    .atZoneSameInstant(VIETNAM_ZONE)
                    .format(EMAIL_DATE_TIME_FORMATTER);
        } catch (DateTimeParseException ignored) {
            // Try local datetime below.
        }
        try {
            return LocalDateTime.parse(value)
                    .atZone(VIETNAM_ZONE)
                    .format(EMAIL_DATE_TIME_FORMATTER);
        } catch (DateTimeParseException ignored) {
            return value;
        }
    }

    private String customerName(JsonNode payload) {
        return fallback(text(payload, "customerName"), "Quý khách");
    }

    private String fallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String greeting(String customerName) {
        return "Chào " + fallback(customerName, "Quý khách") + ",\n\n";
    }

    private String signature() {
        return "Trân trọng,\nMega Mall";
    }

    private String paymentMethodName(String paymentMethod) {
        return switch (paymentMethod == null ? "" : paymentMethod.toUpperCase(Locale.ROOT)) {
            case "COD" -> "Thanh toán khi nhận hàng (COD)";
            case "SEPAY_QR" -> "Chuyển khoản QR";
            case "SEPAY_CHECKOUT" -> "Thanh toán online qua SePay";
            case "SEPAY_CARD" -> "Thanh toán thẻ qua SePay";
            default -> fallback(paymentMethod, "Chưa xác định");
        };
    }

    private String normalizeStatus(String status) {
        if (status == null) {
            return "";
        }
        String normalized = status.trim().toLowerCase(Locale.ROOT);
        return "shipped".equals(normalized) ? "shipping" : normalized;
    }

    private record EmailContent(String subject, String body) {
    }
}
