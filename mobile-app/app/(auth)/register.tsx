import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
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
import ToastBanner from "@/components/ui/toast-banner";

export default function SignUpScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const [toast, setToast] = useState<{
    message: string;
    type?: "success" | "error" | "info";
  } | null>(null);

  const fullNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim() || !fullName.trim()) {
      setToast({
        message: "Vui lòng nhập đầy đủ thông tin bắt buộc",
        type: "error",
      });
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, fullName, phoneNumber);
    setLoading(false);

    if (error) {
      setToast({ message: error, type: "error" });
    } else {
      setToast({ message: "Tạo tài khoản thành công!", type: "success" });
      router.replace("/(tabs)");
    }
  };

  const handlePasswordSubmit = () => {
    passwordRef.current?.blur();
    void handleSignUp();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 30 }}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={() => router.replace("/login")}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={26} color={Colors.light.tint} />
          </TouchableOpacity>

          <Text style={styles.title}>Tạo tài khoản</Text>
          <Text style={styles.subtitle}>Đăng ký để bắt đầu mua sắm</Text>

          <View style={{ marginTop: 30 }}>
            <Text style={styles.label}>Họ và tên *</Text>
            <TextInput
              ref={fullNameRef}
              style={styles.input}
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => emailRef.current?.focus()}
              autoComplete="name"
              textContentType="name"
              editable={!loading}
            />

            <Text style={styles.label}>Email *</Text>
            <TextInput
              ref={emailRef}
              style={styles.input}
              placeholder="jsmith@gmail.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => phoneRef.current?.focus()}
              autoComplete="email"
              textContentType="emailAddress"
              editable={!loading}
            />

            <Text style={styles.label}>Số điện thoại</Text>
            <TextInput
              ref={phoneRef}
              style={styles.input}
              placeholder="0123456789"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => passwordRef.current?.focus()}
              autoComplete="tel"
              textContentType="telephoneNumber"
              editable={!loading}
            />

            <Text style={styles.label}>Mật khẩu *</Text>
            <View style={styles.inputBox}>
              <TextInput
                ref={passwordRef}
                style={{ flex: 1, padding: 12 }}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                blurOnSubmit={true}
                onSubmitEditing={handlePasswordSubmit}
                autoComplete="new-password"
                textContentType="newPassword"
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={{ padding: 12 }}
                disabled={loading}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Đăng ký</Text>
              )}
            </TouchableOpacity>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                marginTop: 20,
              }}
            >
              <Text style={{ color: "#666" }}>Đã có tài khoản? </Text>
              <TouchableOpacity
                onPress={() => router.replace("/login")}
                disabled={loading}
              >
                <Text style={{ color: Colors.light.tint, fontWeight: "600" }}>
                  Đăng nhập
                </Text>
              </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  backBtn: { marginBottom: 20 },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: Colors.light.tint,
    marginBottom: 10,
  },
  subtitle: { fontSize: 16, color: "#666", marginBottom: 20 },
  label: {
    fontSize: 14,
    color: "#333",
    marginBottom: 8,
    marginTop: 15,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#F9F9F9",
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    backgroundColor: "#F9F9F9",
  },
  btn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 25,
    padding: 15,
    alignItems: "center",
    marginTop: 30,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
