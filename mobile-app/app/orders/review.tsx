import { Colors } from "@/constants/theme";
import { productService } from "@/services/productService";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OrderReviewScreen() {
  const params = useLocalSearchParams();
  const orderItemId = Number(params.orderItemId);
  const productId = Number(params.productId);
  const productName = String(params.productName ?? "Sản phẩm");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validParams = useMemo(
    () => Number.isFinite(orderItemId) && Number.isFinite(productId),
    [orderItemId, productId],
  );

  useEffect(() => {
    const loadExistingReview = async () => {
      if (!validParams) {
        setLoading(false);
        return;
      }

      try {
        const reviews = await productService.getMyReviews();
        const existing = reviews.find(
          (review) => review.order_item_id === orderItemId,
        );
        if (existing) {
          setRating(existing.rating);
          setComment(existing.comment ?? "");
        }
      } catch {
        // Review loading is an enhancement; submitting still validates on server.
      } finally {
        setLoading(false);
      }
    };

    void loadExistingReview();
  }, [orderItemId, validParams]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/orders/pending?status=delivered");
  };

  const handleSubmit = async () => {
    if (!validParams || submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await productService.submitReview({
        product_id: productId,
        order_item_id: orderItemId,
        rating,
        comment,
      });
      router.replace({
        pathname: "/detail/[id]" as any,
        params: {
          id: String(productId),
        },
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Không thể gửi đánh giá. Vui lòng thử lại.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đánh giá sản phẩm</Text>
        <View style={styles.headerButton} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.card}>
              <Text style={styles.productLabel}>Sản phẩm</Text>
              <Text style={styles.productName}>{productName}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Mức độ hài lòng</Text>
              <View style={styles.starsRow}>
                {Array.from({ length: 5 }).map((_, index) => {
                  const value = index + 1;
                  return (
                    <TouchableOpacity
                      key={value}
                      style={styles.starButton}
                      onPress={() => setRating(value)}
                    >
                      <Ionicons
                        name={value <= rating ? "star" : "star-outline"}
                        size={34}
                        color="#f59e0b"
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Nhận xét</Text>
              <TextInput
                style={styles.commentInput}
                value={comment}
                onChangeText={setComment}
                placeholder="Chia sẻ trải nghiệm thật của bạn về sản phẩm..."
                placeholderTextColor="#9ca3af"
                multiline
                maxLength={2000}
                textAlignVertical="top"
              />
              <Text style={styles.counter}>{comment.length}/2000</Text>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Gửi đánh giá</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.light.tint,
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 14,
    paddingBottom: 28,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  productLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
  },
  starsRow: {
    flexDirection: "row",
    gap: 8,
  },
  starButton: {
    padding: 2,
  },
  commentInput: {
    minHeight: 150,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    color: "#111827",
    backgroundColor: "#fff",
  },
  counter: {
    marginTop: 6,
    textAlign: "right",
    color: "#9ca3af",
    fontSize: 12,
  },
  errorText: {
    color: "#dc2626",
    marginBottom: 10,
    fontSize: 13,
  },
  submitButton: {
    minHeight: 48,
    borderRadius: 9,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
