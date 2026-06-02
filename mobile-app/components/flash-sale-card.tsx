import { Colors } from "@/constants/theme";
import { FlashSaleItem } from "@/types/flashSale";
import { formatCurrencyVnd } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const formatTimeLeft = (endsAt: string, now: number) => {
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(end)) {
    return "--:--:--";
  }
  const diff = Math.max(0, end - now);
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
};

const toSafeNumber = (value: number | null | undefined) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

const formatUnits = (value: number) =>
  Math.round(value).toLocaleString("vi-VN");

function FlashSaleCard({
  item,
  onPress,
}: {
  item: FlashSaleItem;
  onPress: (item: FlashSaleItem) => void;
}) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const endsAt = new Date(item.ends_at).getTime();
  const saleEnded = Number.isFinite(endsAt) && endsAt <= now;
  const totalStock = Math.max(0, toSafeNumber(item.stock_limit));
  const remainingStock = Math.max(0, toSafeNumber(item.remaining_stock));
  const soldLikeCount = Math.max(0, totalStock - remainingStock);
  const progress =
    totalStock > 0
      ? Math.min(1, Math.max(0, soldLikeCount / totalStock))
      : 0;
  const soldOut = remainingStock <= 0;
  const unavailable = soldOut || saleEnded;
  const discountPercent =
    item.original_price > item.sale_price && item.original_price > 0
      ? Math.round(
          ((item.original_price - item.sale_price) / item.original_price) * 100,
        )
      : 0;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        unavailable && styles.cardUnavailable,
        pressed && styles.cardPressed,
      ]}
      onPress={() => onPress(item)}
    >
      <View style={styles.imageWrap}>
        <Image
          source={
            item.product_thumbnail
              ? { uri: item.product_thumbnail }
              : require("../assets/images/favicon.png")
          }
          style={styles.image}
          contentFit="contain"
        />
        <View style={styles.badge}>
          <Ionicons name="flash" size={12} color="#fff" />
          <Text style={styles.badgeText}>Deal sốc</Text>
        </View>
        {discountPercent > 0 ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discountPercent}%</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {item.product_name}
      </Text>
      <View style={styles.priceRow}>
        <Text style={styles.salePrice}>{formatCurrencyVnd(item.sale_price)}</Text>
      </View>
      {item.original_price > item.sale_price ? (
        <Text style={styles.originalPrice}>
          {formatCurrencyVnd(item.original_price)}
        </Text>
      ) : null}
      <View style={styles.stockMetaRow}>
        <Text
          style={[
            styles.stockMetaText,
            unavailable && styles.stockMetaDanger,
          ]}
          numberOfLines={1}
        >
          {saleEnded
            ? "Đã kết thúc"
            : soldOut
              ? "Đã hết"
              : `Còn ${formatUnits(remainingStock)}`}
        </Text>
        <Text style={styles.stockSoldText} numberOfLines={1}>
          Đã giữ/bán {formatUnits(soldLikeCount)}
        </Text>
      </View>
      <View style={styles.stockTrack}>
        <View style={[styles.stockFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.timeRow}>
        <Ionicons name="time-outline" size={13} color="#b91c1c" />
        <Text style={styles.timeText}>
          {saleEnded ? "Kết thúc" : formatTimeLeft(item.ends_at, now)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 156,
    marginRight: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(230,44,47,0.12)",
    backgroundColor: "#fff",
    padding: 10,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
  },
  cardUnavailable: {
    opacity: 0.72,
  },
  imageWrap: {
    position: "relative",
    height: 112,
    borderRadius: 8,
    backgroundColor: "#fff7ed",
    marginBottom: 8,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  badge: {
    position: "absolute",
    left: 6,
    top: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.light.tint,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  discountBadge: {
    position: "absolute",
    right: 6,
    top: 6,
    minWidth: 36,
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "#111827",
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  discountText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
  },
  name: {
    height: 36,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: "#111827",
  },
  priceRow: {
    marginTop: 6,
  },
  salePrice: {
    color: Colors.light.tint,
    fontSize: 15,
    fontWeight: "900",
  },
  originalPrice: {
    marginTop: 2,
    color: "#9ca3af",
    fontSize: 11,
    textDecorationLine: "line-through",
  },
  stockMetaRow: {
    marginTop: 8,
    minHeight: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  stockMetaText: {
    flexShrink: 0,
    color: "#b91c1c",
    fontSize: 11,
    fontWeight: "900",
  },
  stockMetaDanger: {
    color: "#6b7280",
  },
  stockSoldText: {
    minWidth: 0,
    flex: 1,
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "right",
  },
  stockTrack: {
    height: 8,
    marginTop: 5,
    borderRadius: 999,
    backgroundColor: "#fee2e2",
    overflow: "hidden",
    justifyContent: "center",
  },
  stockFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#fb7185",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 7,
  },
  timeText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "800",
  },
});

export default React.memo(FlashSaleCard);
