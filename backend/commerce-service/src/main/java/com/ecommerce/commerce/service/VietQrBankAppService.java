package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.domain.PaymentEntity;
import com.ecommerce.commerce.dto.VietQrBankAppsResponse;
import com.ecommerce.commerce.repository.OrderRepository;
import com.ecommerce.commerce.repository.PaymentRepository;
import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.web.BusinessException;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class VietQrBankAppService {

    private final PaymentRepository paymentRepository;
    private final OrderRepository orderRepository;
    private final VietQrService vietQrService;

    public VietQrBankAppService(
            PaymentRepository paymentRepository,
            OrderRepository orderRepository,
            VietQrService vietQrService
    ) {
        this.paymentRepository = paymentRepository;
        this.orderRepository = orderRepository;
        this.vietQrService = vietQrService;
    }

    @Transactional(readOnly = true)
    public VietQrBankAppsResponse listForPayment(AuthenticatedUser principal, Long paymentId, String platform) {
        PaymentEntity payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new EntityNotFoundException("Payment not found"));
        OrderEntity order = orderRepository.findById(payment.getOrderId())
                .orElseThrow(() -> new EntityNotFoundException("Order not found"));

        ensureCanAccess(principal, order);
        if (!PaymentConstants.METHOD_SEPAY_QR.equalsIgnoreCase(payment.getMethod())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Bank app list is only available for QR payments");
        }

        return vietQrService.bankAppsForPayment(payment, platform);
    }

    private void ensureCanAccess(AuthenticatedUser principal, OrderEntity order) {
        if (principal.roles().contains("ADMIN")) {
            return;
        }
        UUID requester = UUID.fromString(principal.userId());
        if (!requester.equals(order.getUserId())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "You do not have access to this payment");
        }
    }
}
