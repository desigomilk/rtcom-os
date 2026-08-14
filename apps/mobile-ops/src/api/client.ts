import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const API_BASE_URL =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
    ?.apiBaseUrl ?? "http://localhost:4000";

export class ApiError extends Error {}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await SecureStore.getItemAsync("accessToken");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.error ?? `Request failed (${response.status})`);
  }
  return response.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
};

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; phone: string; role: string };
}
