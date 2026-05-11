package com.ecommerce.catalog.service;

import com.ecommerce.catalog.domain.ProductEntity;
import com.ecommerce.catalog.domain.ReviewEntity;
import com.ecommerce.catalog.dto.ReviewResponse;
import com.ecommerce.catalog.dto.ReviewUpsertRequest;
import com.ecommerce.catalog.dto.ReviewsResponse;
import com.ecommerce.catalog.repository.ProductRepository;
import com.ecommerce.catalog.repository.ReviewRepository;
import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.web.BusinessException;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ReviewService {

    private static final String STATUS_VISIBLE = "visible";

    private final ReviewRepository reviewRepository;
    private final ProductRepository productRepository;
    private final NamedParameterJdbcTemplate jdbcTemplate;

    public ReviewService(
            ReviewRepository reviewRepository,
            ProductRepository productRepository,
            NamedParameterJdbcTemplate jdbcTemplate
    ) {
        this.reviewRepository = reviewRepository;
        this.productRepository = productRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    public ReviewsResponse productReviews(Long productId) {
        return new ReviewsResponse(reviewRepository.findByProductIdAndStatusOrderByCreatedAtDesc(productId, STATUS_VISIBLE)
                .stream()
                .map(this::toResponse)
                .toList());
    }

    public ReviewsResponse mine(AuthenticatedUser principal) {
        UUID userId = UUID.fromString(principal.userId());
        return new ReviewsResponse(reviewRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::toResponse)
                .toList());
    }

    public ReviewResponse myOrderItemReview(AuthenticatedUser principal, Long orderItemId) {
        UUID userId = UUID.fromString(principal.userId());
        return reviewRepository.findByUserIdAndOrderItemId(userId, orderItemId)
                .map(this::toResponse)
                .orElse(null);
    }

    @Transactional
    public ReviewResponse upsert(AuthenticatedUser principal, ReviewUpsertRequest request) {
        UUID userId = UUID.fromString(principal.userId());
        validateVerifiedDeliveredPurchase(userId, request.productId(), request.orderItemId());
        productRepository.findByIdAndDeletedAtIsNull(request.productId())
                .orElseThrow(() -> new EntityNotFoundException("Product not found"));

        ReviewEntity review = reviewRepository.findByUserIdAndOrderItemId(userId, request.orderItemId())
                .orElseGet(() -> {
                    ReviewEntity next = new ReviewEntity();
                    next.setUserId(userId);
                    next.setProductId(request.productId());
                    next.setOrderItemId(request.orderItemId());
                    next.setVerifiedPurchase(true);
                    next.setStatus(STATUS_VISIBLE);
                    return next;
                });

        if (!request.productId().equals(review.getProductId())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Review product does not match the original order item");
        }

        review.setRating(request.rating());
        review.setComment(normalizeComment(request.comment()));
        review.setImageUrls(normalizeImageUrls(request.imageUrls()));
        review.setVerifiedPurchase(true);
        review.setStatus(STATUS_VISIBLE);

        ReviewEntity saved = reviewRepository.save(review);
        refreshProductRating(request.productId());
        return toResponse(saved);
    }

    private void validateVerifiedDeliveredPurchase(UUID userId, Long productId, Long orderItemId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                select o.order_status, o.fulfillment_status
                from order_items oi
                join orders o on o.id = oi.order_id
                where oi.id = :orderItemId
                  and oi.product_id = :productId
                  and o.user_id = :userId
                """,
                new MapSqlParameterSource()
                        .addValue("orderItemId", orderItemId)
                        .addValue("productId", productId)
                        .addValue("userId", userId)
        );

        if (rows.isEmpty()) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "You can only review products from your own orders");
        }

        Map<String, Object> row = rows.get(0);
        String orderStatus = String.valueOf(row.get("order_status"));
        String fulfillmentStatus = String.valueOf(row.get("fulfillment_status"));
        if (!"delivered".equalsIgnoreCase(orderStatus) && !"delivered".equalsIgnoreCase(fulfillmentStatus)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "You can only review after the order has been delivered");
        }
    }

    private void refreshProductRating(Long productId) {
        ProductEntity product = productRepository.findByIdAndDeletedAtIsNull(productId)
                .orElseThrow(() -> new EntityNotFoundException("Product not found"));
        Double average = reviewRepository.averageRating(productId, STATUS_VISIBLE);
        long count = reviewRepository.countByProductIdAndStatus(productId, STATUS_VISIBLE);
        BigDecimal rating = BigDecimal.valueOf(average == null ? 0 : average)
                .setScale(2, RoundingMode.HALF_UP);
        product.setRatingAvg(rating);
        product.setReviewCount(Math.toIntExact(count));
        productRepository.save(product);
    }

    private String normalizeComment(String comment) {
        if (comment == null || comment.isBlank()) {
            return null;
        }
        return comment.trim();
    }

    private String[] normalizeImageUrls(List<String> imageUrls) {
        if (imageUrls == null || imageUrls.isEmpty()) {
            return null;
        }
        return imageUrls.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .limit(5)
                .toArray(String[]::new);
    }

    private ReviewResponse toResponse(ReviewEntity review) {
        return new ReviewResponse(
                review.getId(),
                review.getUserId(),
                review.getProductId(),
                review.getOrderItemId(),
                review.getRating(),
                review.getComment(),
                review.getImageUrls() == null ? List.of() : Arrays.asList(review.getImageUrls()),
                review.isVerifiedPurchase(),
                review.getStatus(),
                review.getCreatedAt(),
                review.getUpdatedAt()
        );
    }
}
