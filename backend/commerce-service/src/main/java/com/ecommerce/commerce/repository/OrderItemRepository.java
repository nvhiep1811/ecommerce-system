package com.ecommerce.commerce.repository;

import com.ecommerce.commerce.domain.OrderItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;

public interface OrderItemRepository extends JpaRepository<OrderItemEntity, Long> {

    List<OrderItemEntity> findByOrderIdOrderByIdAsc(Long orderId);

    List<OrderItemEntity> findByOrderIdInOrderByOrderIdAscIdAsc(Collection<Long> orderIds);

    @Query(value = """
            select
                oi.order_id as orderId,
                p.seller_id as sellerId,
                coalesce(u.full_name, u.email, 'Seller') as sellerName,
                count(*) as itemCount
            from order_items oi
            join products p on p.id = oi.product_id
            left join users u on u.id = p.seller_id
            where oi.order_id in (:orderIds)
              and p.seller_id is not null
            group by oi.order_id, p.seller_id, u.full_name, u.email
            order by oi.order_id asc, sellerName asc
            """, nativeQuery = true)
    List<OrderSellerSummaryProjection> findSellerSummariesByOrderIdIn(Collection<Long> orderIds);
}
