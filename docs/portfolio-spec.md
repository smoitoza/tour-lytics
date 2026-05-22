# TourLytics Portfolio Module — Design Spec v0.1

**Status:** Draft for review
**Author:** Scott Moitoza + Computer
**Last updated:** May 21, 2026

---

## 1. Vision

Extend TourLytics from a deal-evaluation tool (RFP analysis, what-if modeling) into a portfolio-management tool for corporate tenants who already have a real estate footprint. Think CoStar-style portfolio dashboard, but built for tenants instead of landlords, with AI-powered lease abstraction and a Scout-driven conversational layer.

**Primary buyer:** Corporate in-house real estate teams (AmeriLife is the charter customer profile).

**Job to be done:** "I have 17 leased locations across 3 countries. Show me what's expiring, what I'm spending, what notices are coming up, and let me ask questions in plain English."

---

## 2. Product principles

1. **Lease is the legal anchor**, not Location. A lease can cover one or many premises.
2. **Per-location annual pricing.** Predictable revenue, scales with portfolio size.
3. **AI extracts, human approves.** Never push AI-extracted critical dates straight to production. Notice windows and expirations carry legal risk.
4. **Multi-currency from day one.** Global tenants need this; retrofitting later is painful.
5. **Separate module, shared login.** Lives at `/portfolio` inside the existing tour-lytics app. Top nav has "Projects" and "Portfolio" siblings.
6. **Scout works across both.** One chat that knows about active RFPs and the existing portfolio.

---

## 3. Data model

### 3.1 Core hierarchy

```
Company (the tenant org)
  ├── company_members (users + roles)
  ├── company_settings (reporting currency, branding)
  └── Lease (the legal instrument)
        ├── lease_locations (1..N premises covered by this lease)
        ├── rent_schedule (base rent over time)
        ├── opex_terms (initial rate, escalation, free months)
        ├── critical_dates (notices, options, expirations)
        ├── security_instruments (deposits, LOCs, guaranties)
        ├── lease_documents (PDFs)
        └── lease_abstractions (draft AI extractions awaiting review)
```

### 3.2 Table definitions

**`companies`**
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| name | text | "AmeriLife Group, LLC" |
| slug | text unique | URL-friendly identifier |
| reporting_currency | text | ISO 4217, default 'USD' |
| logo_url | text nullable | |
| created_at | timestamptz | |
| created_by | uuid → auth.users | |

**`company_members`**
| Column | Type | Notes |
|---|---|---|
| company_id | uuid → companies | |
| user_id | uuid → auth.users | |
| role | text | 'owner' / 'admin' / 'viewer' |
| invited_email | text | for pending invites before user signs up |
| status | text | 'active' / 'pending' |
| created_at | timestamptz | |

**`leases`**
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| company_id | uuid → companies | |
| name | text | "Cochrane Buildings A-E Master Lease" |
| landlord_name | text | |
| landlord_entity | text | "TC Morgan Hill Venture, LLC" |
| currency | text | ISO 4217, immutable after creation |
| lease_type | text | 'NNN' / 'gross' / 'modified gross' / 'full service' |
| commencement_date | date | |
| rent_commencement_date | date | may differ from commencement |
| expiration_date | date | |
| term_months | int | derived but stored for query speed |
| status | text | 'draft' / 'active' / 'expired' / 'terminated' |
| abstracted_at | timestamptz nullable | when AI extraction completed |
| approved_at | timestamptz nullable | when human approved abstraction |
| approved_by | uuid nullable | |
| notes | text | |
| created_at, updated_at | timestamptz | |

**`lease_locations`** (the premises a lease covers)
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| lease_id | uuid → leases | |
| label | text | "Building A" or "Suite 200" |
| address_line1 | text | |
| address_line2 | text nullable | |
| city | text | |
| state_province | text | |
| postal_code | text | |
| country | text | ISO 3166 alpha-2 |
| region | text | derived: 'North America' / 'EMEA' / 'APAC' (or user-overridable) |
| latitude | numeric(10,7) | from geocoding |
| longitude | numeric(10,7) | |
| rentable_sqft | int | |
| floor_count | int nullable | |
| use_type | text | 'office' / 'industrial' / 'flex' / 'retail' / 'lab' |
| is_primary | boolean | for the map pin if multiple locations |
| created_at | timestamptz | |

