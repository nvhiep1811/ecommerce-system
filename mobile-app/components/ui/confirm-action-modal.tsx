import { Colors } from "@/constants/theme";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type ConfirmActionModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmActionModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = "Hủy",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmActionModalProps) {
  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, destructive && styles.destructive]}
              onPress={onConfirm}
              disabled={loading}
            >
              <Text style={styles.confirmText}>
                {loading ? "Vui lòng chờ..." : confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  content: {
    backgroundColor: "white",
    borderRadius: 16,
    width: "100%",
    maxWidth: 420,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
    color: "#4b5563",
    textAlign: "center",
    marginBottom: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  destructive: {
    backgroundColor: "#dc2626",
  },
  confirmText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "700",
  },
});
