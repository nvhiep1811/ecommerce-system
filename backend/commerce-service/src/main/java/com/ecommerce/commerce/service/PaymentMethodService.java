package com.ecommerce.commerce.service;

import com.ecommerce.commerce.config.PaymentProperties;
import com.ecommerce.commerce.config.SepayProperties;
import com.ecommerce.commerce.dto.PaymentMethodResponse;
import com.ecommerce.commerce.dto.PaymentMethodsResponse;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PaymentMethodService {

    private final PaymentProperties paymentProperties;
    private final SepayProperties sepayProperties;

    public PaymentMethodService(PaymentProperties paymentProperties, SepayProperties sepayProperties) {
        this.paymentProperties = paymentProperties;
        this.sepayProperties = sepayProperties;
    }

    public PaymentMethodsResponse listMethods() {
        boolean sepayEnabled = sepayProperties.isEnabled();
        return new PaymentMethodsResponse(List.of(
                new PaymentMethodResponse(
                        PaymentConstants.METHOD_COD,
                        "Thanh toán khi nhận hàng",
                        "Thanh toán bằng tiền mặt khi nhận hàng",
                        paymentProperties.getMethods().isCodEnabled(),
                        "OFFLINE",
                        1,
                        List.of()
                ),
                new PaymentMethodResponse(
                        PaymentConstants.METHOD_SEPAY_QR,
                        "Chuyển khoản QR",
                        "Quét mã QR bằng ứng dụng ngân hàng",
                        sepayEnabled && sepayProperties.getMethods().isQrEnabled(),
                        "ONLINE",
                        2,
                        List.of("QR_DISPLAY", "QR_DOWNLOAD", "COPY_TRANSFER_CONTENT", "PAYMENT_COUNTDOWN", "POLL_PAYMENT_STATUS")
                ),
                new PaymentMethodResponse(
                        PaymentConstants.METHOD_SEPAY_CHECKOUT,
                        "Thẻ / thanh toán online",
                        "Thanh toán qua cổng SePay bằng thẻ hoặc phương thức online được hỗ trợ",
                        sepayEnabled && sepayProperties.getMethods().isCheckoutEnabled(),
                        "ONLINE",
                        3,
                        List.of("CHECKOUT_URL")
                ),
                new PaymentMethodResponse(
                        PaymentConstants.METHOD_SEPAY_CARD,
                        "Thẻ qua SePay",
                        "Thanh toán thẻ nếu merchant SePay được hỗ trợ",
                        sepayEnabled && sepayProperties.getMethods().isCheckoutEnabled() && sepayProperties.getMethods().isCardEnabled(),
                        "ONLINE",
                        4,
                        List.of("CHECKOUT_URL")
                ),
                new PaymentMethodResponse(
                        PaymentConstants.METHOD_APPLE_PAY,
                        "Apple Pay",
                        "Thanh toán nhanh bằng Apple Pay nếu gateway hỗ trợ",
                        false,
                        "ONLINE",
                        5,
                        List.of("FUTURE_EXTENSION")
                ),
                new PaymentMethodResponse(
                        PaymentConstants.METHOD_GOOGLE_PAY,
                        "Google Pay",
                        "Thanh toán nhanh bằng Google Pay nếu gateway hỗ trợ",
                        false,
                        "ONLINE",
                        6,
                        List.of("FUTURE_EXTENSION")
                )
        ));
    }

    public boolean isEnabled(String method) {
        return listMethods().methods().stream()
                .anyMatch(candidate -> candidate.code().equalsIgnoreCase(method) && candidate.enabled());
    }
}
