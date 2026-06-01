import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ToastBanner from "@/components/ui/toast-banner";
import {
  goToProfile,
  goToSellerDashboard,
  SELLER_DASHBOARD_ROUTE,
  useSellerHardwareBack,
} from "@/utils/sellerNavigation";

export default function SellerSettingsScreen() {
  const { profile, isLoading: authLoading } = useAuth();
  useSellerHardwareBack(SELLER_DASHBOARD_ROUTE);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type?: "success" | "error" | "info";
  } | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!profile || profile.role !== "seller") {
      setToast({
        message: "Bạn không có quyền truy cập trang này",
        type: "error",
      });
      goToProfile();
      return;
    }

    setLoading(false);
  }, [authLoading, profile]);

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={goToSellerDashboard}
            style={styles.headerButton}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cài đặt shop</Text>
          <View style={styles.headerPlaceholder} />
        </View>
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
          onPress={goToSellerDashboard}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cài đặt shop</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.placeholder}>
          <Ionicons name="settings-outline" size={64} color="#d1d5db" />
          <Text style={styles.placeholderText}>
            Cài đặt shop sẽ sớm được phát triển
          </Text>
          <Text style={styles.placeholderSubtext}>
            Tính năng này đang trong giai đoạn phát triển. Vui lòng quay lại sau.
          </Text>
        </View>
      </ScrollView>

      <ToastBanner
        message={toast?.message ?? null}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.tint,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerPlaceholder: {
    width: 40,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "white",
    textAlign: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 16,
    textAlign: "center",
  },
  placeholderSubtext: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 18,
  },
});
