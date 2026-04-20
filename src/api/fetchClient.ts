import { API_BASE_URL } from "../config/env";

type JwtPayload = Record<string, string | number | boolean | null | undefined>;

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

export function getCurrentUserId(): string | null {
  const storedUserId = localStorage.getItem("userId") || localStorage.getItem("accountId");
  if (storedUserId) return storedUserId;

  const token = localStorage.getItem("token");
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  const userId =
    payload?.nameid ||
    payload?.sub ||
    payload?.userId ||
    payload?.id ||
    payload?.["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];

  if (typeof userId === "string" && userId.trim()) {
    localStorage.setItem("userId", userId);
    return userId;
  }

  return null;
}

export function getCurrentProfileId(): string | null {
  const storedProfileId = localStorage.getItem("profileId");
  if (storedProfileId) return storedProfileId;

  return getCurrentUserId();
}

export async function fetchClient(
  endpoint: string,
  options: RequestInit = {}
) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "accept": "*/*",
      ...(options.headers || {}),
      Authorization: token ? `Bearer ${token}` : "",
    },
  });

  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    localStorage.removeItem("email");
    localStorage.removeItem("userId");
    localStorage.removeItem("accountId");
    localStorage.removeItem("profileId");

    window.location.href = "/login";
    return Promise.reject("Unauthorized");
  }

  return response;
}