**`rent_schedule`**
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| lease_id | uuid → leases | |
| period_start | date | |
| period_end | date | |
| monthly_rent | numeric(14,2) | in lease currency |
| rent_psf_annual | numeric(8,2) | denormalized for queries |
| is_free_rent | boolean | abated month flag |
| escalation_type | text | 'fixed' / 'cpi' / 'fmv' / 'none' (for reference) |

**`opex_terms`**
| Column | Type | Notes |
|---|---|---|
| lease_id | uuid → leases pk | one row per lease |
| starting_opex_psf_annual | numeric(8,2) | |
| escalation_pct | numeric(5,2) | annual escalation |
| escalation_type | text | 'fixed' / 'cpi' / 'capped' |
| cap_pct | numeric(5,2) nullable | if capped |
| free_opex_months | int | 0 if none |
| free_opex_start | date nullable | |
| base_year | int nullable | for base-year structures |

**`critical_dates`**
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| lease_id | uuid → leases | |
| date_type | text | 'notice_to_renew' / 'notice_to_terminate' / 'option_to_extend' / 'option_to_terminate' / 'roFR' / 'roFO' / 'cap_review' / 'rent_review' / 'expiration' |
| trigger_date | date | the date itself or window start |
| trigger_date_end | date nullable | for windows |
| description | text | |
| reminder_days_before | int | default 180 |
| status | text | 'upcoming' / 'completed' / 'missed' / 'n_a' |
| completed_at, completed_by | | |

**`security_instruments`**
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| lease_id | uuid → leases | |
| instrument_type | text | 'cash_deposit' / 'letter_of_credit' / 'corporate_guaranty' / 'personal_guaranty' |
| amount | numeric(14,2) | |
| currency | text | |
| issuer | text nullable | bank for LOC |
| expiration_date | date nullable | LOC expiry |
| burndown_schedule | jsonb nullable | for stepdown LOCs |
| notes | text | |

**`lease_documents`**
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| lease_id | uuid → leases | |
| storage_path | text | Supabase Storage bucket path |
| original_filename | text | |
| document_type | text | 'lease' / 'amendment' / 'sndA' / 'estoppel' / 'exhibit' / 'side_letter' / 'other' |
| effective_date | date nullable | |
| uploaded_by | uuid | |
| uploaded_at | timestamptz | |
| size_bytes | bigint | |
| page_count | int nullable | |

**`lease_abstractions`** (the AI-extraction staging table)
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| lease_id | uuid → leases nullable | null until approved and lease record created |
| company_id | uuid → companies | |
| source_document_id | uuid → lease_documents | |
| extracted_fields | jsonb | full extraction payload, schema versioned |
| extraction_version | text | model + prompt version, e.g., 'gpt-5-portfolio-v1' |
| status | text | 'pending_review' / 'approved' / 'rejected' / 'needs_more_info' |
| confidence_score | numeric(3,2) nullable | overall extraction confidence |
| reviewer_id | uuid nullable | |
| reviewed_at | timestamptz nullable | |
| reviewer_notes | text | |
| created_at | timestamptz | |

**`fx_rates`** (cached for offline reporting)
| Column | Type | Notes |
|---|---|---|
| base_currency | text | |
| quote_currency | text | |
| rate | numeric(14,8) | |
| as_of_date | date | |
| source | text | 'exchangerate.host' / 'manual' |
| PK | (base, quote, as_of_date) | |

### 3.3 Row-Level Security (RLS)

All portfolio tables get RLS enabled. Standard pattern:

```sql
-- companies: only members can SELECT
CREATE POLICY company_select ON companies FOR SELECT
  USING (id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid() AND status = 'active'));

-- Children inherit through their company_id or lease_id
-- e.g., leases readable if user is member of the lease's company
```

Admins (`role IN ('owner', 'admin')`) get INSERT/UPDATE/DELETE. Viewers are read-only.

---

## 4. API surface

