You are a B2B sales copywriter for an industrial / transport / depot workforce product.

Write a **client-facing sales pack** for this product. Tone: clear, professional, safety-focused, not hypey. No fake stats. No competitor bash. Suitable for operations managers, HSE, and depot supervisors.

## Product
**Name:** ShiftSmart Fatigue Reaction Check  
**Model:** Sold as **Option 2** — a once-off per-company installable copy (not multi-tenant SaaS). Each buyer gets their own package, runs on their own server/PC, and keeps their own data.

## What it does
A short (~30 second) reaction-time game employees/operators complete before driving or using equipment.

Flow:
1. Enter clock number  
2. Short instructions (close with ×)  
3. Countdown 3-2-1  
4. ~30s game — tap random circles as fast as possible  
5. Results + personal and company baselines  

## Green / red rules (supervisor view)
- Every completed session notifies the admin dashboard  
- **Green:** fewer than 4 hits ≥ 800ms, and no misses  
- **Red:** 4+ hits ≥ 800ms, **or** any missed circle  
- Optional webhook can fire for red sessions (no built-in SMS)

## Admin dashboard (`/admin`)
Protected by an admin key set by buyer IT.
- Notifications (green/red), filter by site/depot  
- Session history + CSV export  
- Employees: add / edit / delete + CSV import (`clockNumber`, `name`, optional `site`)  
- Settings: logo, colours, sites/depots (company name is set by IT only)  
- Audit log  
- Opening the operator screen signs admin out (shared tablet safe)

## Buyer IT / delivery
- Delivered as a zip package  
- Buyer IT follows setup guide: Node.js, `.env` (`COMPANY_NAME`, `ADMIN_API_KEY`, etc.), `npm install && npm run build && npm start`  
- Empty roster on first open — they import employees  
- Data stays on their machine (SQLite + JSON)  
- Optional: HTTPS reverse proxy, kiosk mode for depot tablets, webhook alerts  

## Positioning
- Pre-start screening aid, not a medical device  
- Objective reaction data vs only conversation/visual judgment  
- Low friction (~30 seconds)  
- Fits depots / transport / industrial ops  
- White-label look: their company name, logo, colours  

## Deliverables to write
1. **One-page sales brief** (problem → solution → how it works → benefits → what’s included)  
2. **Short pitch email** to an ops/HSE manager  
3. **Discovery call script** (8–10 questions + 60-second verbal pitch)  
4. **Objection handlers** for: “we already do verbal checks”, “is this medical?”, “why not SaaS?”, “what about privacy/data?”, “will staff hate it?”  
5. **Proposal outline** (sections only + suggested wording for executive summary)  

## Constraints
- Do not invent clinical claims or guaranteed incident reductions  
- Call it a **screening / operational aid**; supervisors still decide  
- Emphasize **their install, their data, their branding**  
- Keep language plain enough for depot supervisors  

Start with the one-page sales brief.
