import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

// Set in app.json under expo.extra.apiBaseUrl. This must be the API server's
// LAN IP (not "localhost") since a phone on Expo Go is a separate device from
// whatever machine runs the API — update it whenever that machine's IP changes.
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

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; phone: string; role: string };
}

export interface ManifestStop {
  routeStopId: string;
  sequence: number;
  customerName: string;
  address: string;
  plannedLat?: number;
  plannedLng?: number;
  expectedQuantityLitres: number;
  expectedContainers: { qrCode: string; variant: string }[];
  expectedEmptyContainers: number;
}

export interface Manifest {
  date: string;
  routeId: string;
  stops: ManifestStop[];
}

export const api = {
  login: (phone: string, password: string) =>
    request<LoginResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    }),
  getManifest: (date: string) =>
    request<Manifest>(`/delivery/manifest?date=${date}`),
  sync: (events: unknown[]) =>
    request<{ results: { clientEventId: string; status: string; reason?: string }[] }>(
      "/delivery/sync",
      { method: "POST", body: JSON.stringify({ events }) },
    ),
};
