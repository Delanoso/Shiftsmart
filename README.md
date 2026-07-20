# ShiftSmart Fatigue Reaction Check

A ~30 second reaction-time check for employees and equipment operators before they drive or use equipment.

Operators enter a **clock number**, read short instructions, complete a **3-2-1** countdown, then tap random circles. Reaction times are stored and compared to personal and company baselines. Supervisors review results in the admin dashboard (green = within range, red = review).

## Quick start (developers)

```bash
npm install
npm run dev
```

- UI (Vite): http://localhost:5173  
- API: http://localhost:3001  

Production-style (one process serves UI + API):

```bash
npm install
npm run build
npm start
```

Open http://localhost:3001

## What you get (Option 2 — per company)

Each customer receives their **own install** (not multi-tenant SaaS): app files, config, and local data.

| Document | Audience |
|----------|----------|
| [`deploy/customer/IT-SETUP.md`](deploy/customer/IT-SETUP.md) | **Buyer IT** — install, configure, run, backup |
| [`deploy/customer/CHECKLIST.md`](deploy/customer/CHECKLIST.md) | Go-live sign-off |
| [`deploy/customer/README.md`](deploy/customer/README.md) | Sales / packaging workflow |
| [`deploy/customer/LICENSE-CUSTOMER.md`](deploy/customer/LICENSE-CUSTOMER.md) | License template |

Build a customer zip:

```bash
npm run package:customer
```

Output: `dist-packages/shiftsmart-fatigue-check-customer-*.zip`

## Operator flow

1. Enter clock number  
2. Instructions → close with **×**  
3. Countdown **3, 2, 1**  
4. ~**30s** game (random circles; miss if not tapped in time)  
5. Results + baselines; supervisor notification created  

## Admin dashboard (`/admin`)

Sign in with **`ADMIN_API_KEY`** (change from the default `ADMIN-API-KEY` before go-live).

Leaving admin for the operator screen clears the session — the key must be entered again (shared-tablet safe).

| Tab | Purpose |
|-----|---------|
| Notifications | Every completed session (green / red), filter by site |
| Sessions | History + CSV export, filter by site |
| Employees | Add / edit / delete, CSV import, site filter |
| Settings | Logo, colours, sites/depots (company name is IT-only) |
| Audit | Roster, branding, and session activity log |

### Employee CSV

```csv
clockNumber,name,site
E1001,Jane Smith,Main Depot
E1002,John Doe,North Yard
```

`site` is optional (`depot` / `location` / `yard` also accepted).

Import in Admin → **Employees**, or:

```bash
npm run import:employees -- "/path/to/employees.csv" --companyId=company-1 --companyName="Your Company Name"
```

Append instead of replace: add `--append=true`.

## Data files

| Path | Purpose |
|------|---------|
| `data/employees.json` | Roster (clock number, name, site) |
| `data/company.json` | Product name, company name, branding, sites |
| `data/shiftsmart.db` | SQLite: sessions, notifications, audit log |
| `.env` | Server secrets and overrides (not committed) |

Roster starts **empty**. Branding defaults are placeholders until IT configures the company.

## Environment (common)

Copy `.env.example` or `deploy/customer/customer.env.example` to `.env`.

| Variable | Purpose |
|----------|---------|
| `COMPANY_NAME` | Customer name shown in the app |
| `COMPANY_ID` | Stable internal ID |
| `ADMIN_API_KEY` | Supervisor admin login (change in production) |
| `ALERT_WEBHOOK_URL` | Optional POST target for **red** sessions |
| `POOR_REACTION_MS` | Slow-hit threshold (default `800`) |
| `KIOSK_MODE` | Auto-return to login on depot tablets |
| `KIOSK_EXIT_PIN` | Optional PIN to leave kiosk / fullscreen |

See the env example files for baselines, colours, and kiosk options.

## Green / red rules

- **Green:** fewer than 4 hits ≥ 800 ms, and **no** misses  
- **Red:** 4+ hits ≥ 800 ms, **or** any missed circle  

Every session notifies the admin dashboard. Optional webhook fires for red sessions only.

## API (summary)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/health` | Health + whether admin key is configured |
| GET | `/api/config` | Public branding / kiosk config |
| GET | `/api/employees/:clockNumber` | Operator lookup |
| POST | `/api/sessions` | Save a completed game |
| * | `/api/admin/*` | Requires `X-Admin-Key` header |

## License

Customer license template: [`deploy/customer/LICENSE-CUSTOMER.md`](deploy/customer/LICENSE-CUSTOMER.md)
