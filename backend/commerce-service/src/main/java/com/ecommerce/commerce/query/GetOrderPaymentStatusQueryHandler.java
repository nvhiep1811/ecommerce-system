package com.ecommerce.commerce.query;
 
import com.ecommerce.commerce.dto.PaymentStatusResponse;
import com.ecommerce.commerce.service.PaymentService;
import org.springframework.stereotype.Component;
 
@Component
public class GetOrderPaymentStatusQueryHandler {
 
    private final PaymentService paymentService;
 
    public GetOrderPaymentStatusQueryHandler(PaymentService paymentService) {
        this.paymentService = paymentService;
    }
 
    public PaymentStatusResponse handle(GetOrderPaymentStatusQuery query) {
        return paymentService.getPaymentStatus(query.principal(), query.orderId());
    }
}
