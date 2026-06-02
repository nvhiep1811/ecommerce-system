package com.ecommerce.commerce.service;

import com.ecommerce.commerce.config.FlashSaleProperties;
import com.ecommerce.commerce.domain.FlashSaleCampaignEntity;
import com.ecommerce.commerce.domain.FlashSaleItemEntity;
import com.ecommerce.commerce.dto.AdminFlashSaleCampaignResponse;
import com.ecommerce.commerce.dto.AdminFlashSaleCreateRequest;
import com.ecommerce.commerce.dto.AdminFlashSaleItemRequest;
import com.ecommerce.commerce.dto.AdminFlashSaleItemResponse;
import com.ecommerce.commerce.repository.FlashSaleCampaignRepository;
import com.ecommerce.commerce.repository.FlashSaleItemRepository;
import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.web.BusinessException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class AdminFlashSaleService {

    private static final Set<String> CAMPAIGN_STATUSES =
            Set.of("draft", "scheduled", "active", "ended", "cancelled");
    private static final Set<String> ITEM_STATUSES =
            Set.of("scheduled", "active", "sold_out", "ended", "cancelled");

    private final FlashSaleCampaignRepository campaignRepository;
    private final FlashSaleItemRepository itemRepository;
    private final JdbcTemplate jdbcTemplate;
    private final FlashSaleStockStore stockStore;
    private final FlashSaleProperties properties;

    public AdminFlashSaleService(
            FlashSaleCampaignRepository campaignRepository,
            FlashSaleItemRepository itemRepository,
            JdbcTemplate jdbcTemplate,
            FlashSaleStockStore stockStore,
            FlashSaleProperties properties
    ) {
        this.campaignRepository = campaignRepository;
        this.itemRepository = itemRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.stockStore = stockStore;
        this.properties = properties;
    }

    @Transactional(readOnly = true)
    public List<AdminFlashSaleCampaignResponse> listCampaigns(int requestedLimit) {
        int limit = Math.max(1, Math.min(requestedLimit, 100));
        return queryCampaigns("""
                with selected_campaigns as (
                    select *
                    from flash_sale_campaigns
                    order by starts_at desc, id desc
                    limit ?
                )
                select
                    campaign.id as campaign_id,
                    campaign.name as campaign_name,
                    campaign.status as campaign_status,
                    campaign.starts_at,
                    campaign.ends_at,
                    item.id as item_id,
                    item.product_id,
                    item.variant_id,
                    coalesce(nullif(variant.variant_name, ''), product.name) as product_name,
                    coalesce(variant.thumbnail_url, product.thumbnail_url) as product_thumbnail,
                    coalesce(variant.price, product.base_price, item.sale_price) as original_price,
                    item.sale_price,
                    item.stock_limit,
                    item.reserved_count,
                    item.sold_count,
                    greatest(item.stock_limit - item.reserved_count - item.sold_count, 0) as remaining_stock,
                    item.per_user_limit,
                    item.status as item_status
                from selected_campaigns campaign
                left join flash_sale_items item on item.campaign_id = campaign.id
                left join products product on product.id = item.product_id
                left join product_variants variant on variant.id = item.variant_id
                order by campaign.starts_at desc, campaign.id desc, item.id asc
                """, limit);
    }

    @Transactional
    public AdminFlashSaleCampaignResponse createCampaign(
            AuthenticatedUser principal,
            AdminFlashSaleCreateRequest request
    ) {
        requireAdmin(principal);
        validateTimeRange(request.startsAt(), request.endsAt());
        validateItems(request.items());

        FlashSaleCampaignEntity campaign = new FlashSaleCampaignEntity();
        campaign.setName(request.name().trim());
        campaign.setStatus(normalizeStatus(request.status(), "active", CAMPAIGN_STATUSES));
        campaign.setStartsAt(request.startsAt());
        campaign.setEndsAt(request.endsAt());
        FlashSaleCampaignEntity savedCampaign = campaignRepository.save(campaign);

        List<FlashSaleItemEntity> items = request.items().stream()
                .map(itemRequest -> toItemEntity(savedCampaign.getId(), itemRequest))
                .toList();
        List<FlashSaleItemEntity> savedItems = itemRepository.saveAllAndFlush(items);

        if (Boolean.TRUE.equals(request.preloadStock())) {
            preloadStock(savedCampaign.getId(), savedItems);
        }

        return getCampaign(savedCampaign.getId());
    }

    private AdminFlashSaleCampaignResponse getCampaign(Long campaignId) {
        return queryCampaigns("""
                select
                    campaign.id as campaign_id,
                    campaign.name as campaign_name,
                    campaign.status as campaign_status,
                    campaign.starts_at,
                    campaign.ends_at,
                    item.id as item_id,
                    item.product_id,
                    item.variant_id,
                    coalesce(nullif(variant.variant_name, ''), product.name) as product_name,
                    coalesce(variant.thumbnail_url, product.thumbnail_url) as product_thumbnail,
                    coalesce(variant.price, product.base_price, item.sale_price) as original_price,
                    item.sale_price,
                    item.stock_limit,
                    item.reserved_count,
                    item.sold_count,
                    greatest(item.stock_limit - item.reserved_count - item.sold_count, 0) as remaining_stock,
                    item.per_user_limit,
                    item.status as item_status
                from flash_sale_campaigns campaign
                left join flash_sale_items item on item.campaign_id = campaign.id
                left join products product on product.id = item.product_id
                left join product_variants variant on variant.id = item.variant_id
                where campaign.id = ?
                order by item.id asc
                """, campaignId)
                .stream()
                .findFirst()
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "Flash sale campaign not found"));
    }

    private List<AdminFlashSaleCampaignResponse> queryCampaigns(String sql, Object... args) {
        Map<Long, CampaignAccumulator> campaigns = new LinkedHashMap<>();
        jdbcTemplate.query(sql, rs -> {
            Long campaignId = rs.getLong("campaign_id");
            CampaignAccumulator campaign = campaigns.computeIfAbsent(
                    campaignId,
                    ignored -> toAccumulator(rs)
            );
            Long itemId = getNullableLong(rs, "item_id");
            if (itemId != null) {
                campaign.items.add(toItemResponse(rs, campaignId, itemId));
            }
        }, args);

        return campaigns.values().stream()
                .map(CampaignAccumulator::toResponse)
                .toList();
    }

    private CampaignAccumulator toAccumulator(ResultSet rs) {
        try {
            return new CampaignAccumulator(
                    rs.getLong("campaign_id"),
                    rs.getString("campaign_name"),
                    rs.getString("campaign_status"),
                    rs.getObject("starts_at", OffsetDateTime.class),
                    rs.getObject("ends_at", OffsetDateTime.class)
            );
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to map flash sale campaign", exception);
        }
    }

    private AdminFlashSaleItemResponse toItemResponse(ResultSet rs, Long campaignId, Long itemId) throws SQLException {
        return new AdminFlashSaleItemResponse(
                itemId,
                campaignId,
                rs.getLong("product_id"),
                getNullableLong(rs, "variant_id"),
                rs.getString("product_name"),
                rs.getString("product_thumbnail"),
                rs.getBigDecimal("original_price"),
                rs.getBigDecimal("sale_price"),
                rs.getInt("stock_limit"),
                rs.getInt("reserved_count"),
                rs.getInt("sold_count"),
                rs.getLong("remaining_stock"),
                rs.getInt("per_user_limit"),
                rs.getString("item_status")
        );
    }

    private FlashSaleItemEntity toItemEntity(Long campaignId, AdminFlashSaleItemRequest request) {
        FlashSaleItemEntity item = new FlashSaleItemEntity();
        item.setCampaignId(campaignId);
        item.setProductId(request.productId());
        item.setVariantId(request.variantId());
        item.setSalePrice(request.salePrice());
        item.setStockLimit(request.stockLimit());
        item.setPerUserLimit(request.perUserLimit());
        item.setReservedCount(0);
        item.setSoldCount(0);
        item.setStatus(normalizeStatus(request.status(), "active", ITEM_STATUSES));
        return item;
    }

    private void preloadStock(Long campaignId, List<FlashSaleItemEntity> items) {
        if (!properties.isEnabled()) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "Flash sale flow is disabled");
        }

        try {
            for (FlashSaleItemEntity item : items) {
                stockStore.preload(campaignId, item.getId(), item.getStockLimit(), item.getPerUserLimit());
            }
        } catch (DataAccessException | IllegalStateException exception) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "Flash sale stock store is unavailable");
        }
    }

    private void validateTimeRange(OffsetDateTime startsAt, OffsetDateTime endsAt) {
        if (endsAt == null || startsAt == null || !endsAt.isAfter(startsAt)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Flash sale end time must be after start time");
        }
    }

    private void validateItems(List<AdminFlashSaleItemRequest> items) {
        if (items == null || items.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "At least one flash sale item is required");
        }

        Set<String> seen = new HashSet<>();
        for (AdminFlashSaleItemRequest item : items) {
            String key = item.productId() + ":" + (item.variantId() == null ? "" : item.variantId());
            if (!seen.add(key)) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "Duplicate flash sale product in campaign");
            }
        }
    }

    private String normalizeStatus(String value, String fallback, Set<String> allowed) {
        String normalized = value == null || value.isBlank() ? fallback : value.trim().toLowerCase();
        if (!allowed.contains(normalized)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Unsupported flash sale status: " + value);
        }
        return normalized;
    }

    private void requireAdmin(AuthenticatedUser principal) {
        List<String> roles = principal.roles() == null ? List.of() : principal.roles();
        boolean admin = roles.stream()
                .anyMatch(role -> "ADMIN".equalsIgnoreCase(role) || "ROLE_ADMIN".equalsIgnoreCase(role));
        if (!admin) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "Admin permission is required");
        }
    }

    private Long getNullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    private static class CampaignAccumulator {
        private final Long id;
        private final String name;
        private final String status;
        private final OffsetDateTime startsAt;
        private final OffsetDateTime endsAt;
        private final List<AdminFlashSaleItemResponse> items = new ArrayList<>();

        private CampaignAccumulator(
                Long id,
                String name,
                String status,
                OffsetDateTime startsAt,
                OffsetDateTime endsAt
        ) {
            this.id = id;
            this.name = name;
            this.status = status;
            this.startsAt = startsAt;
            this.endsAt = endsAt;
        }

        private AdminFlashSaleCampaignResponse toResponse() {
            return new AdminFlashSaleCampaignResponse(id, name, status, startsAt, endsAt, List.copyOf(items));
        }
    }
}
