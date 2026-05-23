import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { couponService } from "@/services/couponService";
import { UpdateCouponRequest } from "@/types/coupons";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import ToastBanner from "@/components/ui/toast-banner";
import {
  goBackOrReplace,
  goToSellerCoupons,
  SELLER_COUPONS_ROUTE,
} from "@/utils/sellerNavigation";

export function EditCouponScreen() {
  const { isLoading: authLoading } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type?: "success" | "error" | "info";
  } | null>(null);

  // Form State
  const [code, setCode] = useState(""); // Code chỉ để hiển thị, không gửi lên khi update
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderValue, setMinOrderValue] = useState("0");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [active, setActive] = useState(true);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");


  useEffect(() => {
    const fetchCouponDetails = async () => {
      if (!id) return;
      try {
        const coupon = await couponService.getCouponById(Number(id));
        
        setCode(coupon.code);
        setDescription(coupon.description || "");
        setDiscountType(coupon.discount_type);
        setDiscountValue(coupon.discount_value.toString());
        setMinOrderValue(coupon.min_order_value ? coupon.min_order_value.toString() : " ");
        setMaxDiscount(coupon.max_discount ? coupon.max_discount.toString() : "");
        setUsageLimit(coupon.usage_limit ? coupon.usage_limit.toString() : "");
        setActive(coupon.active);
        
        // Format ISO Date sang YYYY-MM-DD để hiển thị tạm vào TextInput
        if (coupon.start_date) {
          setStartAt(coupon.start_date.substring(0, 10));
        }
        if (coupon.end_date) {
          setEndAt(coupon.end_date.substring(0, 10));
        }
      } catch {
        setToast({ message: "Không thể tải thông tin coupon", type: "error" });
      } finally {
        setIsLoadingData(false);
      }
    };

    if (!authLoading) {
      void fetchCouponDetails();
    }
  }, [id, authLoading]);

  const handleSave = async () => {
    if (!id) return;

    // 1. Validation cơ bản
    const parsedDiscountValue = Number(discountValue);
    if (!discountValue || isNaN(parsedDiscountValue) || parsedDiscountValue <= 0) {
      setToast({ message: "Mức giảm giá phải lớn hơn 0", type: "error" });
      return;
    }

    if (discountType === "percent" && parsedDiscountValue > 100) {
      setToast({ message: "Mức giảm giá phần trăm không được vượt quá 100%", type: "error" });
      return;
    }

    const parsedMinOrder = Number(minOrderValue);
    if (isNaN(parsedMinOrder) || parsedMinOrder < 0) {
      setToast({ message: "Đơn tối thiểu không hợp lệ", type: "error" });
      return;
    }

    // 2. Prepare payload (Không gửi 'code' vì UpdateCouponRequest Omit 'code')
    const payload: UpdateCouponRequest = {
      description: description.trim() || undefined,
      discountType,
      discountValue: parsedDiscountValue,
      minOrderValue: parsedMinOrder,
      active,
    };

    if (maxDiscount) {
      payload.maxDiscount = Number(maxDiscount);
    } else {
      payload.maxDiscount = undefined; // Hoặc null tuỳ backend xử lý nếu muốn xóa giới hạn
    }

    if (usageLimit) {
      payload.usageLimit = Number(usageLimit);
    }

    if (startAt) {
      payload.startAt = new Date(startAt).toISOString(); 
    }
    
    if (endAt) {
      payload.endAt = new Date(endAt).toISOString();
    }

    // 3. Gọi API
    try {
      setIsSubmitting(true);
      await couponService.updateCoupon(Number(id), payload);
      setToast({ message: "Cập nhật coupon thành công!", type: "success" });
      
      setTimeout(() => {
        goToSellerCoupons();
      }, 1000);
      
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Có lỗi xảy ra khi cập nhật coupon",
        type: "error",
      });
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoadingData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => goBackOrReplace(SELLER_COUPONS_ROUTE)}
          style={styles.headerButton}
          disabled={isSubmitting}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chỉnh sửa Coupon</Text>
        <TouchableOpacity 
          style={styles.headerSaveButton} 
          onPress={handleSave}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.headerSaveText}>Lưu</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Thông tin cơ bản */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Thông tin cơ bản</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mã Coupon</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={code}
                editable={false} // Khóa không cho sửa mã
              />
              <Text style={styles.subLabel}>Mã coupon không thể thay đổi sau khi tạo.</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mô tả</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Nhập mô tả chi tiết cho coupon..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Thiết lập giảm giá */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Thiết lập giảm giá</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Loại giảm giá</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    discountType === "percent" && styles.typeOptionActive,
                  ]}
                  onPress={() => setDiscountType("percent")}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      discountType === "percent" && styles.typeOptionTextActive,
                    ]}
                  >
                    Phần trăm (%)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeOption,
                    discountType === "fixed" && styles.typeOptionActive,
                  ]}
                  onPress={() => setDiscountType("fixed")}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      discountType === "fixed" && styles.typeOptionTextActive,
                    ]}
                  >
                    Số tiền cố định
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Mức giảm ({discountType === "percent" ? "%" : "VNĐ"}) <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder={discountType === "percent" ? "Ví dụ: 10" : "Ví dụ: 50000"}
                value={discountValue}
                onChangeText={setDiscountValue}
                keyboardType="numeric"
              />
            </View>

            {discountType === "percent" && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mức giảm tối đa (VNĐ)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Để trống nếu không giới hạn"
                  value={maxDiscount}
                  onChangeText={setMaxDiscount}
                  keyboardType="numeric"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Giá trị đơn hàng tối thiểu (VNĐ) <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="Mặc định là 0"
                value={minOrderValue}
                onChangeText={setMinOrderValue}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Điều kiện sử dụng */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Điều kiện sử dụng</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tổng lượt sử dụng tối đa</Text>
              <TextInput
                style={styles.input}
                placeholder="Để trống nếu không giới hạn"
                value={usageLimit}
                onChangeText={setUsageLimit}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Từ ngày</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={startAt}
                  onChangeText={setStartAt}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Đến ngày</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={endAt}
                  onChangeText={setEndAt}
                />
              </View>
            </View>

            <View style={styles.switchRow}>
              <View>
                <Text style={styles.label}>Trạng thái hoạt động</Text>
                <Text style={styles.subLabel}>Cho phép khách hàng sử dụng mã này</Text>
              </View>
              <Switch
                value={active}
                onValueChange={setActive}
                trackColor={{ false: "#d1d5db", true: Colors.light.tint }}
                thumbColor={Platform.OS === "ios" ? "#fff" : active ? "#fff" : "#f4f3f4"}
              />
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <ToastBanner
        message={toast?.message ?? null}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />
    </SafeAreaView>
  );
}

export default EditCouponScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  keyboardView: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 56,
    backgroundColor: Colors.light.tint,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "white",
    textAlign: "center",
  },
  headerSaveButton: {
    width: 50,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  headerSaveText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.05)" } as any)
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 2,
        }),
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  required: {
    color: "#ef4444",
  },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 15,
    color: "#1f2937",
  },
  inputDisabled: {
    backgroundColor: "#e5e7eb",
    color: "#6b7280",
  },
  textArea: {
    minHeight: 80,
  },
  typeSelector: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 4,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 6,
  },
  typeOptionActive: {
    backgroundColor: "white",
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.1)" } as any)
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 1,
          elevation: 1,
        }),
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  typeOptionTextActive: {
    color: Colors.light.tint,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
});
