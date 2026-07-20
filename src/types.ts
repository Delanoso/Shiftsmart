export const GAME_DURATION_MS = 30_000;
export const COUNTDOWN_SECONDS = 3;
export const TARGET_TIMEOUT_MS = 2_500;
export const MIN_TARGET_SIZE = 48;
export const MAX_TARGET_SIZE = 96;
export const SPAWN_DELAY_MIN_MS = 400;
export const SPAWN_DELAY_MAX_MS = 900;

export type ScreenPhase =
  | 'login'
  | 'instructions'
  | 'countdown'
  | 'playing'
  | 'results';

export interface DriverInfo {
  clockNumber: string;
  name: string;
  companyId: string;
  companyName: string;
}

export interface ClickRecord {
  reactionTimeMs: number;
  targetSizePx: number;
}

export interface BaselineStats {
  sessionCount: number;
  clickCount: number;
  medianReactionTimeMs: number | null;
  meanReactionTimeMs: number | null;
}

export interface SessionResult {
  session: {
    id: string;
    clicks: ClickRecord[];
    misses: number;
  };
  evaluation: {
    sessionMedianReactionTimeMs: number | null;
    sessionMeanReactionTimeMs: number | null;
    shouldAlert: boolean;
    alertReasons: string[];
    alertPhoneConfigured: boolean;
  };
  alert: {
    sent: boolean;
    adminNotified?: boolean;
    notificationId?: string;
    webhookSent?: boolean;
    placeholder?: boolean;
  };
  baselines: {
    driver: BaselineStats;
    company: BaselineStats;
  };
}

export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

export function formatMs(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return '—';
  return `${Math.round(ms)} ms`;
}
