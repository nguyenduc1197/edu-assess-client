import { API_BASE_URL } from "../config/env";

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

  // 🔥 Bắt 401 ở đây
  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");

    window.location.href = "/login";
    return Promise.reject("Unauthorized");
  }

  return response;
}