# ShiftSmart Fatigue Reaction Check

A short (~30 second) reaction-time game for drivers and equipment operators. Operators enter their **clock number**, read quick instructions, complete a **3‑2‑1** countdown, then tap random circles as fast as possible. Each click records **reaction time**; results feed **per-driver** and **company-wide** baselines. Sessions that look fatigued can trigger a **supervisor alert** (phone number configured later).

## Quick start

```bash
npm install
npm run dev
```

- **Web app:** http://localhost:5173  
- **API:** http://localhost:3001  

Production-style run (build + single server):

```bash
npm run build
npm start
```

Serves the built UI and API on port **3001**.

## Demo drivers

Clock numbers **1001–1005** are in `data/drivers.json`. Replace or expand that file for your ~500 drivers (same JSON shape).

## Data storage

| File | Purpose |
|------|---------|
| `data/drivers.json` | Company + driver roster (clock number, name) |
| `data/sessions.json` | Saved game sessions and per-click reaction times |

Baselines (median/mean reaction time, session counts) are computed from stored sessions when a run finishes.

## Alert configuration

Set environment variables on the server:

| Variable | Description |
|----------|-------------|
| `ALERT_WEBHOOK_URL` | Webhook endpoint to receive fatigue alert payloads (recommended) |
| `ALERT_WEBHOOK_TIMEOUT_MS` | Webhook request timeout (default `3500`) |
| `ALERT_PHONE_NUMBER` | Supervisor SMS/call destination (optional; phone integration not wired yet) |
| `ALERT_MARGIN_MS` | Ms above personal baseline median to flag (default `150`) |
| `ALERT_COMPANY_FACTOR` | Multiplier vs company median (default `1.35`) |
| `POOR_REACTION_MS` | Single-click threshold (default `800`) |

## Game flow

1. Enter clock number → lookup driver  
2. Instruction modal → close with **×**  
3. Countdown **3, 2, 1**  
4. **30s** game — random circle size/position; miss if not clicked within ~2.5s  
5. Results + baselines + optional fatigue alert  

## API

- `GET /api/company` — company info  
- `GET /api/drivers/:clockNumber` — driver lookup  
- `GET /api/baselines/:clockNumber` — current baselines  
- `POST /api/sessions` — save session body: `{ clockNumber, durationMs, clicks[], misses, startedAt, endedAt }`
