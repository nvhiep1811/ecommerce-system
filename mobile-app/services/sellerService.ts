import { productService } from "@/services/productService";
import { orderService } from "@/services/orderService";
import { Product } from "@/types/product";
import { Order } from "@/types/order";


export type TimeRange = "today" | "yesterday" | "week" | "month";

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
  const start = new Date(now);
  const end = new Date(now);

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

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
  } else if (range === "week") {
    const day = start.getDay() || 7; // Xem Chủ nhật là ngày thứ 7
    if (isPrevious) {
      start.setDate(start.getDate() - day + 1 - 7); // Thứ 2 tuần trước
      end.setDate(start.getDate() + 6); // Chủ nhật tuần trước
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(start.getDate() - day + 1); // Thứ 2 tuần này
    }
  } else if (range === "month") {
    if (isPrevious) {
      start.setMonth(start.getMonth() - 1);
      start.setDate(1); // Ngày 1 tháng trước
      end.setMonth(end.getMonth(), 0); // Ngày cuối cùng tháng trước
    } else {
      start.setDate(1); // Ngày 1 tháng này
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

  // Helper để lọc đơn hàng theo mốc thời gian
  const filterOrdersByTime = (start: Date, end: Date) => {
    return orders.filter((order) => {
      const orderDate = new Date(order.created_at ?? 0);
      return orderDate >= start && orderDate <= end;
    });
  };

  const currentPeriodOrders = filterOrdersByTime(currentBounds.start, currentBounds.end);
  const previousPeriodOrders = filterOrdersByTime(previousBounds.start, previousBounds.end);

  // Tính toán doanh thu và số lượng (Chỉ tính đơn đã hoàn thành/giao)
  // Tính toán doanh thu và số lượng
  const calculateRevenueAndSales = (periodOrders: Order[]) => {
    let revenue = 0;
    let salesCount = 0;
    let validOrdersCount = 0;

    periodOrders.forEach((order) => {
      const status = String(order.status ?? "").toLowerCase();
      if (!["cancelled", "returned", "refunded"].includes(status)) {
        revenue += order.total ?? 0;
        validOrdersCount += 1;
        
        const itemCount = (order.items ?? []).reduce(
          (sum, item) => sum + (item.quantity ?? 0),
          0
        );
        salesCount += itemCount;
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