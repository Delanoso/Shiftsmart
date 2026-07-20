import type { DriverInfo, SessionResult } from '../types';

export interface PublicAppConfig {
  vendorName: string;
  productName: string;
  clientCompanyName: string;
  supportEmail: string;
  supportPhone: string;
  branding: {
    primaryColor: string;
    accentColor: string;
    targetColor: string;
    logoUrl: string | null;
  };
  disclaimer: string;
}

const API = '/api';

export async function fetchPublicConfig(): Promise<PublicAppConfig> {
  const res = await fetch(`${API}/config`);
  if (!res.ok) throw new Error('Failed to load app config');
  return res.json();
}

export async function fetchDriver(clockNumber: string): Promise<DriverInfo> {
  const res = await fetch(`${API}/drivers/${encodeURIComponent(clockNumber.trim())}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Driver lookup failed');
  }
  return res.json();
}

export async function submitSession(payload: {
  clockNumber: string;
  durationMs: number;
  clicks: { reactionTimeMs: number; targetSizePx: number }[];
  misses: number;
  startedAt: string;
  endedAt: string;
}): Promise<SessionResult> {
  const res = await fetch(`${API}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Failed to save session');
  }
  return res.json();
}

export async function fetchCompany(): Promise<{
  companyId: string;
  companyName: string;
  driverCount: number;
}> {
  const res = await fetch(`${API}/company`);
  if (!res.ok) throw new Error('Failed to load company');
  return res.json();
}
