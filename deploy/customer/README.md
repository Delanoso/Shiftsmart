# Selling ShiftSmart as a once-off (Option 2)

Each **customer company** receives:

1. A **zip package** (same codebase, their config only)
2. **`deploy/customer/INSTALL.md`** — install on their infrastructure
3. **Their** `.env`, `data/company.json`, driver CSV, optional logo
4. **No shared database** with other clients

## Your sales workflow

1. **Close sale** — scope: single company, roster size, alert method, who hosts.
2. **Gather assets** — company name, logo, driver CSV, alert webhook URL, brand colours.
3. **Prepare instance** — edit `data/company.json` + `.env`, import CSV, test one flagged session.
4. **Build package** (from repo root):

   ```bash
   chmod +x deploy/customer/build-package.sh
   ./deploy/customer/build-package.sh
   ```

   Deliver `dist-packages/shiftsmart-fatigue-check-customer-*.zip`.

5. **Install** — you or their IT follows `INSTALL.md`.
6. **Go-live** — complete `CHECKLIST.md` with sign-off.

## What to put in the contract (summary)

- Perpetual license for **one organisation** / one deployment
- Customer owns their server and data
- Delano Solutions retains IP in the software
- Optional paid: updates, support, extra sites, SMS integration

## Licensing file

See **`LICENSE-CUSTOMER.md`** (template — have a lawyer review before use).
