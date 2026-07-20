# ShiftSmart — customer install package

This folder is what buyer **IT** and your sales handoff use for Option 2 (one install per company).

## For buyer IT

Start here: **[`IT-SETUP.md`](IT-SETUP.md)**

Then: **[`CHECKLIST.md`](CHECKLIST.md)** before go-live.

## For sales / packaging

Each customer gets:

1. A zip of the app (their own copy — not shared SaaS)
2. `IT-SETUP.md` — install on their infrastructure
3. Their `.env`, company name, employee CSV, optional logo
4. No shared database with other clients

### Workflow

1. Close sale — single company, roster size, hosting, alert method.  
2. Gather assets — company name, logo, employee CSV, webhook URL, colours.  
3. Prepare instance — set `COMPANY_NAME` / `.env`, import CSV, test green + red.  
4. Build package from repo root:

   ```bash
   npm run package:customer
   ```

   Deliver `dist-packages/shiftsmart-fatigue-check-customer-*.zip`.

5. Install — customer IT (or you) follows `IT-SETUP.md`.  
6. Go-live — complete `CHECKLIST.md`.

### Contract notes (summary)

- Perpetual license for **one organisation** / one deployment  
- Customer owns their server and data  
- Supplier retains IP in the software  
- Optional paid: updates, support, extra sites, integrations  

License template: [`LICENSE-CUSTOMER.md`](LICENSE-CUSTOMER.md)
