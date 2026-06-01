import { ApiError, apiClient } from "@/services/apiClient";
import { FlashSaleClaimResult, FlashSaleItem } from "@/types/flashSale";

const mapFlashSaleItem = (payload: any): FlashSaleItem => ({
  campaign_id: payload.campaignId,
  campaign_name: payload.campaignName ?? "Flash sale",
  starts_at: payload.startsAt,
  ends_at: payload.endsAt,
  item_id: payload.itemId,
  product_id: payload.productId,
  variant_id: payload.variantId ?? null,
  product_name: payload.productName ?? "",
  product_thumbnail: payload.productThumbnail ?? null,
  original_price: Number(payload.originalPrice ?? payload.salePrice ?? 0),
  sale_price: Number(payload.salePrice ?? 0),
  stock_limit: Number(payload.stockLimit ?? 0),
  reserved_count: Number(payload.reservedCount ?? 0),
  sold_count: Number(payload.soldCount ?? 0),
  remaining_stock: Number(payload.remainingStock ?? 0),
  per_user_limit: Number(payload.perUserLimit ?? 1),
  status: payload.status ?? "active",
});

const mapClaimResult = (payload: any): FlashSaleClaimResult => ({
  campaign_id: payload.campaignId,
  item_id: payload.itemId,
  status: payload.status,
  reservation_token: payload.reservationToken,
  quantity: Number(payload.quantity ?? 1),
  remaining_stock: Number(payload.remainingStock ?? 0),
  expires_at: payload.expiresAt,
  message: payload.message ?? "",
});

const createRequestId = () =>
  `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getActiveItems = async (limit = 10): Promise<FlashSaleItem[]> => {
  const data = await apiClient.get<{ items: any[] }>(
    `/commerce/flash-sales/active?limit=${encodeURIComponent(String(limit))}`,
  );
  return (data.items ?? []).map(mapFlashSaleItem);
};

const getActiveItemByProduct = async (
  productId: number,
): Promise<FlashSaleItem | null> => {
  try {
    const data = await apiClient.get<{ item: any | null }>(
      `/commerce/flash-sales/products/${productId}/active`,
    );
    return data.item ? mapFlashSaleItem(data.item) : null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
};

const getActiveItem = async ({
  campaignId,
  itemId,
}: {
  campaignId: number;
  itemId: number;
}): Promise<FlashSaleItem | null> => {
  try {
    const data = await apiClient.get<{ item: any | null }>(
      `/commerce/flash-sales/${campaignId}/items/${itemId}`,
    );
    return data.item ? mapFlashSaleItem(data.item) : null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
};

const claim = async ({
  campaignId,
  itemId,
  quantity,
}: {
  campaignId: number;
  itemId: number;
  quantity: number;
}): Promise<FlashSaleClaimResult> => {
  const data = await apiClient.post<any>(
    `/commerce/flash-sales/${campaignId}/items/${itemId}/claim`,
    {
      requestId: createRequestId(),
      quantity,
    },
  );
  return mapClaimResult(data);
};

export const flashSaleService = {
  getActiveItems,
  getActiveItemByProduct,
  getActiveItem,
  claim,
};
