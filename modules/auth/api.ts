// The one non-local piece of this app — everything else is on-device SQLite.
// Defaults to the server running locally; set EXPO_PUBLIC_API_URL to point
// at a deployed backend (see server/README.md).
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export type AuthUser = {
  id: number;
  email: string;
  username: string;
  createdAt: string;
};

type AuthResponse = { token: string; user: AuthUser };

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed (${response.status}).`);
  }
  return data as T;
}

export function signup(email: string, username: string, password: string): Promise<AuthResponse> {
  return request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, username, password }) });
}

export function login(identifier: string, password: string): Promise<AuthResponse> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) });
}

export function fetchMe(token: string): Promise<{ user: AuthUser }> {
  return request('/auth/me', { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
}
