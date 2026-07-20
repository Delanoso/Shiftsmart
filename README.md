# ShiftSmart Fatigue Reaction Check

A short (~30 second) reaction-time game for employees and equipment operators. Operators enter their **clock number**, read quick instructions, complete a **3‑2‑1** countdown, then tap random circles as fast as possible. Each click records **reaction time**; results feed **per-employee** and **company-wide** baselines. Sessions that look fatigued can trigger a **supervisor alert** (phone number configured later).

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

## Sell / install per company (Option 2)

Each customer gets their **own copy** (zip package), config, and data — not a shared SaaS login.

- **Sales & packaging:** [`deploy/customer/README.md`](deploy/customer/README.md)
- **Install guide:** [`deploy/customer/INSTALL.md`](deploy/customer/INSTALL.md)
- **Go-live checklist:** [`deploy/customer/CHECKLIST.md`](deploy/customer/CHECKLIST.md)
- **Build zip:** `npm run package:customer` → `dist-packages/shiftsmart-fatigue-check-customer-*.zip`

Configure branding via **`data/company.json`** and/or **`.env`** (see `deploy/customer/customer.env.example`).

## Demo employees

Clock numbers **1001–1005** are in `data/employees.json`. Replace or expand that file for your ~500 employees (same JSON shape).

## Bulk employee import

You can now load a full roster from CSV instead of editing JSON by hand.

### CSV format

Required columns:

```csv
clockNumber,name
1001,Alex Rivera
1002,Jordan Lee
```

Download a sample template from:

- `GET /api/admin/employees/template.csv`

### CLI import

Replace the existing roster:

```bash
npm run import:employees -- "/path/to/employees.csv" --companyId=company-1 --companyName="Demo Transport Co."
```

Append to the existing roster instead of replacing:

```bash
npm run import:employees -- "/path/to/employees.csv" --append=true
```

### Import API

- `POST /api/admin/employees/import/preview` — validate CSV and preview first 10 rows
- `POST /api/admin/employees/import` — save the imported roster

Example preview body:

```json
{
  "csvText": "clockNumber,name\n1001,Alex Rivera\n1002,Jordan Lee"
}
```

## Data storage

| File | Purpose |
|------|---------|
| `data/employees.json` | Company + employee roster (clock number, name) |
| `data/shiftsmart.db` | SQLite: sessions, clicks, admin notifications |

Baselines are computed from stored sessions when a run finishes. On first startup, existing `data/sessions.json` is migrated into SQLite if the database is empty.

## Admin dashboard

- URL: **`/admin`** (same host as the operator app)
- Set **`ADMIN_API_KEY`** on the server; supervisors enter it once per browser session
- Fatigue flags automatically create notifications on the admin page (no SMS required)
- Export session history as CSV from the admin **Sessions** tab
- Import employees from CSV on the admin **Employees** tab (preview + replace/append)

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

1. Enter clock number → lookup employee  
2. Instruction modal → close with **×**  
3. Countdown **3, 2, 1**  
4. **30s** game — random circle size/position; miss if not clicked within ~2.5s  
5. Results + baselines + optional fatigue alert  

## API

- `GET /api/company` — company info  
- `GET /api/employees/:clockNumber` — employee lookup  
- `GET /api/baselines/:clockNumber` — current baselines  
- `GET /api/admin/employees/template.csv` — CSV template for bulk driver import  
- `POST /api/admin/employees/import/preview` — validate CSV without saving  
- `POST /api/admin/employees/import` — import employees from CSV  
- `POST /api/sessions` — save session body: `{ clockNumber, durationMs, clicks[], misses, startedAt, endedAt }`
