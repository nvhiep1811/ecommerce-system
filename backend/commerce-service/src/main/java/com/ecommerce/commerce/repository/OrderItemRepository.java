package com.ecommerce.commerce.repository;

import com.ecommerce.commerce.domain.OrderItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface OrderItemRepository extends JpaRepository<OrderItemEntity, Long> {

    List<OrderItemEntity> findByOrderIdOrderByIdAsc(Long orderId);

    List<OrderItemEntity> findByOrderIdInOrderByOrderIdAscIdAsc(Collection<Long> orderIds);
}
