import { median, mean } from './baselines.js';

const ALERT_MARGIN_MS = Number(process.env.ALERT_MARGIN_MS ?? 150);
const ALERT_COMPANY_FACTOR = Number(process.env.ALERT_COMPANY_FACTOR ?? 1.35);
const POOR_REACTION_MS = Number(process.env.POOR_REACTION_MS ?? 800);

export function evaluateSession(session, baselinesBefore) {
  const reactionTimes = session.clicks.map((c) => c.reactionTimeMs);
  const sessionMedian = median(reactionTimes);
  const sessionMean = mean(reactionTimes);
  const misses = session.misses ?? 0;

  const reasons = [];
  let shouldAlert = false;

  if (reactionTimes.length === 0) {
    shouldAlert = true;
    reasons.push('No targets hit during the session.');
  }

  const poorClicks = reactionTimes.filter((rt) => rt >= POOR_REACTION_MS).length;
  if (poorClicks > 0) {
    shouldAlert = true;
    reasons.push(`${poorClicks} reaction(s) at or above ${POOR_REACTION_MS} ms.`);
  }

  if (misses >= 2) {
    shouldAlert = true;
    reasons.push(`${misses} missed targets (timeout).`);
  }

  const employeeBaseline = baselinesBefore.employee?.medianReactionTimeMs
    ?? baselinesBefore.driver?.medianReactionTimeMs;
  if (
    employeeBaseline != null &&
    sessionMedian != null &&
    sessionMedian > employeeBaseline + ALERT_MARGIN_MS
  ) {
    shouldAlert = true;
    reasons.push(
      `Session median (${Math.round(sessionMedian)} ms) slower than your baseline (${Math.round(employeeBaseline)} ms).`,
    );
  }

  const companyBaseline = baselinesBefore.company.medianReactionTimeMs;
  if (
    companyBaseline != null &&
    sessionMedian != null &&
    sessionMedian > companyBaseline * ALERT_COMPANY_FACTOR
  ) {
    shouldAlert = true;
    reasons.push(
      `Session median (${Math.round(sessionMedian)} ms) well above company baseline (${Math.round(companyBaseline)} ms).`,
    );
  }

  return {
    sessionMedianReactionTimeMs: sessionMedian,
    sessionMeanReactionTimeMs: sessionMean,
    shouldAlert,
    alertReasons: reasons,
  };
}
