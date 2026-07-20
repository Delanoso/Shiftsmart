const EMPLOYEE_BASELINE_START_MS = Number(
  process.env.EMPLOYEE_BASELINE_START_MS ??
    process.env.DRIVER_BASELINE_START_MS ??
    550,
);
const COMPANY_BASELINE_START_MS = Number(process.env.COMPANY_BASELINE_START_MS ?? 550);

export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computeBaselines(sessions, companyId, clockNumber) {
  const companySessions = sessions.filter((s) => s.companyId === companyId);
  const employeeSessions = companySessions.filter((s) => s.clockNumber === clockNumber);

  const companyReactionTimes = companySessions.flatMap((s) =>
    s.clicks.map((c) => c.reactionTimeMs),
  );
  const employeeReactionTimes = employeeSessions.flatMap((s) =>
    s.clicks.map((c) => c.reactionTimeMs),
  );

  return {
    company: {
      sessionCount: companySessions.length,
      clickCount: companyReactionTimes.length,
      medianReactionTimeMs: median(companyReactionTimes) ?? COMPANY_BASELINE_START_MS,
      meanReactionTimeMs: mean(companyReactionTimes) ?? COMPANY_BASELINE_START_MS,
    },
    employee: {
      sessionCount: employeeSessions.length,
      clickCount: employeeReactionTimes.length,
      medianReactionTimeMs: median(employeeReactionTimes) ?? EMPLOYEE_BASELINE_START_MS,
      meanReactionTimeMs: mean(employeeReactionTimes) ?? EMPLOYEE_BASELINE_START_MS,
    },
  };
}
