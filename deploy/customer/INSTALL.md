# ShiftSmart — customer install (Option 2)

Install a **dedicated copy** on the customer’s server or PC. Each sale gets its own instance, data, and branding. Delano Solutions supplies the package; the customer (or you on their behalf) runs this guide once.

## Requirements

- **Node.js 20+** (22 LTS recommended)
- **npm**
- A machine that can listen on a port (default **3001**)
- Network access only if you use **webhook alerts**

## 1. Unpack the package

Unzip `shiftsmart-fatigue-check-customer-*.zip` to a folder, for example:

`/opt/shiftsmart` or `C:\ShiftSmart`

## 2. Configure the customer

### A. Environment (quick)

```bash
cp deploy/customer/customer.env.example .env
```

Edit `.env`:

| Setting | Purpose |
|--------|---------|
| `COMPANY_NAME` | Customer name shown in the app |
| `COMPANY_ID` | Internal ID (keep stable for data) |
| `VENDOR_NAME` | Delano Solutions (or your brand) |
| `PRODUCT_NAME` | App title |
| `BRAND_*` | Colours |
| `LOGO_PATH` | File in `public/` (e.g. `client-logo.png`) |
| `ALERT_WEBHOOK_URL` | Where fatigue alerts POST as JSON |

You can instead (or also) edit **`data/company.json`** for the same fields; **`.env` overrides** the JSON file.

### B. Employee roster

Roster starts empty. Prepare CSV:

```csv
clockNumber,name,site
E1001,Jane Smith,Main Depot
E1002,John Doe,North Yard
```

Import via Admin → **Employees** after login, or CLI:

```bash
npm install
npm run import:employees -- "/path/to/employees.csv" --companyId=company-1 --companyName="Your Company Name Here"
```

### C. Admin key (important)

The package ships with the standard key:

```env
ADMIN_API_KEY=ADMIN-API-KEY
```

**Change this during setup** before go-live, then give the new key only to supervisors.

### D. Logo (optional)

Upload from Admin → **Settings** after login, or:

1. Save the customer logo as `public/client-logo.png`
2. Set `LOGO_PATH=client-logo.png` in `.env`

## 3. Build and run

```bash
npm install
npm run build
npm start
```

Open: **http://localhost:3001** (same port serves UI + API).

### Run on boot (Linux, systemd example)

Create `/etc/systemd/system/shiftsmart.service`:

```ini
[Unit]
Description=ShiftSmart Fatigue Check
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/shiftsmart
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then: `sudo systemctl enable --now shiftsmart`

## 4. Reverse proxy + HTTPS (recommended)

Put **nginx** or **Caddy** in front for TLS and a friendly URL, e.g. `fatigue.customer.com`.

Example nginx location:

```nginx
location / {
  proxy_pass http://127.0.0.1:3001;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}
```

## 5. Alerts

When a session is flagged, the server POSTs JSON to `ALERT_WEBHOOK_URL` if set. Payload includes driver name, clock number, reasons, and session median reaction time.

Test with [webhook.site](https://webhook.site) during setup, then point to the customer’s SMS gateway, Teams workflow, or dispatch system.

## 6. Backups

Back up regularly:

- `data/shiftsmart.db` (SQLite — sessions, clicks, admin notifications, audit log)
- `data/employees.json`
- `data/company.json` (branding + sites/depots)
- `data/company.json`
- `.env` (secure storage)

Legacy `data/sessions.json` is only used once to migrate into SQLite if the database is empty.

## Admin dashboard

Supervisors open **`/admin`** on the same server URL and sign in with `ADMIN_API_KEY`.

Default install key: **`ADMIN-API-KEY`** (change during setup).

- Fatigue flags create **admin notifications** automatically (no SMS required)
- Review session history and **export CSV**
- Import, **edit**, and **delete** employees on the **Employees** tab (CSV may include optional `site` / depot)
- Filter by **site / depot** on Notifications, Sessions, and Employees
- Configure sites under **Settings**; review changes on the **Audit** tab
- Branding (logo + colours) on **Settings** — company name is set by IT at install only
- Upload logo and set brand colours on the **Settings** tab (company name is set by IT at install)

## 7. Updates (new version from Delano Solutions)

1. Stop the service
2. Back up `data/` and `.env`
3. Replace application files with the new package **except** `data/` and `.env`
4. `npm install && npm run build && npm start`

## 8. Handoff checklist

Use **`CHECKLIST.md`** in this folder before go-live.

## Support boundary (suggested for your contract)

**Included in typical once-off install:** package, branding config, CSV import, one webhook alert endpoint, deployment guide.

**Customer / optional paid:** hosting, HTTPS certs, SMS provider, HR feed integration, custom reporting, ongoing support.

---

**Delano Solutions** — ShiftSmart Fatigue Reaction Check
