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

### B. Driver roster

Prepare CSV:

```csv
clockNumber,name
1001,Jane Smith
1002,John Doe
```

Import:

```bash
npm install
npm run import:drivers -- "./data/drivers-template.csv" --companyId=company-1 --companyName="Your Company Name Here"
```

Or replace `drivers-template.csv` with the customer export from payroll/HR.

### C. Logo (optional)

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

- `data/drivers.json`
- `data/sessions.json`
- `data/company.json`
- `.env` (secure storage)

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
