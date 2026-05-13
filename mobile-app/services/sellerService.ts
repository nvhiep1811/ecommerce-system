import { productService } from "@/services/productService";
import { orderService } from "@/services/orderService";
import { Product } from "@/types/product";
import { Order } from "@/types/order";


export type TimeRange = "today" | "yesterday" | "last7days" | "last30days" | "thisMonth" | "thisYear" | "allTime";

export interface PeriodMetrics {
  revenue: number;
  ordersCount: number;
  salesCount: number;
  revenueTrend?: number;
  ordersTrend?: number;
}

export interface GeneralMetrics {
  totalProducts: number;
  activeProducts: number;
  outOfStockProducts: number;
  pendingOrdersCount: number; // Đơn chờ xử lý là realtime, không phụ thuộc bộ lọc thời gian
}

export interface SellerDashboardData {
  periodMetrics: PeriodMetrics;
  generalMetrics: GeneralMetrics;
  products: Product[];
  orders: Order[];
}

// --- 2. CÁC HÀM HELPER XỬ LÝ THỜI GIAN ---

/**
 * Lấy mốc thời gian bắt đầu và kết thúc cho kỳ hiện tại hoặc kỳ trước đó
 */
const getTimeBounds = (range: TimeRange, isPrevious: boolean = false) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (range === "today") {
    if (isPrevious) {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    }
  } else if (range === "yesterday") {
    if (isPrevious) {
      start.setDate(start.getDate() - 2);
      end.setDate(end.getDate() - 2);
    } else {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    }
  } else if (range === "last7days") {
    if (isPrevious) {
      start.setDate(start.getDate() - 13);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(start.getDate() - 6);
    }
  } else if (range === "last30days") {
    if (isPrevious) {
      start.setDate(start.getDate() - 59);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 29);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(start.getDate() - 29);
    }
  } else if (range === "thisMonth") {
    if (isPrevious) {
      start.setMonth(start.getMonth() - 1);
      start.setDate(1); // Ngày 1 tháng trước
      end.setTime(start.getTime());
      end.setMonth(start.getMonth() + 1, 0); // Ngày cuối cùng tháng trước
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1); // Ngày 1 tháng này
      end.setTime(start.getTime());
      end.setMonth(start.getMonth() + 1, 0); // Ngày cuối cùng tháng này
      end.setHours(23, 59, 59, 999);
    }
  } else if (range === "thisYear") {
    if (isPrevious) {
      start.setFullYear(start.getFullYear() - 1);
      start.setMonth(0, 1);
      end.setTime(start.getTime());
      end.setFullYear(start.getFullYear(), 11, 31);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setMonth(0, 1);
      end.setTime(start.getTime());
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
    }
  } else if (range === "allTime") {
    if (isPrevious) {
      // allTime không có previous logic thực sự
      start.setTime(0);
      end.setTime(0);
    } else {
      start.setTime(0); // 1/1/1970
    }
  }

  return { start, end };
};

/**
 * Tính phần trăm tăng trưởng (Trend)
 */
const calculateTrend = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

// --- 3. LOGIC TÍNH TOÁN CHỈ SỐ ---

/**
 * Tính toán tất cả các chỉ số (Kỳ hiện tại, Xu hướng, và Tổng quan)
 */
