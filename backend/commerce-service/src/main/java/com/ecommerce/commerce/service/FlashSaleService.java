package com.ecommerce.commerce.service;

import com.ecommerce.commerce.config.FlashSaleProperties;
import com.ecommerce.commerce.domain.FlashSaleItemEntity;
import com.ecommerce.commerce.dto.FlashSaleClaimRequest;
import com.ecommerce.commerce.dto.FlashSaleClaimResponse;
import com.ecommerce.commerce.dto.FlashSalePreloadRequest;
import com.ecommerce.commerce.dto.FlashSalePreloadResponse;
import com.ecommerce.commerce.repository.FlashSaleItemRepository;
import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.web.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
public class FlashSaleService {

    private final FlashSaleProperties properties;
    private final FlashSaleStockStore stockStore;
    private final FlashSaleEventPublisher eventPublisher;
    private final FlashSaleItemRepository flashSaleItemRepository;
    private final FlashSaleReservationSyncService reservationSyncService;
    private final FlashSaleQueryService flashSaleQueryService;

    public FlashSaleService(
            FlashSaleProperties properties,
            FlashSaleStockStore stockStore,
            FlashSaleEventPublisher eventPublisher,
            FlashSaleItemRepository flashSaleItemRepository,
            FlashSaleReservationSyncService reservationSyncService,
            FlashSaleQueryService flashSaleQueryService
    ) {
        this.properties = properties;
        this.stockStore = stockStore;
        this.eventPublisher = eventPublisher;
        this.flashSaleItemRepository = flashSaleItemRepository;
        this.reservationSyncService = reservationSyncService;
        this.flashSaleQueryService = flashSaleQueryService;
    }

    public FlashSalePreloadResponse preload(AuthenticatedUser principal, Long campaignId, Long itemId, FlashSalePreloadRequest request) {
        requireAdmin(principal);
        ensureEnabled();

        FlashSaleItemEntity item = flashSaleItemRepository.findByIdAndCampaignId(itemId, campaignId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "Flash sale item not found"));
        if (!"active".equalsIgnoreCase(item.getStatus()) && !"scheduled".equalsIgnoreCase(item.getStatus())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Flash sale item is not preloadable");
        }

        int stock = request.stock() == null ? item.getStockLimit() : request.stock();
        int perUserLimit = request.perUserLimit() == null ? item.getPerUserLimit() : request.perUserLimit();
        if (stock < 0 || perUserLimit < 1) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Invalid flash sale preload values");
        }
        if (Boolean.TRUE.equals(request.resetProjection())) {
            if (!properties.isTestOpsEnabled()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "Flash sale test operations are disabled");
            }
            reservationSyncService.resetProjection(campaignId, itemId);
            log.warn("Reset flash sale projection for campaign {} item {} before preload", campaignId, itemId);
        }

        try {
            stockStore.preload(campaignId, itemId, stock, perUserLimit);
            return new FlashSalePreloadResponse(campaignId, itemId, stock, perUserLimit, "PRELOADED", "Flash sale stock is ready");
        } catch (DataAccessException | IllegalStateException exception) {
            log.warn("Flash sale preload failed for campaign {} item {}: {}", campaignId, itemId, exception.getMessage());
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "Flash sale stock store is unavailable");
        }
    }

    public FlashSaleClaimResponse claim(AuthenticatedUser principal, Long campaignId, Long itemId, FlashSaleClaimRequest request) {
        ensureEnabled();
        requireActiveFlashSale(campaignId, itemId);
        UUID userId = UUID.fromString(principal.userId());
        int quantity = request.quantity() == null ? 1 : request.quantity();
        FlashSaleClaimCommand command = new FlashSaleClaimCommand(campaignId, itemId, userId, request.requestId(), quantity);

        FlashSaleClaimResult result;
        try {
            result = stockStore.claim(command, properties.getReservationTtlSeconds());
        } catch (DataAccessException | IllegalStateException exception) {
            log.warn("Flash sale claim failed before reservation for campaign {} item {} user {}: {}",
                    campaignId, itemId, userId, exception.getMessage());
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "Flash sale is temporarily unavailable");
        }

        if (!result.reserved()) {
            return rejectedResponse(campaignId, itemId, quantity, result);
        }

        if ("DUPLICATE".equals(result.status())) {
            return new FlashSaleClaimResponse(
                    campaignId,
                    itemId,
                    "RESERVED",
                    result.reservationToken(),
                    result.quantity(),
                    result.remainingStock(),
                    result.expiresAt(),
                    "Flash sale reservation already exists for this request"
            );
        }

        FlashSaleEventPayload payload = new FlashSaleEventPayload(
                UUID.randomUUID().toString(),
                "FLASH_SALE_RESERVED",
                OffsetDateTime.now(),
                campaignId,
                itemId,
                userId,
                request.requestId(),
                result.reservationToken(),
                result.quantity(),
                result.remainingStock(),
                result.expiresAt()
        );

        try {
            eventPublisher.publishReservationClaimed(payload);
        } catch (RuntimeException exception) {
            log.warn("Flash sale event publish failed; releasing reservation {} for campaign {} item {}: {}",
                    result.reservationToken(), campaignId, itemId, exception.getMessage());
            try {
                stockStore.release(campaignId, itemId, result.reservationToken());
            } catch (RuntimeException releaseException) {
                log.error("Flash sale reservation compensation failed for token {}", result.reservationToken(), releaseException);
            }
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "Flash sale reservation could not be confirmed");
        }

        return new FlashSaleClaimResponse(
                campaignId,
                itemId,
                "RESERVED",
                result.reservationToken(),
                result.quantity(),
                result.remainingStock(),
                result.expiresAt(),
                "Flash sale reservation created"
        );
    }

    private FlashSaleClaimResponse rejectedResponse(Long campaignId, Long itemId, Integer quantity, FlashSaleClaimResult result) {
        String message = switch (result.status()) {
            case "NOT_PRELOADED" -> "Flash sale stock is not ready";
            case "LIMIT_EXCEEDED" -> "Purchase limit exceeded";
            case "SOLD_OUT" -> "Flash sale item is sold out";
            case "INVALID_QUANTITY" -> "Invalid quantity";
            default -> "Flash sale reservation rejected";
        };
        HttpStatus status = switch (result.status()) {
            case "SOLD_OUT", "LIMIT_EXCEEDED" -> HttpStatus.CONFLICT;
            case "NOT_PRELOADED" -> HttpStatus.SERVICE_UNAVAILABLE;
            default -> HttpStatus.BAD_REQUEST;
        };
        throw new BusinessException(status, message);
    }

    private void ensureEnabled() {
        if (!properties.isEnabled()) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "Flash sale flow is disabled");
        }
    }

    private void requireAdmin(AuthenticatedUser principal) {
        List<String> roles = principal.roles() == null ? List.of() : principal.roles();
        boolean admin = roles.stream().anyMatch(role -> "ADMIN".equalsIgnoreCase(role) || "ROLE_ADMIN".equalsIgnoreCase(role));
        if (!admin) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "Admin permission is required");
        }
    }

    private void requireActiveFlashSale(Long campaignId, Long itemId) {
        if (flashSaleQueryService.getActiveItem(campaignId, itemId).isEmpty()) {
            throw new BusinessException(HttpStatus.CONFLICT, "Flash sale item is not active");
        }
    }
}
