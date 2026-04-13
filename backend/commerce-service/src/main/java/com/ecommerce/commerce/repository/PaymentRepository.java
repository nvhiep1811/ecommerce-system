package com.ecommerce.commerce.repository;

import com.ecommerce.commerce.domain.PaymentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PaymentRepository extends JpaRepository<PaymentEntity, Long> {

    Optional<PaymentEntity> findTopByOrderIdOrderByAttemptNoDesc(Long orderId);
}
