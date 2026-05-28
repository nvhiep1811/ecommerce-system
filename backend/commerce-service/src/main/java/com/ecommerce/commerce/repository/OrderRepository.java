package com.ecommerce.commerce.repository;

import com.ecommerce.commerce.domain.OrderEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<OrderEntity, Long> {

    List<OrderEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<OrderEntity> findByUserIdAndOrderStatusOrderByCreatedAtDesc(UUID userId, String orderStatus);

    Optional<OrderEntity> findByUserIdAndClientRequestId(UUID userId, String clientRequestId);

    List<OrderEntity> findTop100ByOrderByCreatedAtDesc();

    List<OrderEntity> findTop100ByOrderStatusOrderByCreatedAtDesc(String orderStatus);

    @Query(value = """
            select distinct o.*
            from orders o
            join order_items oi on oi.order_id = o.id
            join products p on p.id = oi.product_id
            where p.seller_id = :sellerId
            order by o.created_at desc
            """, nativeQuery = true)
    List<OrderEntity> findSellerOrders(UUID sellerId);

    @Query(value = """
            select distinct o.*
            from orders o
            join order_items oi on oi.order_id = o.id
            join products p on p.id = oi.product_id
            where p.seller_id = :sellerId
              and o.order_status = :status
            order by o.created_at desc
            """, nativeQuery = true)
    List<OrderEntity> findSellerOrdersByStatus(UUID sellerId, String status);

    @Query(value = """
            select exists (
                select 1
                from orders o
                join order_items oi on oi.order_id = o.id
                join products p on p.id = oi.product_id
                where o.id = :orderId
                  and p.seller_id = :sellerId
            )
            """, nativeQuery = true)
    boolean existsSellerOrder(UUID sellerId, Long orderId);
}
