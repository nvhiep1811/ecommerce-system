import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Image,
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

const LoginScreen = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const [toast, setToast] = useState<{
    message: string;
    type?: "success" | "error" | "info";
  } | null>(null);

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setToast({ message: "Vui lòng nhập đầy đủ thông tin", type: "error" });
      return;
    }

    setLoading(true);
    const { error, profile } = await signIn(email, password, rememberMe);
    setLoading(false);

    if (error) {
      setToast({ message: error, type: "error" });
      return;
    }

    if (profile?.role === "seller") {
      router.replace("/seller/dashboard" as any);
    } else {
      router.replace("/(tabs)");
    }
  };

  const handlePasswordSubmit = () => {
    passwordInputRef.current?.blur();
    void handleLogin();
  };

  const InputField = ({
    label,
    rightLabel,
    onRightPress,
    isPassword,
    returnKeyType,
    onSubmitEditing,
    blurOnSubmit,
    autoComplete,
    textContentType,
    inputRef,
    ...props
  }: any) => (
    <View style={styles.inputContainer}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        {rightLabel && (
          <TouchableOpacity onPress={onRightPress}>
            <Text style={styles.link}>{rightLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.inputBox}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          autoCapitalize="none"
          editable={!loading}
          returnKeyType={returnKeyType}
          blurOnSubmit={blurOnSubmit ?? true}
          onSubmitEditing={onSubmitEditing}
          autoComplete={autoComplete}
          textContentType={textContentType}
          placeholderTextColor="#8a8a8a"
          selectionColor={Colors.light.tint}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.icon}
          >
            <Ionicons
              name={showPassword ? "eye-outline" : "eye-off-outline"}
              size={24}
              color="#666"
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                  return;
                }
                router.replace("/(tabs)/profile");
              }}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={26} color="white" />
            </TouchableOpacity>
            <Image
              source={{ uri: "https://d35ci4s1xmcpe.cloudfront.net/assets/header.jpg" }}
              style={styles.headerImg}
              resizeMode="cover"
            />
            <View style={styles.headerOverlay}>
              <Text style={styles.title}>Mega Mall</Text>
              <Text style={styles.subtitle}>Đăng nhập vào tài khoản</Text>
            </View>
          </View>

          <View style={styles.form}>
            <InputField
              label="Email"
              placeholder="jsmith@gmail.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                passwordInputRef.current?.focus();
              }}
              autoComplete="email"
              textContentType="emailAddress"
              inputRef={emailInputRef}
            />
            <InputField
              label="Mật khẩu"
              rightLabel="Quên mật khẩu?"
              onRightPress={() => router.push("/forgot-password")}
              placeholder="********"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              isPassword
              returnKeyType="done"
              blurOnSubmit={true}
              onSubmitEditing={handlePasswordSubmit}
              autoComplete="current-password"
              textContentType="password"
              inputRef={passwordInputRef}
            />

            <TouchableOpacity
              style={styles.remember}
              onPress={() => setRememberMe(!rememberMe)}
              disabled={loading}
            >
              <View style={[styles.checkbox, rememberMe && styles.checked]}>
                {rememberMe && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </View>
              <Text style={styles.rememberText}>Ghi nhớ đăng nhập</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Đăng nhập</Text>
              )}
            </TouchableOpacity>

            <View style={styles.signup}>
              <Text style={styles.signupText}>Chưa có tài khoản? </Text>
              <TouchableOpacity
                onPress={() => router.replace("/register")}
                disabled={loading}
              >
                <Text style={styles.link}>Đăng ký</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Đồng hành bởi Four Seasons</Text>
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
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  header: { width: "100%", height: 200, position: "relative" },
  headerImg: { width: "100%", height: "100%" },
  headerOverlay: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    ...(Platform.OS === "web"
      ? ({ textShadow: "-1px 1px 10px rgba(0,0,0,0.75)" } as any)
      : {
          textShadowColor: "rgba(0,0,0,0.75)",
          textShadowOffset: { width: -1, height: 1 },
          textShadowRadius: 10,
        }),
  },
  subtitle: {
    fontSize: 16,
    color: "#fff",
    marginTop: 5,
    lineHeight: 22,
    ...(Platform.OS === "web"
      ? ({ textShadow: "-1px 1px 10px rgba(0,0,0,0.75)" } as any)
      : {
          textShadowColor: "rgba(0,0,0,0.75)",
          textShadowOffset: { width: -1, height: 1 },
          textShadowRadius: 10,
        }),
  },
  backBtn: { position: "absolute", top: 20, left: 20, zIndex: 1 },

  form: { flex: 1, paddingHorizontal: 30, paddingTop: 30 },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 15, color: "#333", marginBottom: 8, fontWeight: "600" },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    backgroundColor: "#F9F9F9",
  },
  input: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: "#202124",
  },
  icon: { paddingHorizontal: 15 },
  link: { fontSize: 14, color: Colors.light.tint, fontWeight: "700" },

  remember: { flexDirection: "row", alignItems: "center", marginBottom: 25 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checked: {
    borderColor: Colors.light.tint,
    backgroundColor: Colors.light.tint,
  },
  rememberText: { fontSize: 15, color: "#666" },

  btn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 20,
    elevation: 5,
    ...(Platform.OS === "web"
      ? ({ boxShadow: `0px 4px 5px ${Colors.light.tint}4d` } as any)
      : {
          shadowColor: Colors.light.tint,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 5,
        }),
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },

  socialNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#F5F9FF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  socialNoticeText: { flex: 1, fontSize: 13, color: "#335" },

  signup: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 30,
  },
  signupText: { fontSize: 15, color: "#666" },

  footer: {
    paddingVertical: 20,
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  footerText: { fontSize: 13, color: "#666", textAlign: "center" },
});

export default LoginScreen;
