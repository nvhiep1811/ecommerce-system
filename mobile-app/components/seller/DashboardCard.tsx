import { Colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export interface DashboardCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  unit?: string;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  onPress?: () => void;
  loading?: boolean;
  error?: boolean;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  icon,
  label,
  value,
  unit,
  trend,
  onPress,
  loading = false,
  error = false,
}) => {
  return (
    <TouchableOpacity
      style={[styles.card, error && styles.cardError]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons
            name={icon}
            size={24}
            color={error ? "#dc2626" : Colors.light.tint}
          />
        </View>
        <Text style={styles.label}>{label}</Text>
      </View>

      <View style={styles.content}>
        {loading ? (
          <Text style={styles.loadingText}>Đang tải...</Text>
        ) : error ? (
          <Text style={styles.errorText}>Lỗi</Text>
        ) : (
          <>
            <View style={styles.valueRow}>
              <Text style={styles.value}>{value}</Text>
              {unit && <Text style={styles.unit}>{unit}</Text>}
            </View>
            {trend && (
              <View
                style={[
                  styles.trendRow,
                  {
                    backgroundColor: trend.isPositive ? "#dcfce7" : "#fee2e2",
                  },
                ]}
              >
                <Ionicons
                  name={trend.isPositive ? "trending-up" : "trending-down"}
                  size={14}
                  color={trend.isPositive ? "#22c55e" : "#ef4444"}
                />
                <Text
                  style={[
                    styles.trendText,
                    { color: trend.isPositive ? "#22c55e" : "#ef4444" },
                  ]}
                >
                  {trend.value > 0 ? "+" : ""}
                  {trend.value}% {trend.label}
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardError: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.light.tint + "15",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  label: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  content: {
    marginTop: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  errorText: {
    fontSize: 14,
    color: "#dc2626",
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  value: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1f2937",
  },
  unit: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
    marginLeft: 6,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 10,
    alignSelf: "flex-start",
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
