const API_BASE = "/api";

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
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

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

async function downloadFile(
  path: string,
  options: RequestInit = {}
): Promise<{ blob: Blob | null; filename: string | null; error: string | null }> {
  const token = getToken();
  const headers: Record<string, string> = {
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
      return { blob: null, filename: null, error: body.error || `Request failed (${res.status})` };
    }

    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const blob = await res.blob();
    return { blob, filename: match?.[1] || null, error: null };
  } catch (err: any) {
    return { blob: null, filename: null, error: err.message || "Network error" };
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

    login(username: string, password: string) {
      return request<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
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

    uploadSignedCopy(id: string, file: File) {
      const formData = new FormData();
      formData.append("signedCopy", file);

      return request<{ signed_copy_uploaded: boolean; signed_copy_name: string; signed_copy_url: string }>(
        `/submissions/${encodeURIComponent(id)}/signed-copy`,
        {
          method: "POST",
          body: formData,
        }
      );
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

    activity(filters?: {
      loginLimit?: number;
      submissionLimit?: number;
    }) {
      const params = new URLSearchParams();
      if (filters?.loginLimit) params.set("loginLimit", String(filters.loginLimit));
      if (filters?.submissionLimit) params.set("submissionLimit", String(filters.submissionLimit));
      const qs = params.toString();
      return request<{
        summary: {
          total_logins: number;
          logins_last_24h: number;
          total_submissions: number;
          submissions_last_24h: number;
          active_submission_districts: number;
        };
        loginEvents: any[];
        submissionEvents: any[];
      }>(`/admin/activity${qs ? `?${qs}` : ""}`);
    },
  },

  feedback: {
    create(payload: { subject: string; message: string }) {
      return request<{ success: boolean }>("/feedback", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    list() {
      return request<any[]>("/feedback");
    },
  },

  analytics: {
    getAnalytics(payload: { district?: string; year?: string }) {
      const params = new URLSearchParams();
      if (payload.district && payload.district !== "all") params.set("district", payload.district);
      if (payload.year) params.set("year", payload.year);
      
      return request<any>(`/analytics/analytics?${params.toString()}`);
    },

    getEnhancedAnalytics(payload: { district?: string; year?: string; fromDate?: string; toDate?: string }) {
      const params = new URLSearchParams();
      if (payload.district && payload.district !== "all") params.set("district", payload.district);
      if (payload.year) params.set("year", payload.year);
      if (payload.fromDate) params.set("fromDate", payload.fromDate);
      if (payload.toDate) params.set("toDate", payload.toDate);
      
      return request<any>(`/analytics/enhanced?${params.toString()}`);
    },

    getEnhancedAnalyticsDrilldown(payload: {
      district?: string;
      year?: string;
      fromDate?: string;
      toDate?: string;
      month?: string;
      hour?: string;
      timeBucket?: string;
      comparisonName?: string;
      mandal?: string;
      roadType?: string;
      hotspotPlace?: string;
      hotspotDistrict?: string;
      driverCause?: string;
      vehicleCause?: string;
      roadEngineeringCategory?: string;
      roadEngineeringCause?: string;
      vehicleType?: string;
      policeStation?: string;
      weekday?: string;
      severity?: string;
      metric?: string;
      signedCopyStatus?: string;
    }) {
      const params = new URLSearchParams();
      if (payload.district && payload.district !== "all") params.set("district", payload.district);
      if (payload.year) params.set("year", payload.year);
      if (payload.fromDate) params.set("fromDate", payload.fromDate);
      if (payload.toDate) params.set("toDate", payload.toDate);
      if (payload.month) params.set("month", payload.month);
      if (payload.hour) params.set("hour", payload.hour);
      if (payload.timeBucket) params.set("timeBucket", payload.timeBucket);
      if (payload.comparisonName) params.set("comparisonName", payload.comparisonName);
      if (payload.mandal) params.set("mandal", payload.mandal);
      if (payload.roadType) params.set("roadType", payload.roadType);
      if (payload.hotspotPlace) params.set("hotspotPlace", payload.hotspotPlace);
      if (payload.hotspotDistrict) params.set("hotspotDistrict", payload.hotspotDistrict);
      if (payload.driverCause) params.set("driverCause", payload.driverCause);
      if (payload.vehicleCause) params.set("vehicleCause", payload.vehicleCause);
      if (payload.roadEngineeringCategory) params.set("roadEngineeringCategory", payload.roadEngineeringCategory);
      if (payload.roadEngineeringCause) params.set("roadEngineeringCause", payload.roadEngineeringCause);
      if (payload.vehicleType) params.set("vehicleType", payload.vehicleType);
      if (payload.policeStation) params.set("policeStation", payload.policeStation);
      if (payload.weekday) params.set("weekday", payload.weekday);
      if (payload.severity) params.set("severity", payload.severity);
      if (payload.metric) params.set("metric", payload.metric);
      if (payload.signedCopyStatus) params.set("signedCopyStatus", payload.signedCopyStatus);

      return request<any>(`/analytics/enhanced-drilldown?${params.toString()}`);
    },

    getAnalyticsPro(payload: { district?: string; year?: string; fromDate?: string; toDate?: string }) {
      const params = new URLSearchParams();
      if (payload.district && payload.district !== "all") params.set("district", payload.district);
      if (payload.year) params.set("year", payload.year);
      if (payload.fromDate) params.set("fromDate", payload.fromDate);
      if (payload.toDate) params.set("toDate", payload.toDate);

      return request<any>(`/analytics/pro?${params.toString()}`);
    },

    getAnalyticsProDrilldown(payload: {
      district?: string;
      year?: string;
      fromDate?: string;
      toDate?: string;
      submissionDistrict?: string;
      policeStation?: string;
      roadType?: string;
      createdDate?: string;
      createdMonth?: string;
      timelinessStatus?: string;
      delayBand?: string;
      signedCopyStatus?: string;
      createdWeekday?: string;
    }) {
      const params = new URLSearchParams();
      if (payload.district && payload.district !== "all") params.set("district", payload.district);
      if (payload.year) params.set("year", payload.year);
      if (payload.fromDate) params.set("fromDate", payload.fromDate);
      if (payload.toDate) params.set("toDate", payload.toDate);
      if (payload.submissionDistrict) params.set("submissionDistrict", payload.submissionDistrict);
      if (payload.policeStation) params.set("policeStation", payload.policeStation);
      if (payload.roadType) params.set("roadType", payload.roadType);
      if (payload.createdDate) params.set("createdDate", payload.createdDate);
      if (payload.createdMonth) params.set("createdMonth", payload.createdMonth);
      if (payload.timelinessStatus) params.set("timelinessStatus", payload.timelinessStatus);
      if (payload.delayBand) params.set("delayBand", payload.delayBand);
      if (payload.signedCopyStatus) params.set("signedCopyStatus", payload.signedCopyStatus);
      if (payload.createdWeekday) params.set("createdWeekday", payload.createdWeekday);

      return request<any>(`/analytics/pro-drilldown?${params.toString()}`);
    },

    export(format: string, filters: { district?: string; year?: string }) {
      const params = new URLSearchParams();
      params.set("format", format);
      if (filters.district) params.set("district", filters.district);
      if (filters.year) params.set("year", filters.year);
      
      return request<any>(`/analytics/export?${params.toString()}`);
    },
  },

  reports: {
    downloadDsrWorkbook(filters: { fromDate?: string; toDate?: string; preset?: "weekly" | "last-week" }) {
      const params = new URLSearchParams();
      if (filters.preset) params.set("preset", filters.preset);
      if (filters.fromDate) params.set("fromDate", filters.fromDate);
      if (filters.toDate) params.set("toDate", filters.toDate);
      return downloadFile(`/reports/dsr-workbook?${params.toString()}`);
    },
  },

  rag: {
    analyze(payload: { submissionId: string; question?: string; history?: Array<{ role: "user" | "assistant"; content: string }> }) {
      return request<{ response: string; submission: any; retrieval: any; contextSubmissions: any[]; model: string; mode: string; performance?: any }>('/rag/analyze-gemini', {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    batchAnalyze(payload: { submissionIds: string[]; question?: string; history?: Array<{ role: "user" | "assistant"; content: string }> }) {
      return request<{ response: string; submissionsAnalyzed: number; submissions: any[]; retrieval: any; contextSubmissions: any[]; model: string; mode: string; performance?: any }>('/rag/batch-analyze-gemini', {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    getSimilar(submissionId: string) {
      return request<{ reference: any; similarAccidents: any[] }>(`/rag/similar/${submissionId}`);
    },
  },
};

export function getApiAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function openProtectedAsset(
  path: string | null | undefined
): Promise<void> {
  const assetUrl = getApiAssetUrl(path);
  if (!assetUrl) {
    throw new Error("Signed copy is not available");
  }

  const token = getToken();
  if (!token) {
    throw new Error("Please login again to access the signed copy");
  }

  try {
    const res = await fetch(assetUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    throw error;
  }
}
