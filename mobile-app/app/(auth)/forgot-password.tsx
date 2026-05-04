import ToastBanner from "@/components/ui/toast-banner";
import { Colors } from "@/constants/theme";
import authService from "@/services/authService";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
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

type ResetStep = "email" | "otp" | "password";

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<ResetStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type?: "success" | "error" | "info";
  } | null>(null);

  const emailRef = useRef<TextInput>(null);
  const otpRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const normalizedEmail = email.trim();

  const requestOtp = async () => {
    if (!normalizedEmail) {
      setToast({ message: "Vui lòng nhập email tài khoản", type: "error" });
      emailRef.current?.focus();
      return;
    }

    setLoading(true);
    const { data, error } = await authService.requestPasswordResetOtp(normalizedEmail);
    setLoading(false);

    if (error) {
      setToast({ message: error, type: "error" });
      return;
    }

    setStep("otp");
    setToast({
      message: data?.message ?? "Nếu email tồn tại, mã OTP sẽ được gửi trong ít phút",
      type: "success",
    });
    requestAnimationFrame(() => otpRef.current?.focus());
  };

  const verifyOtp = async () => {
    if (!normalizedEmail || !otp.trim()) {
      setToast({ message: "Vui lòng nhập email và mã OTP", type: "error" });
      return;
    }

    setLoading(true);
    const { data, error } = await authService.verifyPasswordResetOtp(
      normalizedEmail,
      otp.trim(),
    );
    setLoading(false);

    if (error || !data?.resetToken) {
      setToast({ message: error ?? "Mã OTP không hợp lệ", type: "error" });
      return;
    }

    setResetToken(data.resetToken);
    setStep("password");
    setToast({ message: "OTP hợp lệ. Hãy đặt mật khẩu mới", type: "success" });
    requestAnimationFrame(() => passwordRef.current?.focus());
  };

  const submitNewPassword = async () => {
    if (newPassword.length < 6) {
      setToast({ message: "Mật khẩu mới cần tối thiểu 6 ký tự", type: "error" });
      passwordRef.current?.focus();
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({ message: "Mật khẩu xác nhận chưa khớp", type: "error" });
      confirmPasswordRef.current?.focus();
      return;
    }

    setLoading(true);
    const { error } = await authService.confirmPasswordReset(
      normalizedEmail,
      resetToken,
      newPassword,
    );
    setLoading(false);

    if (error) {
      setToast({ message: error, type: "error" });
      return;
    }

    setToast({ message: "Đặt lại mật khẩu thành công", type: "success" });
    router.replace("/login");
  };

  const primaryAction = () => {
    if (step === "email") {
      return requestOtp();
    }
    if (step === "otp") {
      return verifyOtp();
    }
    return submitNewPassword();
  };

  const primaryLabel =
    step === "email"
      ? "Gửi mã OTP"
      : step === "otp"
        ? "Xác thực OTP"
        : "Đặt lại mật khẩu";

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            onPress={() => router.replace("/login")}
            style={styles.backButton}
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={26} color={Colors.light.tint} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.iconBadge}>
              <Ionicons name="mail-outline" size={30} color={Colors.light.tint} />
            </View>
            <Text style={styles.title}>Quên mật khẩu</Text>
            <Text style={styles.subtitle}>
              Nhập email để nhận OTP, xác thực mã rồi đặt mật khẩu mới.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email tài khoản</Text>
            <TextInput
              ref={emailRef}
              style={styles.input}
              placeholder="jsmith@gmail.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType={step === "email" ? "done" : "next"}
              onSubmitEditing={() => {
                if (step === "email") {
                  void requestOtp();
                  return;
                }
                otpRef.current?.focus();
              }}
              autoComplete="email"
              textContentType="emailAddress"
              editable={!loading && step === "email"}
            />

            {step !== "email" && (
              <>
                <Text style={styles.label}>Mã OTP</Text>
                <TextInput
                  ref={otpRef}
                  style={styles.input}
                  placeholder="Nhập mã 6 số"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType={step === "otp" ? "done" : "next"}
                  onSubmitEditing={() => {
                    if (step === "otp") {
                      void verifyOtp();
                      return;
                    }
                    passwordRef.current?.focus();
                  }}
                  textContentType="oneTimeCode"
                  editable={!loading && step === "otp"}
                  maxLength={8}
                />
              </>
            )}

            {step === "password" && (
              <>
                <Text style={styles.label}>Mật khẩu mới</Text>
                <View style={styles.passwordBox}>
                  <TextInput
                    ref={passwordRef}
                    style={styles.passwordInput}
                    placeholder="********"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    editable={!loading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((value) => !value)}
                    style={styles.eyeButton}
                    disabled={loading}
                  >
                    <Ionicons
                      name={showPassword ? "eye-outline" : "eye-off-outline"}
                      size={22}
                      color="#666"
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Xác nhận mật khẩu</Text>
                <TextInput
                  ref={confirmPasswordRef}
                  style={styles.input}
                  placeholder="********"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={() => void submitNewPassword()}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  editable={!loading}
                />
              </>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabled]}
              onPress={() => void primaryAction()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>{primaryLabel}</Text>
              )}
            </TouchableOpacity>

            {step === "otp" && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => void requestOtp()}
                disabled={loading}
              >
                <Text style={styles.secondaryText}>Gửi lại mã OTP</Text>
              </TouchableOpacity>
            )}
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
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 30 },
  backButton: { alignSelf: "flex-start", marginBottom: 28 },
  header: { alignItems: "center", marginBottom: 30 },
  iconBadge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#FFF2EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: Colors.light.tint,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    lineHeight: 22,
    textAlign: "center",
  },
  form: { gap: 8 },
  label: {
    fontSize: 14,
    color: "#333",
    marginTop: 14,
    marginBottom: 8,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#F9F9F9",
  },
  passwordBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    backgroundColor: "#F9F9F9",
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  eyeButton: { paddingHorizontal: 14, paddingVertical: 12 },
  primaryButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 28,
  },
  disabled: { opacity: 0.6 },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: 14,
  },
  secondaryText: {
    color: Colors.light.tint,
    fontSize: 14,
    fontWeight: "700",
  },
});
