package com.ecommerce.commerce.service;

import com.ecommerce.commerce.config.FlashSaleProperties;
import com.ecommerce.commerce.dto.FlashSaleItemResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

@Service
public class FlashSaleQueryService {

    private static final int MAX_LIMIT = 30;

    private final JdbcTemplate jdbcTemplate;
    private final FlashSaleProperties properties;

    public FlashSaleQueryService(JdbcTemplate jdbcTemplate, FlashSaleProperties properties) {
        this.jdbcTemplate = jdbcTemplate;
        this.properties = properties;
    }

    public List<FlashSaleItemResponse> getActiveItems(int requestedLimit) {
        if (!properties.isEnabled()) {
            return List.of();
        }

        int limit = Math.max(1, Math.min(requestedLimit, MAX_LIMIT));
        return jdbcTemplate.query("""
                        select
                            fsi.campaign_id,
                            fsc.name as campaign_name,
                            fsc.starts_at,
                            fsc.ends_at,
                            fsi.id as item_id,
                            fsi.product_id,
                            fsi.variant_id,
                            coalesce(nullif(pv.variant_name, ''), p.name) as product_name,
                            coalesce(pv.thumbnail_url, p.thumbnail_url) as product_thumbnail,
                            coalesce(pv.price, p.base_price, fsi.sale_price) as original_price,
                            fsi.sale_price,
                            fsi.stock_limit,
                            fsi.reserved_count,
                            fsi.sold_count,
                            greatest(fsi.stock_limit - fsi.reserved_count - fsi.sold_count, 0) as remaining_stock,
                            fsi.per_user_limit,
                            fsi.status
                        from flash_sale_items fsi
                        join flash_sale_campaigns fsc on fsc.id = fsi.campaign_id
                        join products p on p.id = fsi.product_id
                        left join product_variants pv on pv.id = fsi.variant_id
                        where fsc.status = 'active'
                          and fsi.status = 'active'
                          and now() between fsc.starts_at and fsc.ends_at
                          and p.active = true
                          and p.published = true
                          and p.deleted_at is null
                        order by fsc.ends_at asc, fsi.id asc
                        limit ?
                        """,
                (rs, rowNum) -> mapItem(rs),
                limit
        );
    }

    public Optional<FlashSaleItemResponse> getActiveItemForProduct(Long productId) {
        if (!properties.isEnabled() || productId == null) {
            return Optional.empty();
        }

        List<FlashSaleItemResponse> items = jdbcTemplate.query("""
                        select
                            fsi.campaign_id,
                            fsc.name as campaign_name,
                            fsc.starts_at,
                            fsc.ends_at,
                            fsi.id as item_id,
                            fsi.product_id,
                            fsi.variant_id,
                            coalesce(nullif(pv.variant_name, ''), p.name) as product_name,
                            coalesce(pv.thumbnail_url, p.thumbnail_url) as product_thumbnail,
                            coalesce(pv.price, p.base_price, fsi.sale_price) as original_price,
                            fsi.sale_price,
                            fsi.stock_limit,
                            fsi.reserved_count,
                            fsi.sold_count,
                            greatest(fsi.stock_limit - fsi.reserved_count - fsi.sold_count, 0) as remaining_stock,
                            fsi.per_user_limit,
                            fsi.status
                        from flash_sale_items fsi
                        join flash_sale_campaigns fsc on fsc.id = fsi.campaign_id
                        join products p on p.id = fsi.product_id
                        left join product_variants pv on pv.id = fsi.variant_id
                        where fsi.product_id = ?
                          and fsc.status = 'active'
                          and fsi.status = 'active'
                          and now() between fsc.starts_at and fsc.ends_at
                          and p.active = true
                          and p.published = true
                          and p.deleted_at is null
                        order by fsc.ends_at asc, fsi.id asc
                        limit 1
                        """,
                (rs, rowNum) -> mapItem(rs),
                productId
        );

        return items.stream().findFirst();
    }

    public Optional<FlashSaleItemResponse> getActiveItem(Long campaignId, Long itemId) {
        if (!properties.isEnabled() || campaignId == null || itemId == null) {
            return Optional.empty();
        }

        List<FlashSaleItemResponse> items = jdbcTemplate.query("""
                        select
                            fsi.campaign_id,
                            fsc.name as campaign_name,
                            fsc.starts_at,
                            fsc.ends_at,
                            fsi.id as item_id,
                            fsi.product_id,
                            fsi.variant_id,
                            coalesce(nullif(pv.variant_name, ''), p.name) as product_name,
                            coalesce(pv.thumbnail_url, p.thumbnail_url) as product_thumbnail,
                            coalesce(pv.price, p.base_price, fsi.sale_price) as original_price,
                            fsi.sale_price,
                            fsi.stock_limit,
                            fsi.reserved_count,
                            fsi.sold_count,
                            greatest(fsi.stock_limit - fsi.reserved_count - fsi.sold_count, 0) as remaining_stock,
                            fsi.per_user_limit,
                            fsi.status
                        from flash_sale_items fsi
                        join flash_sale_campaigns fsc on fsc.id = fsi.campaign_id
                        join products p on p.id = fsi.product_id
                        left join product_variants pv on pv.id = fsi.variant_id
                        where fsi.campaign_id = ?
                          and fsi.id = ?
                          and fsc.status = 'active'
                          and fsi.status = 'active'
                          and now() between fsc.starts_at and fsc.ends_at
                          and p.active = true
                          and p.published = true
                          and p.deleted_at is null
                        limit 1
                        """,
                (rs, rowNum) -> mapItem(rs),
                campaignId,
                itemId
        );

        return items.stream().findFirst();
    }

    private FlashSaleItemResponse mapItem(ResultSet rs) throws SQLException {
        return new FlashSaleItemResponse(
                rs.getLong("campaign_id"),
                rs.getString("campaign_name"),
                rs.getObject("starts_at", java.time.OffsetDateTime.class),
                rs.getObject("ends_at", java.time.OffsetDateTime.class),
                rs.getLong("item_id"),
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
                rs.getString("status")
        );
    }

    private Long getNullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }
}