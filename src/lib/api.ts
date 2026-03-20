const API_BASE = import.meta.env.VITE_API_URL || "/api";

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

export function setToken(token: string): void {
  localStorage.setItem("auth_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("auth_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { data: null, error: body.error || `Request failed (${res.status})` };
    }

    const data = await res.json();
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Network error" };
  }
}

// ---- Auth API ----

export interface AuthResponse {
  token: string;
  user: { id: string; email: string };
}

export interface MeResponse {
  user: { id: string; email: string };
  profile: { full_name: string; district: string; designation: string | null } | null;
  isAdmin: boolean;
  roles: string[];
}

export const api = {
  auth: {
    signup(data: {
      email: string;
      password: string;
      full_name: string;
      district: string;
      designation?: string;
    }) {
      return request<AuthResponse>("/auth/signup", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    login(email: string, password: string) {
      return request<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    },

    me() {
      return request<MeResponse>("/auth/me");
    },
  },

  submissions: {
    create(data: Record<string, any>) {
      return request<{ id: string; created_at: string }>("/submissions", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    list() {
      return request<any[]>("/submissions");
    },

    get(id: string) {
      return request<any>(`/submissions/${encodeURIComponent(id)}`);
    },
  },

  admin: {
    submissions(filters: {
      district?: string;
      year?: string;
      month?: string;
      date?: string;
    }) {
      const params = new URLSearchParams();
      if (filters.district) params.set("district", filters.district);
      if (filters.year) params.set("year", filters.year);
      if (filters.month) params.set("month", filters.month);
      if (filters.date) params.set("date", filters.date);
      const qs = params.toString();
      return request<any[]>(`/admin/submissions${qs ? `?${qs}` : ""}`);
    },
  },
};
