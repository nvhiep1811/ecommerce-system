import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

const AUTH_TOKEN_KEY = "auth_token";

const getExpoHost = () => {
  const possibleHost =
    (Constants.expoConfig as any)?.hostUri ||
    (Constants as any)?.expoGoConfig?.debuggerHost ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any)?.manifest?.debuggerHost;

  if (!possibleHost || typeof possibleHost !== "string") {
    return null;
  }

  return possibleHost.split(":")[0] || null;
};

const resolveBaseUrl = () => {
  const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const expoHost = getExpoHost();

  if (envBaseUrl) {
    if (
      expoHost &&
      (envBaseUrl.includes("localhost") || envBaseUrl.includes("127.0.0.1"))
    ) {
      return envBaseUrl
        .replace("localhost", expoHost)
        .replace("127.0.0.1", expoHost);
    }

    return envBaseUrl;
  }

  if (expoHost) {
    return `http://${expoHost}:8080/api`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:8080/api";
  }

  return "http://localhost:8080/api";
};

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

class ApiClient {
  private baseUrl = resolveBaseUrl();

  async getToken() {
    return AsyncStorage.getItem(AUTH_TOKEN_KEY);
  }

  async setToken(token: string) {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  }

  async clearToken() {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });

    if (!response.ok) {
      let message = `Yêu cầu thất bại với mã ${response.status}`;
      try {
        const errorBody = await response.json();
        message = errorBody?.message || errorBody?.error || message;
      } catch {}
      throw new ApiError(message, response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  async uploadMultipart<T>(path: string, formData: FormData): Promise<T> {
    const token = await this.getToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      let message = `Yêu cầu thất bại với mã ${response.status}`;
      try {
        const errorBody = await response.json();
        message = errorBody?.message || errorBody?.error || message;
      } catch {}
      throw new ApiError(message, response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  get<T>(path: string) {
    return this.request<T>(path, { method: "GET" });
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: "DELETE" });
  }
}

export const apiClient = new ApiClient();
