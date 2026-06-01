package com.ecommerce.commerce.service;

import com.ecommerce.shared.web.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.regex.Pattern;

@Service
public class CheckoutValidationService {

    private static final Pattern CLIENT_REQUEST_ID_PATTERN = Pattern.compile("^[A-Za-z0-9._:-]{1,80}$");

    /**
     * Normalize và validate clientRequestId.
     * Trả về null nếu blank, throw nếu format sai.
     */
    public String normalizeClientRequestId(String clientRequestId) {
        if (clientRequestId == null || clientRequestId.isBlank()) {
            return null;
        }
        String normalized = clientRequestId.trim();
        if (!CLIENT_REQUEST_ID_PATTERN.matcher(normalized).matches()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Invalid client request id");
        }
        return normalized;
    }

    /**
     * Normalize payment method string về dạng chuẩn.
     * Trả về "COD" nếu blank, throw nếu không hỗ trợ.
     */
    public String normalizePaymentMethod(String paymentMethod) {
        if (paymentMethod == null || paymentMethod.isBlank()) {
            return "COD";
        }
        return switch (paymentMethod.trim().toUpperCase()) {
            case PaymentConstants.METHOD_COD -> PaymentConstants.METHOD_COD;
            case "MEGAPAY", "MOMO" -> "MOMO";
            case "CARD" -> "CARD";
            case "BANK_TRANSFER" -> "BANK_TRANSFER";
            case "VNPAY" -> "VNPAY";
            case "PAYPAL" -> "PAYPAL";
            case PaymentConstants.METHOD_SEPAY_QR -> PaymentConstants.METHOD_SEPAY_QR;
            case PaymentConstants.METHOD_SEPAY_CHECKOUT -> PaymentConstants.METHOD_SEPAY_CHECKOUT;
            case PaymentConstants.METHOD_SEPAY_CARD -> PaymentConstants.METHOD_SEPAY_CARD;
            case PaymentConstants.METHOD_APPLE_PAY -> PaymentConstants.METHOD_APPLE_PAY;
            case PaymentConstants.METHOD_GOOGLE_PAY -> PaymentConstants.METHOD_GOOGLE_PAY;
            default -> throw new BusinessException(HttpStatus.BAD_REQUEST, "Unsupported payment method");
        };
    }

    /**
     * Validate payment method đã normalize: kiểm tra enabled và chưa implement.
     * Trả về paymentMethod nếu hợp lệ.
     */
    public String validatePaymentMethod(String paymentMethod, PaymentMethodService paymentMethodService) {
        if (PaymentConstants.METHOD_COD.equals(paymentMethod)
                || PaymentConstants.ONLINE_SEPAY_METHODS.contains(paymentMethod)
                || PaymentConstants.METHOD_APPLE_PAY.equals(paymentMethod)
                || PaymentConstants.METHOD_GOOGLE_PAY.equals(paymentMethod)) {
            if (!paymentMethodService.isEnabled(paymentMethod)) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "Payment method is not available");
            }
        }
        if (PaymentConstants.METHOD_APPLE_PAY.equals(paymentMethod)
                || PaymentConstants.METHOD_GOOGLE_PAY.equals(paymentMethod)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Payment method is prepared for future use but not implemented");
        }
        return paymentMethod;
    }
}