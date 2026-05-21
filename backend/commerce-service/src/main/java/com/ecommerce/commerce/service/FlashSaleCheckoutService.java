package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.FlashSaleItemEntity;
import com.ecommerce.commerce.domain.FlashSaleReservationEntity;
import com.ecommerce.commerce.dto.OrderLineRequest;
import com.ecommerce.commerce.repository.FlashSaleItemRepository;
import com.ecommerce.commerce.repository.FlashSaleReservationRepository;
import com.ecommerce.shared.web.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class FlashSaleCheckoutService {

    private final FlashSaleItemRepository itemRepository;
    private final FlashSaleReservationRepository reservationRepository;
    private final FlashSaleStockStore stockStore;

    public FlashSaleCheckoutService(
            FlashSaleItemRepository itemRepository,
            FlashSaleReservationRepository reservationRepository,
            FlashSaleStockStore stockStore
    ) {
        this.itemRepository = itemRepository;
        this.reservationRepository = reservationRepository;
        this.stockStore = stockStore;
    }

    @Transactional(readOnly = true)
    public List<FlashSaleCheckoutReservation> resolveForPricing(UUID userId, List<OrderLineRequest> lines) {
        List<FlashSaleCheckoutReservation> reservations = new ArrayList<>();
        Set<String> seenTokens = new HashSet<>();
        for (OrderLineRequest line : lines) {
            if (!hasReservationToken(line)) {
                continue;
            }
            String token = line.flashSaleReservationToken().trim();
            if (!seenTokens.add(token)) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "Flash sale reservation token is duplicated");
            }
            requireReservationReference(line);
            FlashSaleItemEntity item = itemRepository.findByIdAndCampaignId(line.flashSaleItemId(), line.flashSaleCampaignId())
                    .orElseThrow(() -> new BusinessException(HttpStatus.BAD_REQUEST, "Flash sale item is not available"));
            validateItemMatchesLine(item, line);
            validateReservationSnapshotIfSynced(userId, line, item);
            reservations.add(toCheckoutReservation(line, item));
        }
        return reservations;
    }

    @Transactional
    public void confirmForOrder(UUID userId, Long orderId, List<FlashSaleCheckoutReservation> reservations) {
        for (FlashSaleCheckoutReservation reservation : reservations) {
            FlashSaleConfirmResult confirmResult = stockStore.confirm(
                    reservation.campaignId(),
                    reservation.itemId(),
                    reservation.reservationToken(),
                    userId,
                    reservation.quantity()
            );

            if (!confirmResult.confirmed()) {
                if ("EXPIRED".equals(confirmResult.status())) {
                    markExpiredFromCheckout(userId, reservation, confirmResult);
                }
                throw reservationConflict(confirmResult.status());
            }

            if (!userId.equals(confirmResult.userId()) || !Objects.equals(reservation.quantity(), confirmResult.quantity())) {
                throw new BusinessException(HttpStatus.CONFLICT, "Flash sale reservation does not match checkout line");
            }

            FlashSaleItemEntity item = itemRepository.findByIdAndCampaignIdForUpdate(reservation.itemId(), reservation.campaignId())
                    .orElseThrow(() -> new BusinessException(HttpStatus.BAD_REQUEST, "Flash sale item is not available"));
            validateItemMatchesReservation(item, reservation);
            upsertConfirmedReservation(userId, orderId, reservation, confirmResult, item);
        }
    }

    @Transactional
    public void releaseConfirmedForOrder(Long orderId) {
        List<FlashSaleReservationEntity> reservations = reservationRepository.findByOrderIdForUpdate(orderId);
        for (FlashSaleReservationEntity reservation : reservations) {
            if (!"confirmed".equalsIgnoreCase(reservation.getStatus())) {
                continue;
            }
            FlashSaleItemEntity item = itemRepository.findByIdAndCampaignIdForUpdate(reservation.getItemId(), reservation.getCampaignId())
                    .orElseThrow(() -> new BusinessException(HttpStatus.CONFLICT, "Flash sale item is not available"));

            stockStore.restoreConfirmed(
                    reservation.getCampaignId(),
                    reservation.getItemId(),
                    reservation.getUserId(),
                    reservation.getQuantity()
            );

            reservation.setStatus("released");
            reservation.setReleasedAt(OffsetDateTime.now());
            reservationRepository.save(reservation);

            item.setSoldCount(Math.max(0, item.getSoldCount() - reservation.getQuantity()));
            itemRepository.save(item);
        }
    }

    private void markExpiredFromCheckout(
            UUID userId,
            FlashSaleCheckoutReservation reservation,
            FlashSaleConfirmResult confirmResult
    ) {
        FlashSaleItemEntity item = itemRepository.findByIdAndCampaignIdForUpdate(reservation.itemId(), reservation.campaignId())
                .orElseThrow(() -> new BusinessException(HttpStatus.BAD_REQUEST, "Flash sale item is not available"));
        validateItemMatchesReservation(item, reservation);

        reservationRepository.findByReservationTokenForUpdate(reservation.reservationToken())
                .ifPresentOrElse(
                        existing -> {
                            if (!"reserved".equalsIgnoreCase(existing.getStatus())) {
                                return;
                            }
                            existing.setStatus("expired");
                            existing.setReleasedAt(OffsetDateTime.now());
                            reservationRepository.save(existing);
                            item.setReservedCount(Math.max(0, item.getReservedCount() - existing.getQuantity()));
                            itemRepository.save(item);
                        },
                        () -> createExpiredReservation(userId, reservation, confirmResult)
                );
    }

    private void createExpiredReservation(
            UUID userId,
            FlashSaleCheckoutReservation reservation,
            FlashSaleConfirmResult confirmResult
    ) {
        FlashSaleReservationEntity entity = new FlashSaleReservationEntity();
        entity.setCampaignId(reservation.campaignId());
        entity.setItemId(reservation.itemId());
        entity.setUserId(userId);
        entity.setRequestId(confirmResult.requestId() == null || confirmResult.requestId().isBlank()
                ? "checkout-expired-" + reservation.reservationToken()
                : confirmResult.requestId());
        entity.setReservationToken(reservation.reservationToken());
        entity.setQuantity(reservation.quantity());
        entity.setStatus("expired");
        entity.setExpiresAt(firstNonNull(confirmResult.expiresAt(), reservation.expiresAt(), OffsetDateTime.now()));
        entity.setReleasedAt(OffsetDateTime.now());
        reservationRepository.save(entity);
    }

    private void validateReservationSnapshotIfSynced(UUID userId, OrderLineRequest line, FlashSaleItemEntity item) {
        reservationRepository.findByReservationToken(line.flashSaleReservationToken().trim())
                .ifPresent(reservation -> {
                    if (!userId.equals(reservation.getUserId())) {
                        throw new BusinessException(HttpStatus.FORBIDDEN, "Flash sale reservation belongs to another user");
                    }
                    if (!"reserved".equalsIgnoreCase(reservation.getStatus())) {
                        throw new BusinessException(HttpStatus.CONFLICT, "Flash sale reservation is not active");
                    }
                    if (reservation.getExpiresAt().isBefore(OffsetDateTime.now())) {
                        throw new BusinessException(HttpStatus.CONFLICT, "Flash sale reservation has expired");
                    }
                    if (!Objects.equals(reservation.getCampaignId(), line.flashSaleCampaignId())
                            || !Objects.equals(reservation.getItemId(), item.getId())
                            || !Objects.equals(reservation.getQuantity(), line.quantity())) {
                        throw new BusinessException(HttpStatus.CONFLICT, "Flash sale reservation does not match checkout line");
                    }
                });
    }

    private void upsertConfirmedReservation(
            UUID userId,
            Long orderId,
            FlashSaleCheckoutReservation reservation,
            FlashSaleConfirmResult confirmResult,
            FlashSaleItemEntity item
    ) {
        OffsetDateTime now = OffsetDateTime.now();
        reservationRepository.findByReservationTokenForUpdate(reservation.reservationToken())
                .ifPresentOrElse(
                        existing -> confirmExistingReservation(existing, orderId, item, now),
                        () -> createConfirmedReservation(userId, orderId, reservation, confirmResult, item, now)
                );
    }

    private void confirmExistingReservation(
            FlashSaleReservationEntity reservation,
            Long orderId,
            FlashSaleItemEntity item,
            OffsetDateTime now
    ) {
        if (!"reserved".equalsIgnoreCase(reservation.getStatus())) {
            throw new BusinessException(HttpStatus.CONFLICT, "Flash sale reservation is not active");
        }
        reservation.setStatus("confirmed");
        reservation.setConfirmedAt(now);
        reservation.setOrderId(orderId);
        reservationRepository.save(reservation);

        item.setReservedCount(Math.max(0, item.getReservedCount() - reservation.getQuantity()));
        item.setSoldCount(item.getSoldCount() + reservation.getQuantity());
        itemRepository.save(item);
    }

    private void createConfirmedReservation(
            UUID userId,
            Long orderId,
            FlashSaleCheckoutReservation reservation,
            FlashSaleConfirmResult confirmResult,
            FlashSaleItemEntity item,
            OffsetDateTime now
    ) {
        FlashSaleReservationEntity entity = new FlashSaleReservationEntity();
        entity.setCampaignId(reservation.campaignId());
        entity.setItemId(reservation.itemId());
        entity.setUserId(userId);
        entity.setRequestId(confirmResult.requestId() == null || confirmResult.requestId().isBlank()
                ? "checkout-" + reservation.reservationToken()
                : confirmResult.requestId());
        entity.setReservationToken(reservation.reservationToken());
        entity.setQuantity(reservation.quantity());
        entity.setStatus("confirmed");
        entity.setExpiresAt(firstNonNull(confirmResult.expiresAt(), reservation.expiresAt(), now));
        entity.setConfirmedAt(now);
        entity.setOrderId(orderId);
        reservationRepository.save(entity);

        item.setSoldCount(item.getSoldCount() + reservation.quantity());
        itemRepository.save(item);
    }

    private FlashSaleCheckoutReservation toCheckoutReservation(OrderLineRequest line, FlashSaleItemEntity item) {
        return new FlashSaleCheckoutReservation(
                line.flashSaleCampaignId(),
                line.flashSaleItemId(),
                line.productId(),
                line.variantId(),
                line.flashSaleReservationToken().trim(),
                line.quantity(),
                item.getSalePrice(),
                null
        );
    }

    private void requireReservationReference(OrderLineRequest line) {
        if (line.flashSaleCampaignId() == null || line.flashSaleItemId() == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Flash sale campaign and item are required");
        }
    }

    private void validateItemMatchesLine(FlashSaleItemEntity item, OrderLineRequest line) {
        if (!"active".equalsIgnoreCase(item.getStatus())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Flash sale item is not active");
        }
        if (!Objects.equals(item.getProductId(), line.productId())
                || !Objects.equals(item.getVariantId(), line.variantId())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Flash sale item does not match checkout line");
        }
        if (!Objects.equals(item.getId(), line.flashSaleItemId())
                || !Objects.equals(item.getCampaignId(), line.flashSaleCampaignId())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Flash sale reference is invalid");
        }
        if (line.quantity() > item.getPerUserLimit()) {
            throw new BusinessException(HttpStatus.CONFLICT, "Flash sale purchase limit exceeded");
        }
    }

    private void validateItemMatchesReservation(FlashSaleItemEntity item, FlashSaleCheckoutReservation reservation) {
        if (!Objects.equals(item.getProductId(), reservation.productId())
                || !Objects.equals(item.getVariantId(), reservation.variantId())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Flash sale item does not match checkout line");
        }
    }

    private BusinessException reservationConflict(String status) {
        return switch (status) {
            case "EXPIRED" -> new BusinessException(HttpStatus.CONFLICT, "Flash sale reservation has expired");
            case "OWNER_MISMATCH" -> new BusinessException(HttpStatus.FORBIDDEN, "Flash sale reservation belongs to another user");
            case "QUANTITY_MISMATCH" -> new BusinessException(HttpStatus.CONFLICT, "Flash sale reservation quantity does not match checkout line");
            case "NOT_FOUND" -> new BusinessException(HttpStatus.CONFLICT, "Flash sale reservation is not active");
            default -> new BusinessException(HttpStatus.CONFLICT, "Flash sale reservation cannot be confirmed");
        };
    }

    private boolean hasReservationToken(OrderLineRequest line) {
        return line.flashSaleReservationToken() != null && !line.flashSaleReservationToken().isBlank();
    }

    private OffsetDateTime firstNonNull(OffsetDateTime first, OffsetDateTime second, OffsetDateTime fallback) {
        if (first != null) {
            return first;
        }
        return second == null ? fallback : second;
    }
}
