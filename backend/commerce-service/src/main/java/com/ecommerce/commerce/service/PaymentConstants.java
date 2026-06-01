package com.ecommerce.commerce.service;

import java.util.Set;

public final class PaymentConstants {

    public static final String PROVIDER_COD = "COD";
    public static final String PROVIDER_SEPAY = "SEPAY";

    public static final String METHOD_COD = "COD";
    public static final String METHOD_SEPAY_QR = "SEPAY_QR";
    public static final String METHOD_SEPAY_CHECKOUT = "SEPAY_CHECKOUT";
    public static final String METHOD_SEPAY_CARD = "SEPAY_CARD";
    public static final String METHOD_APPLE_PAY = "APPLE_PAY";
    public static final String METHOD_GOOGLE_PAY = "GOOGLE_PAY";

    public static final String ORDER_PENDING = "pending";
    public static final String ORDER_PENDING_PAYMENT = "pending_payment";
    public static final String ORDER_PAID = "paid";
    public static final String ORDER_PAYMENT_EXPIRED = "payment_expired";

    public static final String PAYMENT_UNPAID = "unpaid";
    public static final String PAYMENT_PENDING = "pending";
    public static final String PAYMENT_PAID = "paid";
    public static final String PAYMENT_FAILED = "failed";
    public static final String PAYMENT_CANCELLED = "cancelled";
    public static final String PAYMENT_EXPIRED = "expired";
    public static final String PAYMENT_AMOUNT_MISMATCH = "amount_mismatch";

    public static final String NEXT_NONE = "NONE";
    public static final String NEXT_WAIT_FOR_SELLER_CONFIRMATION = "WAIT_FOR_SELLER_CONFIRMATION";
    public static final String NEXT_SHOW_QR = "SHOW_QR";
    public static final String NEXT_OPEN_CHECKOUT_URL = "OPEN_CHECKOUT_URL";

    public static final Set<String> ONLINE_SEPAY_METHODS = Set.of(
            METHOD_SEPAY_QR,
            METHOD_SEPAY_CHECKOUT,
            METHOD_SEPAY_CARD
    );

    private PaymentConstants() {
    }
}
