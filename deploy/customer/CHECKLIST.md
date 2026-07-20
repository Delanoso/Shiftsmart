# Customer go-live checklist

Use this when handing over an Option 2 install.

## Configuration

- [ ] `COMPANY_NAME` and `COMPANY_ID` set in `.env` or `data/company.json`
- [ ] Brand colours verified in the browser
- [ ] Logo placed in `public/` and `LOGO_PATH` set (if used)
- [ ] Disclaimer text reviewed with customer safety/compliance contact

## Roster

- [ ] Driver CSV imported (`npm run import:drivers`)
- [ ] Spot-check: 3 clock numbers log in and show correct names
- [ ] Duplicate clock numbers resolved

## Game & data

- [ ] Full test run: instructions → countdown → 30s game → results
- [ ] Session appears in `data/sessions.json`
- [ ] Baselines show on results screen

## Alerts

- [ ] Fatigue flag creates a notification on **`/admin`**
- [ ] Supervisor can log in with `ADMIN_API_KEY`
- [ ] Optional: `ALERT_WEBHOOK_URL` for external systems

## Production

- [ ] `npm run build` completed on target server
- [ ] Service starts on reboot (systemd / Windows Task / PM2)
- [ ] HTTPS enabled if exposed outside the depot LAN
- [ ] Backup plan for `data/shiftsmart.db` documented

## Training (5 minutes)

- [ ] Operators: clock number → play → results
- [ ] Supervisors: what a “flagged” result means and escalation path
- [ ] IT: where logs and data files live

## Sign-off

| Role | Name | Date |
|------|------|------|
| Customer safety lead | | |
| Delano Solutions | | |
