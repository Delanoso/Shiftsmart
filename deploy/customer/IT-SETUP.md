# ShiftSmart — IT setup guide

For the **IT team** at the company that purchased ShiftSmart.  
You install and run a **dedicated copy** on your own server or PC. Data stays with you.

---

## 1. Requirements

- **Node.js 20+** (22 LTS recommended) and **npm**
- A host that can listen on a port (default **3001**)
- Optional: reverse proxy (nginx / Caddy) for HTTPS
- Optional: outbound HTTPS if you use a webhook alert URL

---

## 2. Unpack

Unzip the package to a permanent folder, for example:

- Linux: `/opt/shiftsmart`
- Windows: `C:\ShiftSmart`

---

## 3. Configure

### 3.1 Create `.env`

```bash
cp deploy/customer/customer.env.example .env
```

Edit `.env` and set at least:

| Setting | What to put |
|---------|-------------|
| `COMPANY_NAME` | Your company name (shown in the app) |
| `COMPANY_ID` | Stable ID, e.g. `acme-depot` (do not change later) |
| `ADMIN_API_KEY` | **New secret** for supervisors — do not keep `ADMIN-API-KEY` |
| `PORT` | `3001` unless you need another port |

Optional but common:

| Setting | Purpose |
|---------|---------|
| `BRAND_PRIMARY` / `BRAND_ACCENT` / `BRAND_TARGET` | Brand colours (hex) |
| `LOGO_PATH` | File under `public/`, e.g. `client-logo.png` |
| `ALERT_WEBHOOK_URL` | URL that receives JSON when a session is **red** |
| `KIOSK_MODE=true` | Depot tablets auto-return to login after results |
| `KIOSK_EXIT_PIN` | PIN to exit kiosk / fullscreen (if used) |

`.env` overrides matching fields in `data/company.json`.

### 3.2 Admin key (required)

Default key in the package:

```env
ADMIN_API_KEY=ADMIN-API-KEY
```

**Change this before go-live.** Share the new key only with supervisors.

Supervisors open `https://your-server/admin` and enter that key.  
Opening the operator screen clears the admin session so shared tablets stay safe.

### 3.3 Employee roster

Roster starts empty. Prepare a CSV:

```csv
clockNumber,name,site
E1001,Jane Smith,Main Depot
E1002,John Doe,North Yard
```

- `clockNumber` and `name` are required  
- `site` is optional (also accepts headers `depot`, `location`, `yard`)

**Import options:**

1. After the app is running: Admin → **Employees** → CSV upload (preview, then apply), or  
2. CLI (from the install folder):

```bash
npm install
npm run import:employees -- "/path/to/employees.csv" --companyId=YOUR_COMPANY_ID --companyName="Your Company Name"
```

### 3.4 Logo (optional)

- Prefer: Admin → **Settings** → upload logo, or  
- Place `public/client-logo.png` and set `LOGO_PATH=client-logo.png` in `.env`

Company **name** is set only by IT (`COMPANY_NAME` / `data/company.json`). Supervisors cannot change it in Admin.

---

## 4. Build and run

```bash
npm install
npm run build
npm start
```

- Operator screen: `http://localhost:3001`  
- Admin: `http://localhost:3001/admin`

### Run on boot (Linux systemd example)

Create `/etc/systemd/system/shiftsmart.service`:

```ini
[Unit]
Description=ShiftSmart Fatigue Check
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/shiftsmart
Environment=NODE_ENV=production
EnvironmentFile=/opt/shiftsmart/.env
ExecStart=/usr/bin/npm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now shiftsmart
```

---

## 5. HTTPS (recommended)

Put nginx or Caddy in front if the app is used off the depot LAN.

Example nginx:

```nginx
location / {
  proxy_pass http://127.0.0.1:3001;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## 6. How alerting works

1. Every completed game creates an admin **notification** (green or red).  
2. **Red** sessions can also POST JSON to `ALERT_WEBHOOK_URL` if set.  
3. There is no built-in SMS — use your webhook (Teams, email gateway, dispatch tool, etc.).

**Red** = 4 or more hits at/above 800 ms, or any missed circle.  
**Green** = under that slow-hit count and no misses.

---

## 7. Backups

Back up regularly (and before updates):

| Path | Contents |
|------|----------|
| `data/shiftsmart.db` | Sessions, notifications, audit log |
| `data/employees.json` | Employee roster |
| `data/company.json` | Branding and sites |
| `.env` | Secrets (store securely) |

---

## 8. Day-to-day admin

| Task | Where |
|------|--------|
| Watch results | `/admin` → Notifications |
| Export history | Sessions → Export CSV |
| Maintain roster | Employees (add / edit / delete / CSV) |
| Sites / depots | Settings |
| Logo & colours | Settings |
| Review changes | Audit |

---

## 9. Updates

1. Stop the service  
2. Back up `data/` and `.env`  
3. Replace application files with the new package **except** `data/` and `.env`  
4. `npm install && npm run build && npm start` (or restart systemd)

---

## 10. Go-live

Complete [`CHECKLIST.md`](CHECKLIST.md) with your safety lead before operators use the system in production.

---

## Support boundary (typical)

**Usually included with purchase:** software package, this setup guide, branding via config, CSV roster import, webhook alert endpoint.

**Usually customer / optional:** hosting, TLS certificates, SMS provider, HR system sync, custom reporting, ongoing support SLA.
