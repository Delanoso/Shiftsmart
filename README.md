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

## Employee roster

Roster starts empty. Import employees after install:

- Admin → **Employees** (CSV upload), or
- `npm run import:employees -- "/path/to/employees.csv"`

CSV format:

```csv
clockNumber,name
E1001,Example Name
E1002,Example Name
```

Download a sample template from:

- `GET /api/admin/employees/template.csv` (requires admin key)

### CLI import

Replace the existing roster:

```bash
npm run import:employees -- "/path/to/employees.csv" --companyId=company-1 --companyName="Your Company Name"
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
  "csvText": "clockNumber,name\nE1001,Example Name\nE1002,Example Name"
}
```

## Data storage

| File | Purpose |
|------|---------|
| `data/employees.json` | Company + employee roster (clock number, name, site) |
| `data/shiftsmart.db` | SQLite: sessions, clicks, admin notifications, audit log |
| `data/company.json` | Branding + configured sites/depots |

Baselines are computed from stored sessions when a run finishes. On first startup, existing `data/sessions.json` is migrated into SQLite if the database is empty.

## Admin dashboard

- URL: **`/admin`** (same host as the operator app)
- Set **`ADMIN_API_KEY`** on the server (default install key is `ADMIN-API-KEY` — change it during setup); supervisors enter it once per browser session
- Fatigue flags automatically create notifications on the admin page (no SMS required)
- Export session history as CSV from the admin **Sessions** tab
- Import, edit, and delete employees on the admin **Employees** tab (CSV supports optional `site` / depot)
- Filter notifications, sessions, and employees by **site / depot**
- Branding + site list: admin **Settings** tab (company name is set by IT at install)
- **Audit** tab logs roster/branding changes and completed sessions
- API rate limits protect `/api`, game submissions, and admin routes (`RATE_LIMIT_*` env vars)

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
| `RATE_LIMIT_API_MAX` | Max `/api` requests per IP per minute (default `180`) |
| `RATE_LIMIT_SESSION_MAX` | Max game submissions per IP per minute (default `20`) |
| `RATE_LIMIT_ADMIN_MAX` | Max admin API requests per IP per minute (default `240`) |

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
- `GET /api/admin/employees/template.csv` — CSV template for bulk employee import  
- `POST /api/admin/employees/import/preview` — validate CSV without saving  
- `POST /api/admin/employees/import` — import employees from CSV  
- `PUT /api/admin/employees/:clockNumber` — edit employee  
- `DELETE /api/admin/employees/:clockNumber` — delete employee  
- `GET /api/admin/audit` — audit log  
- `PUT /api/admin/settings/sites` — manage site/depot list  
- `POST /api/sessions` — save session body: `{ clockNumber, durationMs, clicks[], misses, startedAt, endedAt }`
