const STORAGE_KEY = 'shiftsmart_admin_key';

export function getStoredAdminKey(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setStoredAdminKey(key: string) {
  sessionStorage.setItem(STORAGE_KEY, key);
}

export function clearStoredAdminKey() {
  sessionStorage.removeItem(STORAGE_KEY);
}

async function adminFetch(input: string, init: RequestInit = {}) {
  const key = getStoredAdminKey();
  const headers = new Headers(init.headers);
  if (key) headers.set('X-Admin-Key', key);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    clearStoredAdminKey();
    throw new Error('Invalid admin key');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res;
}

export interface AdminNotification {
  id: string;
  sessionId: string;
  clockNumber: string;
  driverName: string;
  message: string;
  reasons: string[];
  readAt: string | null;
  createdAt: string;
}

export interface AdminSessionRow {
  id: string;
  clockNumber: string;
  driverName: string;
  createdAt: string;
  misses: number;
  clicks: { reactionTimeMs: number }[];
  sessionMedianMs: number | null;
  shouldAlert: boolean;
  alertReasons: string[];
}

export async function fetchNotifications(unreadOnly = false) {
  const res = await adminFetch(
    `/api/admin/notifications?unreadOnly=${unreadOnly ? 'true' : 'false'}`,
  );
  return res.json() as Promise<{ unreadCount: number; notifications: AdminNotification[] }>;
}

export async function markNotificationRead(id: string) {
  const res = await adminFetch(`/api/admin/notifications/${id}/read`, { method: 'PATCH' });
  return res.json();
}

export async function markAllNotificationsRead() {
  const res = await adminFetch('/api/admin/notifications/read-all', { method: 'POST' });
  return res.json();
}

export async function fetchAdminSessions(flaggedOnly = false) {
  const res = await adminFetch(`/api/admin/sessions?flaggedOnly=${flaggedOnly ? 'true' : 'false'}`);
  const data = await res.json();
  return data.sessions as AdminSessionRow[];
}

export async function downloadSessionsCsv(flaggedOnly = false) {
  const res = await adminFetch(
    `/api/admin/sessions/export.csv?flaggedOnly=${flaggedOnly ? 'true' : 'false'}`,
  );
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = flaggedOnly ? 'shiftsmart-flagged-sessions.csv' : 'shiftsmart-sessions.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export interface DriverImportPreview {
  ok: boolean;
  errors: string[];
  summary: { totalRows: number; validDrivers: number; finalDriverCount?: number };
  preview: { clockNumber: string; name: string }[];
}

export interface DriverImportResult {
  ok: boolean;
  errors: string[];
  summary: {
    totalRows: number;
    validDrivers: number;
    finalDriverCount?: number;
    replacedExisting?: boolean;
  };
  companyId?: string;
  companyName?: string;
}

export async function downloadDriversTemplate() {
  const res = await adminFetch('/api/admin/drivers/template.csv');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'drivers-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export async function previewDriversImport(csvText: string): Promise<DriverImportPreview> {
  const res = await adminFetch('/api/admin/drivers/import/preview', {
    method: 'POST',
    body: JSON.stringify({ csvText }),
  });
  return res.json();
}

export async function importDriversCsv(payload: {
  csvText: string;
  replaceExisting: boolean;
  companyName?: string;
}): Promise<DriverImportResult> {
  const key = getStoredAdminKey();
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (key) headers.set('X-Admin-Key', key);

  const res = await fetch('/api/admin/drivers/import', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    clearStoredAdminKey();
    throw new Error('Invalid admin key');
  }

  const body = (await res.json().catch(() => ({}))) as DriverImportResult & { error?: string };
  if (!res.ok && !body.errors) {
    throw new Error(body.error ?? `Import failed (${res.status})`);
  }
  return body;
}

export async function verifyAdminKey(key: string) {
  setStoredAdminKey(key);
  try {
    await fetchNotifications(false);
    return true;
  } catch {
    clearStoredAdminKey();
    return false;
  }
}
