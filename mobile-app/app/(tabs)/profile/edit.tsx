import ToastBanner from "@/components/ui/toast-banner";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

type GenderOption = {
  label: string;
  value: string;
};

const genderOptions: GenderOption[] = [
  { label: "Nam", value: "male" },
  { label: "Nữ", value: "female" },
  { label: "Khác", value: "other" },
];

const normalizeBirthDate = (value?: string | null) => {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
};

export default function EditProfileScreen() {
  const { user, profile, updateProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type?: "success" | "error" | "info";
  } | null>(null);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setGender(profile?.gender ?? "");
    setBirthDate(normalizeBirthDate(profile?.birth_date));
    setPhoneNumber(profile?.phone_number ?? "");
    setEmail(profile?.email ?? user?.email ?? "");
  }, [profile, user?.email]);

  const handleSave = async () => {
    if (!fullName.trim()) {
      setToast({ message: "Vui lòng nhập tên của bạn.", type: "error" });
      return;
    }

    if (!email.trim()) {
      setToast({ message: "Vui lòng nhập email.", type: "error" });
      return;
    }

    if (birthDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate.trim())) {
      setToast({
        message: "Ngày sinh cần có định dạng YYYY-MM-DD.",
        type: "error",
      });
      return;
    }

    try {
      setSaving(true);
      const { error } = await updateProfile({
        full_name: fullName.trim(),
        gender: gender || null,
        birth_date: birthDate.trim() || null,
        phone_number: phoneNumber.trim() || null,
        email: email.trim(),
        avatar_url: profile?.avatar_url ?? null,
      });

      if (error) {
        setToast({ message: error, type: "error" });
        return;
      }

      setToast({ message: "Đã cập nhật hồ sơ.", type: "success" });
      setTimeout(() => {
        if (router.canGoBack()) {
          router.back();
        }
      }, 450);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
                return;
              }

              router.replace("/(tabs)/profile");
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Chỉnh sửa hồ sơ</Text>
        <View style={styles.headerSide} />
      </View>

      <ToastBanner
        message={toast?.message ?? null}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />

      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={{
            paddingBottom: 18 + Math.max(insets.bottom, 8),
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tên</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Nhập tên của bạn"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Giới tính</Text>
              <View style={styles.genderRow}>
                {genderOptions.map((option) => {
                  const selected = gender === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.genderButton,
                        selected && styles.genderButtonSelected,
                      ]}
                      onPress={() => setGender(option.value)}
                    >
                      <Text
                        style={[
                          styles.genderText,
                          selected && styles.genderTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ngày sinh</Text>
              <TextInput
                style={styles.input}
                value={birthDate}
                onChangeText={setBirthDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999"
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Số điện thoại</Text>
              <TextInput
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="Nhập số điện thoại"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Nhập email"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                textContentType="emailAddress"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="save-outline" size={20} color="#fff" />
            )}
            <Text style={styles.saveButtonText}>
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingVertical: 10,
    minHeight: 56,
    backgroundColor: Colors.light.tint,
  },
  headerSide: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "white",
    textAlign: "center",
  },
  keyboardArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 12,
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.08)" } as any)
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 2,
        }),
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
    marginBottom: 7,
  },
  input: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 12,
    color: "#333",
    fontSize: 15,
  },
  genderRow: {
    flexDirection: "row",
    gap: 8,
  },
  genderButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#f9f9f9",
    alignItems: "center",
    justifyContent: "center",
  },
  genderButtonSelected: {
    backgroundColor: "#fff5f5",
    borderColor: Colors.light.tint,
  },
  genderText: {
    color: "#555",
    fontSize: 14,
    fontWeight: "600",
  },
  genderTextSelected: {
    color: Colors.light.tint,
  },
  saveButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: Colors.light.tint,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
