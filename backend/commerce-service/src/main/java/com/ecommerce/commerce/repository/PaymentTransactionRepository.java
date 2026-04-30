package com.ecommerce.commerce.repository;

import com.ecommerce.commerce.domain.PaymentTransactionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransactionEntity, Long> {

    boolean existsByProviderTransactionId(String providerTransactionId);
}
