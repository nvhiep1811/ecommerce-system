import { Colors } from "@/constants/theme";
import { FlashSaleItem } from "@/types/flashSale";
import { formatCurrencyVnd } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const formatTimeLeft = (endsAt: string, now: number) => {
  const end = new Date(endsAt).getTime();
  const diff = Math.max(0, end - now);
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
};

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
  const soldLikeCount = Math.max(
    0,
    item.stock_limit - item.remaining_stock,
  );
  const progress =
    item.stock_limit > 0
      ? Math.min(1, Math.max(0, soldLikeCount / item.stock_limit))
      : 0;
  const soldOut = item.remaining_stock <= 0;

  return (
    <Pressable style={styles.card} onPress={() => onPress(item)}>
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
      <View style={styles.stockTrack}>
        <View style={[styles.stockFill, { width: `${progress * 100}%` }]} />
        <Text style={styles.stockText}>
          {soldOut ? "Đã hết" : `Còn ${item.remaining_stock}`}
        </Text>
      </View>
      <View style={styles.timeRow}>
        <Ionicons name="time-outline" size={13} color="#b91c1c" />
        <Text style={styles.timeText}>{formatTimeLeft(item.ends_at, now)}</Text>
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
  stockTrack: {
    height: 20,
    marginTop: 8,
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
  stockText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
