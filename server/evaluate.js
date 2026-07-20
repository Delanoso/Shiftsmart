import { median, mean } from './baselines.js';

const POOR_REACTION_MS = Number(process.env.POOR_REACTION_MS ?? 800);
/** Red if this many (or more) hits are at/above POOR_REACTION_MS */
const RED_SLOW_HIT_COUNT = Number(process.env.RED_SLOW_HIT_COUNT ?? 4);

/**
 * Supervisor dashboard rules:
 * - Every completed game creates a notification
 * - Green: fewer than 4 hits over 800ms, and no missed circles
 * - Red: 4+ hits over 800ms, OR any missed circle
 */
export function evaluateSession(session) {
  const reactionTimes = session.clicks.map((c) => c.reactionTimeMs);
  const sessionMedian = median(reactionTimes);
  const sessionMean = mean(reactionTimes);
  const misses = Number(session.misses ?? 0);
  const slowHits = reactionTimes.filter((rt) => rt >= POOR_REACTION_MS).length;

  const reasons = [];
  let severity = 'green';

  if (reactionTimes.length === 0) {
    severity = 'red';
    reasons.push('No targets hit during the session.');
  }

  if (misses >= 1) {
    severity = 'red';
    reasons.push(`${misses} missed circle${misses === 1 ? '' : 's'}.`);
  }

  if (slowHits >= RED_SLOW_HIT_COUNT) {
    severity = 'red';
    reasons.push(
      `${slowHits} hit${slowHits === 1 ? '' : 's'} at or above ${POOR_REACTION_MS} ms (threshold: ${RED_SLOW_HIT_COUNT}+).`,
    );
  } else if (slowHits > 0) {
    reasons.push(
      `${slowHits} hit${slowHits === 1 ? '' : 's'} at or above ${POOR_REACTION_MS} ms (under the red threshold of ${RED_SLOW_HIT_COUNT}).`,
    );
  }

  if (severity === 'green' && reasons.length === 0) {
    reasons.push('Within expected range (fewer than 4 slow hits and no misses).');
  }

  return {
    sessionMedianReactionTimeMs: sessionMedian,
    sessionMeanReactionTimeMs: sessionMean,
    slowHits,
    poorReactionMs: POOR_REACTION_MS,
    severity,
    shouldAlert: severity === 'red',
    alertReasons: reasons,
  };
}
