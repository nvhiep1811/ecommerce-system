export type Coupon = {
  id: number;                  // ID tự tăng
  code: string;                // Mã giảm giá
  description?: string;        // Mô tả coupon (có thể null)
  discount_type: "percent" | "fixed"; // Loại giảm giá
  discount_value: number;      // Giá trị giảm (theo % hoặc số tiền)
  min_order_value?: number;    // Giá trị đơn tối thiểu áp dụng
  max_discount?: number;       // Giảm tối đa (với loại percent)
  start_date: string;          // Ngày bắt đầu (ISO format)
  end_date: string;            // Ngày kết thúc (ISO format)
  usage_limit?: number;        // Giới hạn số lần sử dụng
  used_count?: number;         // Số lần đã dùng
  active: boolean;             // Còn hiệu lực hay không
  created_at: string;          // Ngày tạo (ISO format)
};