const calculateMetrics = (
  products: Product[],
  orders: Order[],
  timeRange: TimeRange
): { periodMetrics: PeriodMetrics; generalMetrics: GeneralMetrics } => {
  
  const currentBounds = getTimeBounds(timeRange, false);
  const previousBounds = getTimeBounds(timeRange, true);

  // Tạo Set chứa ID của các sản phẩm thuộc về seller này để đối chiếu nhanh
  const sellerProductIds = new Set(products.map((p) => p.id));

  // Helper để lọc đơn hàng theo mốc thời gian
  const filterOrdersByTime = (start: Date, end: Date) => {
    return orders.filter((order) => {
      const orderDate = new Date(order.created_at ?? 0);
      return orderDate >= start && orderDate <= end;
    });
  };

  const currentPeriodOrders = filterOrdersByTime(currentBounds.start, currentBounds.end);
  const previousPeriodOrders = filterOrdersByTime(previousBounds.start, previousBounds.end);

  // Tính toán doanh thu và số lượng
  const calculateRevenueAndSales = (periodOrders: Order[]) => {
    let revenue = 0;
    let salesCount = 0;
    let validOrdersCount = 0;

    periodOrders.forEach((order) => {
      const status = String(order.status ?? "").toLowerCase();
      // Loại trừ các đơn bị huỷ, trả hàng, hoàn tiền
      if (!["cancelled", "returned", "refunded"].includes(status)) {
        
        // Chỉ lấy các item thuộc về người bán này (vì 1 Order có thể chứa item của nhiều shop khác nhau)
        const sellerItems = (order.items ?? []).filter((item) =>
          sellerProductIds.has(item.product_id)
        );

        if (sellerItems.length > 0) {
          validOrdersCount += 1;
          
          let orderRevenue = 0;
          let itemCount = 0;

          sellerItems.forEach((item) => {
            orderRevenue += item.price * item.quantity;
            itemCount += item.quantity;
          });

          revenue += orderRevenue;
          salesCount += itemCount;
        }
      }
    });

    return { revenue, salesCount, ordersCount: validOrdersCount };
  };

  const currentStats = calculateRevenueAndSales(currentPeriodOrders);
  const previousStats = calculateRevenueAndSales(previousPeriodOrders);

  // 1. Chỉ số theo kỳ (Period Metrics)
  const periodMetrics: PeriodMetrics = {
    revenue: currentStats.revenue,
    ordersCount: currentStats.ordersCount,
    salesCount: currentStats.salesCount,
    revenueTrend: calculateTrend(currentStats.revenue, previousStats.revenue),
    ordersTrend: calculateTrend(currentStats.ordersCount, previousStats.ordersCount),
  };

  // 2. Chỉ số tổng quan (General Metrics - Không phụ thuộc timeRange)
  const generalMetrics: GeneralMetrics = {
    totalProducts: products.length,
    activeProducts: products.filter((p) => (p.stock ?? 0) > 0).length,
    outOfStockProducts: products.filter((p) => (p.stock ?? 0) <= 0).length,
    pendingOrdersCount: orders.filter((order) => {
      const status = String(order.status ?? "").toLowerCase();
      // Đơn hàng đang chờ xử lý liên quan đến người bán này
      return ["pending", "confirmed", "processing"].includes(status);
    }).length,
  };

  return { periodMetrics, generalMetrics };
};

// --- 4. CÁC HÀM SERVICE CHÍNH ---

/**
 * Fetch toàn bộ dữ liệu dashboard của seller dựa trên mốc thời gian
 */
export const fetchSellerDashboardData = async (
  sellerId: string,
  timeRange: TimeRange = "today"
): Promise<SellerDashboardData> => {
  try {
    // Fetch products và orders song song
    const [products, orders] = await Promise.all([
      productService.getSellerProducts(sellerId),
      orderService.getAllOrdersBySeller(sellerId),
    ]);

    // Tính toán metrics dựa trên timeRange
    const { periodMetrics, generalMetrics } = calculateMetrics(products, orders, timeRange);

    return {
      periodMetrics,
      generalMetrics,
      products,
      orders,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Failed to fetch dashboard data"
    );
  }
};

/**
 * Lấy danh sách sản phẩm sắp hết hàng
 */
export const getLowStockProducts = (
  products: Product[],
  threshold: number = 5
): Product[] => {
  return products.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= threshold);
};

/**
 * Lấy các đơn hàng gần đây
 */
export const getRecentOrders = (orders: Order[], limit: number = 5): Order[] => {
  return [...orders]
    .sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime()
    )
    .slice(0, limit);
};

/**
 * Format tiền tệ
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const sellerService = {
  fetchSellerDashboardData,
  getLowStockProducts,
  getRecentOrders,
  formatCurrency,
};