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
  employeeName: string;
  message: string;
  reasons: string[];
  severity: 'green' | 'red';
  site?: string;
  readAt: string | null;
  createdAt: string;
}

export interface AdminSessionRow {
  id: string;
  clockNumber: string;
  employeeName: string;
  site?: string;
  createdAt: string;
  misses: number;
  clicks: { reactionTimeMs: number }[];
  sessionMedianMs: number | null;
  shouldAlert: boolean;
  severity?: 'green' | 'red';
  slowHits?: number;
  alertReasons: string[];
}

export interface EmployeeRow {
  clockNumber: string;
  name: string;
  site?: string;
}

export interface AuditLogRow {
  id: string;
  action: string;
  actor: string;
  ip: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export async function fetchNotifications(unreadOnly = false, site = 'all') {
  const params = new URLSearchParams({
    unreadOnly: unreadOnly ? 'true' : 'false',
    site,
  });
  const res = await adminFetch(`/api/admin/notifications?${params}`);
  return res.json() as Promise<{
    unreadCount: number;
    unreadRedCount: number;
    notifications: AdminNotification[];
    sites: string[];
  }>;
}

export async function markNotificationRead(id: string) {
  const res = await adminFetch(`/api/admin/notifications/${id}/read`, { method: 'PATCH' });
  return res.json();
}

export async function markAllNotificationsRead() {
  const res = await adminFetch('/api/admin/notifications/read-all', { method: 'POST' });
  return res.json();
}

export async function fetchAdminSessions(flaggedOnly = false, site = 'all') {
  const params = new URLSearchParams({
    flaggedOnly: flaggedOnly ? 'true' : 'false',
    site,
  });
  const res = await adminFetch(`/api/admin/sessions?${params}`);
  const data = await res.json();
  return {
    sessions: data.sessions as AdminSessionRow[],
    sites: (data.sites ?? []) as string[],
  };
}

export async function downloadSessionsCsv(flaggedOnly = false, site = 'all') {
  const params = new URLSearchParams({
    flaggedOnly: flaggedOnly ? 'true' : 'false',
    site,
  });
  const res = await adminFetch(`/api/admin/sessions/export.csv?${params}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = flaggedOnly ? 'shiftsmart-flagged-sessions.csv' : 'shiftsmart-sessions.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export interface EmployeeImportPreview {
  ok: boolean;
  errors: string[];
  summary: { totalRows: number; validEmployees: number; finalEmployeeCount?: number };
  preview: EmployeeRow[];
}

export interface EmployeeImportResult {
  ok: boolean;
  errors: string[];
  summary: {
    totalRows: number;
    validEmployees: number;
    finalEmployeeCount?: number;
    replacedExisting?: boolean;
  };
  companyId?: string;
  companyName?: string;
}

export async function downloadEmployeesTemplate() {
  const res = await adminFetch('/api/admin/employees/template.csv');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'employees-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export async function previewEmployeesImport(csvText: string): Promise<EmployeeImportPreview> {
  const res = await adminFetch('/api/admin/employees/import/preview', {
    method: 'POST',
    body: JSON.stringify({ csvText }),
  });
  return res.json();
}

export async function importEmployeesCsv(payload: {
  csvText: string;
  replaceExisting: boolean;
  companyName?: string;
}): Promise<EmployeeImportResult> {
  const key = getStoredAdminKey();
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (key) headers.set('X-Admin-Key', key);

  const res = await fetch('/api/admin/employees/import', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    clearStoredAdminKey();
    throw new Error('Invalid admin key');
  }

  const body = (await res.json().catch(() => ({}))) as EmployeeImportResult & { error?: string };
  if (!res.ok && !body.errors) {
    throw new Error(body.error ?? `Import failed (${res.status})`);
  }
  return body;
}

export async function fetchEmployeeRoster(site = 'all') {
  const params = new URLSearchParams({ site });
  const res = await adminFetch(`/api/admin/employees?${params}`);
  return res.json() as Promise<{
    employees: EmployeeRow[];
    employeeCount: number;
    sites: string[];
  }>;
}

async function employeeMutation<T>(input: string, init: RequestInit): Promise<T> {
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
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export async function addEmployeeOne(payload: {
  clockNumber: string;
  name: string;
  site?: string;
}) {
  return employeeMutation<{
    ok: true;
    employee: EmployeeRow;
    employeeCount: number;
  }>('/api/admin/employees', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateEmployeeOne(
  clockNumber: string,
  payload: { name?: string; site?: string; newClockNumber?: string },
) {
  return employeeMutation<{
    ok: true;
    employee: EmployeeRow;
    employeeCount: number;
  }>(`/api/admin/employees/${encodeURIComponent(clockNumber)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteEmployeeOne(clockNumber: string) {
  return employeeMutation<{
    ok: true;
    deleted: EmployeeRow;
    employeeCount: number;
  }>(`/api/admin/employees/${encodeURIComponent(clockNumber)}`, {
    method: 'DELETE',
  });
}

export async function fetchAuditLogs(limit = 200) {
  const res = await adminFetch(`/api/admin/audit?limit=${limit}`);
  return res.json() as Promise<{ logs: AuditLogRow[] }>;
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

export interface AdminSettings {
  companyName: string;
  companyNameEditable: boolean;
  companyNameHint: string;
  branding: {
    primaryColor: string;
    accentColor: string;
    targetColor: string;
    logoUrl: string | null;
  };
  sites: string[];
}

export async function fetchAdminSettings(): Promise<AdminSettings> {
  const res = await adminFetch('/api/admin/settings');
  const data = await res.json();
  return { ...data, sites: data.sites ?? [] };
}

export async function saveBrandingColors(payload: {
  primaryColor: string;
  accentColor: string;
  targetColor: string;
}) {
  const res = await adminFetch('/api/admin/settings/branding', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ ok: boolean; branding: AdminSettings['branding'] }>;
}

export async function saveSitesList(sites: string[]) {
  const res = await adminFetch('/api/admin/settings/sites', {
    method: 'PUT',
    body: JSON.stringify({ sites }),
  });
  return res.json() as Promise<{ ok: boolean; sites: string[] }>;
}

export async function uploadAdminLogo(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  const imageBase64 = btoa(binary);

  const res = await adminFetch('/api/admin/settings/logo', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, imageBase64 }),
  });
  return res.json() as Promise<{ ok: boolean; branding: AdminSettings['branding'] }>;
}

export async function removeAdminLogo() {
  const res = await adminFetch('/api/admin/settings/logo', { method: 'DELETE' });
  return res.json() as Promise<{ ok: boolean; branding: AdminSettings['branding'] }>;
}