All routes under `/api/portfolio/`. JSON over HTTP, mirrors existing TourLytics patterns.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/portfolio/companies` | list companies for current user |
| POST | `/api/portfolio/companies` | create new company |
| GET | `/api/portfolio/companies/[id]` | company detail with summary metrics |
| PATCH | `/api/portfolio/companies/[id]` | update settings (reporting currency, name) |
| GET | `/api/portfolio/companies/[id]/members` | list members |
| POST | `/api/portfolio/companies/[id]/members` | invite member |
| DELETE | `/api/portfolio/companies/[id]/members/[userId]` | remove |
| GET | `/api/portfolio/leases?companyId=X` | list leases (paginated) |
| POST | `/api/portfolio/leases` | create lease (manual entry) |
| GET | `/api/portfolio/leases/[id]` | full lease detail with children |
| PATCH | `/api/portfolio/leases/[id]` | update |
| DELETE | `/api/portfolio/leases/[id]` | soft delete |
| POST | `/api/portfolio/leases/[id]/locations` | add location |
| PATCH | `/api/portfolio/leases/[id]/locations/[locId]` | update location |
| POST | `/api/portfolio/leases/[id]/documents` | upload PDF, triggers abstraction job |
| GET | `/api/portfolio/leases/[id]/documents/[docId]` | signed download URL |
| GET | `/api/portfolio/abstractions?companyId=X&status=pending_review` | review queue |
| POST | `/api/portfolio/abstractions/[id]/approve` | approve → creates/updates lease |
| POST | `/api/portfolio/abstractions/[id]/reject` | reject with notes |
| GET | `/api/portfolio/critical-dates?companyId=X&windowDays=180` | upcoming notice/expiration |
| GET | `/api/portfolio/fx-rates?from=USD&to=GBP&date=2026-05-21` | conversion rate |
| POST | `/api/portfolio/scout/query` | natural language query over portfolio |

---

## 5. UI surface (page-by-page)

### 5.1 `/portfolio` — Dashboard

**Layout:** left rail nav, main canvas split into map (top 60%) + summary cards (bottom 40%).

**Map (Mapbox GL JS):**
- Pins for each `lease_locations` row with valid lat/long
- Pin color encodes status: green (active >2yr to expiry), yellow (1-2yr), red (<1yr or in notice window)
- Hover tooltip: location label, sqft, straightline annual rent (reporting currency), OpEx/yr, expiration date, next notice window
- Click pin → navigate to Location detail
- Cluster pins at low zoom
- Region filter dropdown (NA / EMEA / APAC / All)

**Summary cards:**
- Total locations | Total sqft | Annual rent run-rate (reporting currency)
- Next 3 critical dates (lease name, date type, date, days away)
- Lease expirations next 24 months (mini bar chart by quarter)
- Currency breakdown if multi-currency

### 5.2 `/portfolio/leases` — Lease List

Table view with columns: Name, Locations (count), City/Country, SF, Annual Rent (native + reporting), Expiration, Status. Sort/filter/search. Export to Excel.

### 5.3 `/portfolio/leases/[id]` — Lease Detail

**Tabs:**
1. **Overview** — material terms summary, landlord, currency, term dates, key metrics
2. **Locations** — list of premises, embedded mini-map, sqft/use type per location
3. **Financials** — rent schedule table + chart, OpEx terms, straightline calc, multi-year visualization
4. **Critical Dates** — notice windows, options, with completion checkboxes
5. **Security** — deposits, LOCs with expiration tracking
6. **Documents** — PDF library with type tags, upload button, in-browser preview
7. **History** — audit log of changes and abstractions

### 5.4 `/portfolio/abstractions/[id]` — Abstraction Review

Side-by-side: PDF viewer on left, extracted-fields form on right. Each field shows:
- AI-proposed value
- Confidence indicator
- Edit / Approve / Flag controls
- Page reference (clicks scroll PDF to source)

Bottom: "Approve & Create Lease" / "Approve & Update Existing" / "Reject" / "Save Draft."

### 5.5 `/portfolio/settings` — Company Settings

Name, slug, reporting currency, logo, members list, billing summary, region overrides.

### 5.6 Scout integration

Scout chat available globally. When user is in `/portfolio/*` scope, Scout has access to portfolio retrieval tools:

- `portfolio_search_leases(companyId, filters)` — by region, expiration window, sqft range
- `portfolio_summarize_spend(companyId, region?, currency?)` — total spend with breakdown
- `portfolio_next_expirations(companyId, n)` — soonest expirations
- `portfolio_next_critical_dates(companyId, windowDays)` — upcoming notices
- `portfolio_query_locations(companyId, country?)` — locations matching criteria
- `portfolio_lease_lookup(leaseId)` — full detail for a specific lease

System prompt addendum tells Scout: when user is in portfolio scope, prefer portfolio tools; when in project scope, prefer existing RFP tools.

---

## 6. AI abstraction pipeline

### 6.1 Trigger
User uploads PDF via `/api/portfolio/leases/[id]/documents` (or from a "create lease from document" flow). Document is stored, then a background job is enqueued.

### 6.2 Extraction
- PDF → text + page-aware chunks (reuse existing pdf-parse utilities)
- LLM call with structured-output schema matching `lease_abstractions.extracted_fields` shape
- Confidence scoring per field (low confidence flagged for review)
- Result written to `lease_abstractions` with status `pending_review`

### 6.3 Review UI
User opens review screen, edits fields as needed, approves. On approval:
- If `lease_id` is null → create new `leases` + child rows
- If `lease_id` is set → update existing (with audit trail)
- Status → `approved`
- Document linked to the lease

### 6.4 Quality
- Track per-field accuracy over time (approved value vs. AI-proposed value)
- Use that to refine prompts / fine-tune
- Reject reasons feed a quality metrics dashboard

---

## 7. Multi-currency handling

**Storage:** Always native currency. Never convert at write.

**FX rates:** Daily snapshot from exchangerate.host (free, no key required), cached in `fx_rates` table. Background cron refreshes daily.

**Display rules:**
- Lease/Location detail pages: native currency only
- Dashboard summary cards: reporting currency with footnote ("Converted at FX rates as of [date]")
- Scout responses: reporting currency by default, can request native ("show me UK lease spend in GBP")

**Reporting currency:** Set per company in `company_settings`. Defaults to USD.

---

## 8. Pricing model

**Subscription:** $X per location per year, billed annually. Recommendation: $300/location/year as a starting price point.

**Reasoning:**
- Visual Lease, Leverton, MRI charge $400-$800/location/year for comparable lease admin
- TourLytics differentiator (Scout + integrated deal analysis) justifies mid-market positioning
- A 17-location portfolio = $5,100/year = enterprise-grade ARR with a reasonable check size

**What's included:**
- Unlimited users on the company
- Unlimited document storage
- AI abstractions included (X per location per year, e.g., 5)
- Scout queries included (rate limited per company)

**Overages (potential, v2):**
- Additional abstractions beyond included quota
- API access for ERP integration

**Sales motion:**
- 30-day free trial on a single location
- Pilot: 3 locations free for 60 days, then convert
- Annual contracts only in v1 (simpler billing, no churn surprises)

---

## 9. Phased rollout

### Phase 1 — Foundation (target: 2 weeks)
- [ ] Supabase schema + RLS policies in tourlytics-dev
- [ ] `/api/portfolio/companies` + `/api/portfolio/leases` CRUD
- [ ] `/portfolio` route shell, `/portfolio/leases`, `/portfolio/leases/[id]`
- [ ] Manual lease entry form (no AI yet)
- [ ] Manual location entry with geocoding via Mapbox API
- [ ] Document upload to Supabase Storage
- [ ] Basic list view (no map yet)

**Demo milestone:** Can manually enter AmeriLife's portfolio and view it in a list.

### Phase 2 — Map + Polish (target: 2 weeks)
- [ ] Mapbox GL JS integration with pin clustering
- [ ] Tooltip with 4 key metrics (straightline, OpEx, term, next notice)
- [ ] Full Location Detail tabs
- [ ] Critical Dates dashboard widget
- [ ] FX rates cron + multi-currency display
- [ ] Excel export of portfolio list

**Demo milestone:** Visual map demo for AmeriLife, looks like a real product.

### Phase 3 — AI Abstraction (target: 3 weeks)
- [ ] PDF upload → extraction pipeline
- [ ] Structured-output prompt with confidence scoring
- [ ] Side-by-side review UI
- [ ] Approve/reject flow with audit trail
- [ ] Quality metrics dashboard (internal)

**Demo milestone:** Upload a lease PDF, get a populated draft in under 60 seconds.

### Phase 4 — Portfolio Scout (target: 2 weeks)
- [ ] Portfolio retrieval tools (6 listed in §5.6)
- [ ] Scope-aware system prompt
- [ ] Multi-currency response handling
- [ ] Citation pattern (Scout cites which leases its numbers come from)

**Demo milestone:** "What's my next expiration in EMEA?" works correctly.

### Phase 5 — Billing + GTM (concurrent with Phase 3-4)
- [ ] Stripe integration for annual subscriptions
- [ ] Trial → paid conversion flow
- [ ] Pilot agreement template
- [ ] Marketing page at tourlytics.ai/portfolio

**Total time to GA:** ~9-10 weeks of focused build.

---

## 10. Open questions for v2+

These are intentionally out of scope for v1 but worth tracking:

- **CAM reconciliation workflow** — annual landlord reconciliations, audit support
- **Sublease/sublet tracking** — when tenant subleases part of premises
- **Capital projects tied to locations** — TI tracking, CAPEX amortization
- **Approval workflows** — multi-step sign-off for renewals or new leases
- **ERP integration** — push monthly accruals to NetSuite/QuickBooks
- **Mobile app** — site walks, photo uploads tied to locations
- **Broker collaboration** — invite outside broker (like Chris) into a specific renewal as a temporary collaborator
- **Tenant rep mode** — flip the tool so brokers can manage multiple client portfolios. Could be a separate SKU.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| AI extracts wrong notice date → tenant misses notice → legal liability | Human-in-the-loop required. UI prevents auto-publish. Disclaimer in ToS. |
| Multi-currency math bugs in reporting | Unit tests on FX conversion. Always display native currency alongside reporting. |
| Schema bloat as we discover edge cases | JSONB for flexible fields where appropriate (e.g., `burndown_schedule`), structured columns for queryable core data. |
| Geocoding costs (Mapbox) | Cache results; geocode only on address change. Mapbox free tier covers ~50k requests/month. |
| Storage costs (PDFs) | Supabase Storage scales fine for our volume. Set per-company quota at 5GB to start. |
| AmeriLife says "this is great but I need feature X" before launch | Keep Phase 3-4 modular so we can swap priorities. v1 doesn't have to be perfect, has to be useful. |

---

## 12. Success metrics

**Phase 1-2 (build phase):**
- AmeriLife portfolio fully entered manually within 2 weeks of Phase 2 demo
- Map loads in <2s with 50+ pins

**Phase 3 (AI launch):**
- 80% of AI-extracted material terms approved without edits
- <60s extraction time per lease document
- Average review time per lease < 5 minutes

**Phase 4+ (GA):**
- 5 paying companies within 90 days of GA
- $100k ARR by end of 2026
- Scout portfolio queries answered correctly 90%+ of the time (internal eval set)

---

## 13. Recommended decisions still needed

1. **Mapbox vs Google Maps** — Mapbox has better dev experience and lower cost at our scale; Google has slightly better geocoding accuracy. Recommendation: **Mapbox**.
2. **PDF viewer library** — react-pdf vs PDF.js direct vs Adobe Embed. Recommendation: **react-pdf** (lightweight, no external deps).
3. **AI model for extraction** — recommend starting with Claude Sonnet 4.6 for structured extraction (strong JSON output, large context for full lease PDFs). Reevaluate after Phase 3.
4. **Stripe vs manual invoicing for v1** — manual invoicing for first 5 customers (faster ship, learn pricing); Stripe by Phase 5.
5. **Trial gating** — credit card required up front or not? Recommendation: **not** for AmeriLife and warm intros; gate when we open self-serve signup.

---

*End of spec. Next deliverable: SQL migration scaffolding (separate file).*
