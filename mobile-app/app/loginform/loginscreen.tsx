import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    const { error, profile } = await signIn(email, password);
    setLoading(false);

    if (error) {
      Alert.alert('Login Failed', error);
      return;
    }

    if (profile?.role === 'seller') {
      router.replace('/seller/products');
    } else {
      router.replace('/(tabs)');
    }
  };

  const InputField = ({ label, rightLabel, onRightPress, isPassword, ...props }: any) => (
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
        <TextInput style={styles.input} autoCapitalize="none" editable={!loading} {...props} />
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.icon}>
            <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={24} color="#666" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={26} color="white" />
            </TouchableOpacity>
            <Image source={require('@/assets/images/header.jpg')} style={styles.headerImg} resizeMode="cover" />
            <View style={styles.headerOverlay}>
              <Text style={styles.title}>Mega Mall</Text>
              <Text style={styles.subtitle}>Log in to your account</Text>
            </View>
          </View>

          <View style={styles.form}>
            <InputField
              label="Email"
              placeholder="jsmith@gmail.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            <InputField
              label="Password"
              rightLabel="Forgot Password?"
              onRightPress={() => {}}
              placeholder="********"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              isPassword
            />

            <TouchableOpacity
              style={styles.remember}
              onPress={() => setRememberMe(!rememberMe)}
              disabled={loading}
            >
              <View style={[styles.checkbox, rememberMe && styles.checked]}>
                {rememberMe && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={styles.rememberText}>Remember me next time</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Log in</Text>}
            </TouchableOpacity>

            <View style={styles.socialNotice}>
              <Ionicons name="information-circle-outline" size={18} color={Colors.light.tint} />
              <Text style={styles.socialNoticeText}>
                Google va Apple login se duoc bo sung sau khi backend OAuth hoan tat.
              </Text>
            </View>

            <View style={styles.signup}>
              <Text style={styles.signupText}>No account yet? </Text>
              <TouchableOpacity onPress={() => router.push('/loginform/signupscreen')} disabled={loading}>
                <Text style={styles.link}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Sponsored by Le Quang Huy and Nguyen Vo Hiep</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  header: { width: '100%', height: 200, position: 'relative' },
  headerImg: { width: '100%', height: '100%' },
  headerOverlay: { position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    marginTop: 5,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  backBtn: { position: 'absolute', top: 20, left: 20, zIndex: 1 },

  form: { flex: 1, paddingHorizontal: 30, paddingTop: 30 },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 14, color: '#333', marginBottom: 8, fontWeight: '500' },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
  },
  input: { flex: 1, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16 },
  icon: { paddingHorizontal: 15 },
  link: { fontSize: 12, color: Colors.light.tint, fontWeight: '600' },

  remember: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checked: { borderColor: Colors.light.tint, backgroundColor: Colors.light.tint },
  rememberText: { fontSize: 14, color: '#666' },

  btn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  socialNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F5F9FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  socialNoticeText: { flex: 1, fontSize: 13, color: '#335' },

  signup: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingBottom: 30 },
  signupText: { fontSize: 14, color: '#666' },

  footer: { paddingVertical: 20, alignItems: 'center', backgroundColor: '#f0f0f0' },
  footerText: { fontSize: 12, color: '#666', textAlign: 'center' },
});

export default LoginScreen;
