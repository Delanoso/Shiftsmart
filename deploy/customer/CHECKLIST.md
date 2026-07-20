# Customer go-live checklist

Use this when handing over or accepting an Option 2 install.

## Configuration

- [ ] `COMPANY_NAME` and `COMPANY_ID` set in `.env`
- [ ] `ADMIN_API_KEY` changed from default `ADMIN-API-KEY`
- [ ] Brand colours and logo confirmed (Admin → Settings or `.env` / `public/`)
- [ ] Disclaimer text reviewed with safety / compliance
- [ ] Sites / depots added if you use multi-site filters

## Roster

- [ ] Employee CSV imported (Admin → Employees or `npm run import:employees`)
- [ ] Spot-check: 3 clock numbers log in with correct names
- [ ] No duplicate clock numbers

## Game and data

- [ ] Full run: instructions → countdown → 30s game → results
- [ ] Session appears under Admin → Sessions
- [ ] Baselines show on the results screen
- [ ] One **green** and one **red** test reviewed in Notifications

## Alerts

- [ ] Notifications appear on `/admin`
- [ ] Supervisors can sign in with the production admin key
- [ ] Leaving admin for the operator screen requires the key again
- [ ] Optional: `ALERT_WEBHOOK_URL` tested with a red session

## Production

- [ ] `npm run build` completed on the target host
- [ ] Service starts on reboot (systemd / Windows service / PM2)
- [ ] HTTPS enabled if used outside the depot LAN
- [ ] Backup plan for `data/shiftsmart.db`, `data/employees.json`, `data/company.json`, and `.env`

## Training (about 5 minutes)

- [ ] Operators: clock number → play → results
- [ ] Supervisors: green vs red and escalation path
- [ ] IT: where data files and backups live

## Sign-off

| Role | Name | Date |
|------|------|------|
| Customer safety lead | | |
| Customer IT | | |
| Supplier | | |
