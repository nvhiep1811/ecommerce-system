package com.ecommerce.commerce.repository;

import com.ecommerce.commerce.domain.NotificationDeliveryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface NotificationDeliveryRepository extends JpaRepository<NotificationDeliveryEntity, Long> {

    Optional<NotificationDeliveryEntity> findByEventIdAndConsumerName(String eventId, String consumerName);
}
