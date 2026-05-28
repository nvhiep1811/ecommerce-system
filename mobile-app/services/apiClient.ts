import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

const AUTH_TOKEN_KEY = "auth_token";
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_UPLOAD_TIMEOUT_MS = 30000;

type ApiRequestInit = RequestInit & {
  timeoutMs?: number;
};

type ApiRequestOptions = Omit<ApiRequestInit, "body" | "method">;

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

  getBaseUrl() {
    return this.baseUrl;
  }

  async getToken() {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return window.sessionStorage.getItem(AUTH_TOKEN_KEY);
    }

    return AsyncStorage.getItem(AUTH_TOKEN_KEY);
  }

  async setToken(token: string) {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
      return;
    }

    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  }

  async clearToken() {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
      return;
    }

    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  }

  async request<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, ...requestInit } = init;
    const controller = new AbortController();
    const timeoutId =
      timeoutMs > 0
        ? setTimeout(() => controller.abort(), timeoutMs)
        : undefined;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...requestInit,
        signal: requestInit.signal ?? controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(requestInit.headers || {}),
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError("Yêu cầu quá thời gian chờ", 408);
      }
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

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

  async uploadMultipart<T>(
    path: string,
    formData: FormData,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const token = await this.getToken();
    const { timeoutMs = DEFAULT_UPLOAD_TIMEOUT_MS, ...requestInit } = options;
    const controller = new AbortController();
    const timeoutId =
      timeoutMs > 0
        ? setTimeout(() => controller.abort(), timeoutMs)
        : undefined;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...requestInit,
        method: "POST",
        signal: requestInit.signal ?? controller.signal,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(requestInit.headers || {}),
        },
        body: formData,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError("Yêu cầu quá thời gian chờ", 408);
      }
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

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

  get<T>(path: string, options: ApiRequestOptions = {}) {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  post<T>(path: string, body?: unknown, options: ApiRequestOptions = {}) {
    return this.request<T>(path, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(path: string, body?: unknown, options: ApiRequestOptions = {}) {
    return this.request<T>(path, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(path: string, body?: unknown, options: ApiRequestOptions = {}) {
    return this.request<T>(path, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(path: string, options: ApiRequestOptions = {}) {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}

export const apiClient = new ApiClient();
