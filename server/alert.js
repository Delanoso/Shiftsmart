const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL ?? '';
const ALERT_WEBHOOK_TIMEOUT_MS = Number(process.env.ALERT_WEBHOOK_TIMEOUT_MS ?? 3500);

/**
 * POST a fatigue alert payload to ALERT_WEBHOOK_URL when configured.
 * Used for red (review) sessions. Admin dashboard notifications are separate.
 */
export async function sendSupervisorAlert(payload) {
  if (!ALERT_WEBHOOK_URL) {
    return { sent: false, placeholder: true, reason: 'ALERT_WEBHOOK_URL not configured' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ALERT_WEBHOOK_TIMEOUT_MS);

    const res = await fetch(ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        sent: false,
        placeholder: false,
        provider: 'webhook',
        status: res.status,
        error: text || `Webhook responded with ${res.status}`,
      };
    }

    return { sent: true, placeholder: false, provider: 'webhook', status: res.status };
  } catch (err) {
    return {
      sent: false,
      placeholder: false,
      provider: 'webhook',
      error: err instanceof Error ? err.message : 'Unknown alert error',
    };
  }
}

