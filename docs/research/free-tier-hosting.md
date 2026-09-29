# Research: free-tier hosting for a small personal web app

Ticket: [#9](https://github.com/WareveR/Claude_test/issues/9) · Researched: 2026-09-29

**Question.** Which hosting options can run a small personal web app (web front end, server-side logic, authentication for a single account, a small relational or document database) at zero or near-zero monthly cost? For each: current free-tier limits, sleep/cold-start and inactivity behaviour, lock-in, and the first paid tier.

**Workload assumed.** One Family account, a few thousand calendar entries, a handful of devices, users in Portugal/EU. At this size every option below fits well inside its free quotas. What matters is **inactivity rules, hard caps, and what happens when a cap is hit.**

**This document gives facts only. It does not recommend an option;** that is a separate decision ticket.

> **How these facts were gathered.** The sandbox's network policy blocked direct page fetches to every provider domain. Each fact below therefore comes from web-search extracts limited to the provider's own domain (for example `allowed_domains: supabase.com`). All were read on 2026-09-29, and the cited URL is the official page the extract came from. Treat each figure as "stated by the provider's page as indexed on 2026-09-29". Re-check the pricing pages before you commit, because several providers changed plans in 2025–2026. Anything I could not confirm is marked **unconfirmed**.

## Comparison table

| Option | Front end + server logic (free) | DB (free) | Auth built in | Inactivity / sleep gotcha | Hard-cap behaviour | First paid tier |
|---|---|---|---|---|---|---|
| **Vercel** (Hobby) | Yes: 1M function invocations, 100 GB transfer | None native; Marketplace (Neon/Supabase/Upstash) | No | None found for Hobby itself | Hobby is **paused** when over limits; wait 30 days | Pro: platform fee with $20 usage credit, $20/month per extra seat |
| **Netlify** (Free) | Yes: 300 credits/month | Netlify Database (Postgres) included | Netlify Identity (kept, Feb 2026) | None found | Projects **pause** until next cycle when credits run out | Personal $9/month (1,000 credits) |
| **Cloudflare** Workers/Pages + D1 | Yes: 100k Worker req/day, static assets unlimited | D1: 5 GB total, 500 MB per DB, 10 DBs | No (Access free ≤50 users can gate an app) | No inactivity pausing found | D1 queries **fail** once the daily row limit is hit (enforced since 2026-09-01) | Workers Paid $5/month minimum |
| **Supabase** (Free) | Partial: Edge Functions and auto REST API; front end hosted elsewhere | Postgres 500 MB | Yes (50k MAU) | **Paused after 1 week of inactivity** | n/a | Pro $25/month (+$10 compute credit) |
| **Firebase** (Spark) | Static hosting only; **Functions/App Hosting need Blaze** | Firestore: 1 GiB, 50k reads / 20k writes per day | Yes | None found | App **shut off for rest of month** if Spark limits exceeded | Blaze pay-as-you-go (keeps the free quota) |
| **Neon** (Free) | DB only | Postgres 0.5 GB per project, 100 CU-h/month | No | Compute scales to zero after 5 min; inactive branches archived | Compute suspended until next period | Launch: usage-based, no minimum |
| **Turso** (Free) | DB only | 5 GB, 500M rows read, 10M rows written/month | No | DBs **archived after 10 days of inactivity** (per blog, may be outdated) | Unconfirmed | Developer $4.99/month |
| **Fly.io** | **No usable free tier** for new accounts (trial only) | – | No | – | – | Pay-as-you-go; shared-cpu-1x 256 MB ≈ $1.94–2.32/month |
| **Render** (Free) | Yes: 750 instance-h/month | Postgres 1 GB, **expires 30 days after creation** | No | Web service spins down after 15 min (cold start) | DB deleted 14 days after expiry unless upgraded | Starter web service $7/month; smallest Postgres ≈ $13/month |
| **Railway** (Free) | Yes, within $1/month of credit | Any container DB, within the same credit | No | Optional "serverless" sleep after ~10 min without outbound traffic | Unconfirmed | Hobby $5/month (includes $5 usage) |
| **Oracle Cloud** Always Free | Yes (full VMs) | 2× Autonomous DB, 20 GB each, or self-run DB on the VM | No | **Idle VMs reclaimed**; ADB **stopped after 7 days**, **deleted after 90 days** stopped | – | Pay As You Go upgrade (rates not captured) |
| **Self-hosting** (home server/NAS) | Yes | Anything | Whatever you run | None from a provider; depends on your uptime | Your hardware/ISP | Hardware + electricity; tunnels free |

## Vercel (Hobby)

- Hobby is free and limited to **non-commercial, personal use**. Included usage: first 100 GB Fast Data Transfer, 1,000,000 function invocations, 1,000,000 edge requests, 4 CPU-hrs Active CPU, 360 GB-hrs provisioned memory. — https://vercel.com/docs/plans/hobby (read 2026-09-29)
- Function max duration 300 s; 100 deployments per day. — https://vercel.com/docs/limits (read 2026-09-29)
- **Over the limit:** "you will have to wait until 30 days have passed before you can use the feature again". Hobby accounts cannot buy extra usage, and Hobby plans are paused when they exceed the included usage. — https://vercel.com/docs/plans/hobby ; https://vercel.com/pricing (read 2026-09-29)
- **Database:** Vercel has no first-party database. Postgres (Neon, Supabase, AWS Aurora) and Redis (Upstash) come through the Marketplace on all plans, "start for free", at the same price as going direct. Those providers' own free-tier rules then apply (see Neon and Supabase below). — https://vercel.com/docs/marketplace-storage (read 2026-09-29)
- **Auth:** no built-in auth product found.
- **First paid tier:** Pro has a fixed platform fee that includes **$20 of usage credit** and one paid seat. Extra deploying seats cost $20/month each. — https://vercel.com/docs/plans/pro-plan ; https://vercel.com/pricing (read 2026-09-29). The exact Pro platform fee was **unconfirmed** in the extracts.
- **Lock-in:** moderate. Standard frameworks (e.g. Next.js) run elsewhere, but Vercel-specific features (edge config, image optimisation, Marketplace wiring) need replacing.

## Netlify (Free)

- Credit-based plans: **Free = 300 credits/month**. The Free plan has hard limits that cannot be exceeded or charged. **When credits run out, projects pause until the next billing cycle.** — https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/ ; https://www.netlify.com/pricing/ (read 2026-09-29)
- Credit rates: production deploy **15 credits** each (so ~20 deploys/month would use the whole Free allowance by themselves); compute 10 credits/GB-hour; bandwidth 20 credits/GB; web requests 2 credits per 10k. — https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/ (read 2026-09-29)
- **Database:** Netlify Database (managed Postgres) became generally available on 2026-04-28 and is included on the Free plan. Storage was free until 2026-07-01, with billing announced for no earlier than that date at rates "to be announced". The current storage rate was **unconfirmed**. The earlier beta (Neon-backed, deleted after 7 days unless claimed) was closed to new databases on 2026-04-13. — https://docs.netlify.com/build/data-and-storage/netlify-database/billing-and-usage/ ; https://www.netlify.com/changelog/2026-04-28-netlify-database/ ; https://www.netlify.com/changelog/2026-04-13-netlify-db-ga-coming-soon/ (read 2026-09-29)
- **Auth:** Netlify Identity was announced as discontinued, then kept. As of 2026-02-19 it is supported and included on all credit-based plans at no extra cost. — https://www.netlify.com/blog/auth0-extension-identity-changes/ ; https://docs.netlify.com/manage/security/secure-access-to-sites/identity/plans-and-pricing/ (read 2026-09-29)
- **First paid tier:** Personal **$9/month for 1,000 credits**, with optional auto-recharge (500 credits for $5). — https://www.netlify.com/pricing/ (read 2026-09-29)
- **Lock-in:** moderate to high if you use Netlify Identity, Netlify Database and Functions together.

## Cloudflare (Pages / Workers + D1)

- Workers Free: **100,000 requests/day** (resets 00:00 UTC) and **10 ms CPU per invocation**. Waiting on network or database I/O does not count as CPU time. — https://developers.cloudflare.com/workers/platform/pricing/ ; https://developers.cloudflare.com/workers/platform/limits/ (read 2026-09-29)
- Requests for static assets are free and unlimited on both Free and Paid. — https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/ ; https://developers.cloudflare.com/pages/functions/pricing/ (read 2026-09-29)
- **D1 Free:** 5 million rows read/day, 100,000 rows written/day, 5 GB total storage. Limits reset at 00:00 UTC. — https://developers.cloudflare.com/d1/platform/pricing/ (read 2026-09-29)
- D1 Free: **500 MB per database**, up to **10 databases** per account. — https://developers.cloudflare.com/d1/platform/limits/ (read 2026-09-29)
- **Enforcement change:** since **2026-09-01**, D1 queries on Workers Free fail with errors once the account exceeds the daily read or write limit, until midnight UTC. At full storage you must delete data before inserting more. — https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/ (read 2026-09-29)
- No inactivity pausing or deletion rule found for Workers, Pages or D1.
- **Auth:** no built-in end-user auth. Cloudflare Zero Trust (Access) is free for up to 50 users and can put a login in front of an app. — https://www.cloudflare.com/plans/zero-trust-services/ (read 2026-09-29)
- **First paid tier:** Workers Paid, **$5/month minimum** per account; it covers Workers, Pages Functions, KV, Hyperdrive and Durable Objects. D1 on Paid includes 25 billion rows read and 50 million rows written per month. — https://developers.cloudflare.com/workers/platform/pricing/ ; https://developers.cloudflare.com/d1/platform/pricing/ (read 2026-09-29). Paid-plan included requests and CPU-ms were **unconfirmed**.
- **Lock-in:** high. The Workers runtime and D1 bindings are Cloudflare-specific, though D1 is SQLite so the data is portable.

## Supabase (Free)

- Free plan: unlimited API requests, **50,000 monthly active users (Auth)**, **500 MB database** (shared CPU, 500 MB RAM), 5 GB egress, 5 GB cached egress, 1 GB file storage. **Two free projects.** — https://supabase.com/pricing (read 2026-09-29)
- **Inactivity:** "Free projects are paused after 1 week of inactivity". A few user requests to the database each day is typically enough to prevent it. Paid projects are never paused for inactivity. Paused projects can be restored from Studio within a **1-year window**. — https://supabase.com/docs/guides/platform/free-project-pausing (read 2026-09-29)
- Edge Functions: $2 per 1M invocations beyond the plan quota. The Free-plan invocation quota was **unconfirmed**. — https://supabase.com/docs/guides/functions/pricing (read 2026-09-29)
- Supabase does not host a web front end; that has to live elsewhere (any static host).
- **First paid tier:** Pro **$25/month**, including **$10/month compute credits** (covers one Micro instance). — https://supabase.com/pricing ; https://supabase.com/docs/guides/platform/billing-on-supabase (read 2026-09-29)
- **Lock-in:** low to moderate. It is standard Postgres (pg_dump works); Auth and row-level-security policies are Supabase-flavoured.

## Firebase (Spark)

- Spark is the no-cost plan. **If you exceed Spark resources in a calendar month, your app is shut off for the rest of that month.** — https://firebase.google.com/docs/projects/billing/firebase-pricing-plans (read 2026-09-29)
- **Cloud Functions, Cloud Storage for Firebase, and App Hosting require the Blaze (pay-as-you-go) plan.** On Spark the only server-side logic is Firestore Security Rules. — https://firebase.google.com/docs/projects/billing/firebase-pricing-plans ; https://firebase.google.com/docs/app-hosting/costs ; https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024 (read 2026-09-29)
- Hosting (static) on Spark: 10 GB storage, 360 MB/day transfer, custom domain and SSL included. — https://firebase.google.com/docs/hosting/usage-quotas-pricing (read 2026-09-29)
- Firestore free quota: 50,000 document reads, 20,000 writes, 20,000 deletes per day, 1 GiB stored. Applies to one database per project and resets around midnight Pacific time. — https://firebase.google.com/docs/firestore/quotas ; https://cloud.google.com/firestore/pricing (read 2026-09-29)
- **Auth:** Firebase Authentication is included. If upgraded to Identity Platform, Spark projects are capped at 3,000 daily active users; Blaze includes 50,000 MAU at no cost. — https://firebase.google.com/docs/auth/limits (read 2026-09-29)
- No inactivity-pausing rule for Spark projects was found.
- **First paid tier:** Blaze, pay-as-you-go with the same no-cost quotas. Beyond them, Hosting storage costs $0.026/GB and transfer $0.15/GB. Blaze needs a Cloud Billing account (credit card). — https://firebase.google.com/docs/hosting/usage-quotas-pricing (read 2026-09-29)
- **Lock-in:** high. Firestore's data model, Security Rules and the client SDKs are proprietary.

## Neon (Free, database only)

- Free: $0; 100 projects; **100 CU-hours compute per project per month**; **0.5 GB storage per project**; 5 GB public transfer per project per month. — https://neon.com/pricing ; https://neon.com/docs/introduction/plans (read 2026-09-29)
- **Scale to zero after 5 minutes of inactivity**, always on and not disableable on Free, so the first query after idle hits a cold start. When CU-hours or transfer run out, **compute is suspended until the next billing period**. Inactive branches are archived automatically and unarchived on access. Neon states that none of these limits delete data. — https://neon.com/faqs/free-plan-limits-and-quotas ; https://neon.com/docs/guides/branch-archiving (read 2026-09-29)
- **First paid tier:** Launch, **no monthly minimum**, $0.106 per CU-hour and $0.35 per GB-month; allows disabling scale to zero. — https://neon.com/pricing (read 2026-09-29)
- **Lock-in:** low (plain Postgres).

## Turso (Free, database only)

- Free: 100 databases, 5 GB storage, 500 million rows read/month, 10 million rows written/month. — https://turso.tech/pricing (read 2026-09-29)
- Inactivity: a Turso blog post states that free-plan databases are **archived after 10 days of inactivity**. The same material says cold starts were removed for Free from 2025-03-31. Whether archiving still applies today is **unconfirmed** from a current pricing or docs page. — https://turso.tech/blog/turso-cloud-debuts-the-new-developer-plan ; https://docs.turso.tech/api-reference/groups/unarchive (read 2026-09-29)
- **First paid tier:** Developer **$4.99/month** (2.5B rows read/month). Overage is $0.75/GB storage, $1 per billion rows read, and $1 per million rows written. — https://turso.tech/pricing (read 2026-09-29)
- **Lock-in:** low (SQLite/libSQL, exportable).

## Fly.io (no usable free tier)

- **No usable free tier for new accounts.** Plans with free allowances (Hobby) were discontinued on 2024-10-07 and are honoured only for existing "Legacy Hobby" users. New organisations get a trial ("2 hours of machine runtime or 7 days of access, whichever comes first"), then Pay As You Go with **no free allowances**. — https://fly.io/docs/about/discontinued-plans/ ; https://fly.io/docs/about/free-trial/ (read 2026-09-29)
- Near-zero paid reference: shared-cpu-1x with 256 MB is about **$1.94–$2.32/month** depending on region; volumes cost $0.15/GB-month. — https://fly.io/docs/about/pricing/ (read 2026-09-29)

## Render (Free)

- Each workspace gets **750 free instance hours per month**. Free web services **spin down after 15 minutes of inactivity** and spin up on the next request, so there is a cold start. — https://render.com/docs/free (read 2026-09-29)
- **Free Postgres: 1 GB, expires 30 days after creation.** After expiry there is a 14-day grace period to upgrade; then **Render deletes the database and all its data**. — https://render.com/docs/free ; https://render.com/changelog/free-postgresql-instances-now-expire-after-30-days-previously-90 (read 2026-09-29)
- **First paid tier:** Starter web service **$7/month**. — https://render.com/pricing (read 2026-09-29). The smallest paid Postgres (basic-256mb) is "about $13/month" plus storage at $0.30/GB-month, according to a first-party Render article rather than the pricing table. — https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses ; https://render.com/docs/postgresql-refresh (read 2026-09-29)
- **Auth:** none built in. **Lock-in:** low (containers, standard Postgres).

## Railway (Free)

- Trial: one-time $5 credit valid 30 days (1 GB RAM, shared vCPU, 5 services per project). Afterwards the account moves to the **Free plan with $1 of credit per month** (no rollover). — https://docs.railway.com/pricing/free-trial ; https://docs.railway.com/pricing/plans (read 2026-09-29)
- Free-plan RAM, CPU and volume caps were **unconfirmed** from official docs. Whether an always-on app plus database fits in $1/month is also **unconfirmed**.
- Optional "Serverless" (app sleeping): a service sleeps after ~5–10 minutes without **outbound** traffic. An open DB connection keeps it awake. It wakes on the next request. — https://docs.railway.com/reference/app-sleeping (read 2026-09-29)
- **First paid tier:** Hobby **$5/month**, which includes $5 of usage. Usage above $5 is billed. — https://docs.railway.com/pricing/plans (read 2026-09-29)
- **Auth:** none built in. **Lock-in:** low (containers).

## Oracle Cloud (Always Free)

- Compute: two AMD `VM.Standard.E2.1.Micro` VMs, plus Arm A1 at 1,500 OCPU-hours and 9,000 GB-hours/month. For Always Free tenancies that equals **2 OCPUs and 12 GB RAM**. Oracle reduced this from the earlier 3,000/18,000 (4 OCPU/24 GB) in an update announced 2026-07-21; paid tenancies still get 3,000/18,000. A1 is available only in the tenancy's home region. — https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm ; https://community.oracle.com/customerconnect/discussion/970310/oci-always-free-updated-ampere-a1-compute-allocation (read 2026-09-29)
- Also free: 200 GB block storage, 10 GB object storage, **10 TB/month outbound data**. — https://www.oracle.com/cloud/free/ (read 2026-09-29)
- **Idle reclamation:** Always Free VMs may be reclaimed if over 7 days the 95th-percentile CPU utilisation is below 20% (plus network and memory conditions on the same page). **Accounts idle for 30+ days** may be deemed abandoned and suspended or terminated. — https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm ; https://www.oracle.com/cloud/free/faq/ (read 2026-09-29)
- **Always Free Autonomous Database:** max 2 per tenancy, 20 GB each. **Automatically stopped after 7 days of inactivity**, and **may be permanently deleted after 90 cumulative days stopped or inactive**. A successful SQL connection resets the clock. — https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/autonomous-always-free.html (read 2026-09-29)
- **First paid tier:** upgrade to Pay As You Go, which bills only resources beyond Always Free. Whether upgrading exempts VMs from idle reclamation was **unconfirmed**. — https://www.oracle.com/cloud/free/faq/ (read 2026-09-29)
- **Auth:** none built in (you run your own). **Lock-in:** low for plain VMs; high for Autonomous Database (Oracle SQL).

## Self-hosting (home server / NAS) — baseline

- No provider quotas, sleep or inactivity rules. Limits are your hardware, home uplink and uptime. Monthly cost is electricity plus amortised hardware. Portuguese electricity tariffs were **not researched** here.
- **Exposing it without opening inbound ports:**
  - **Cloudflare Tunnel.** `cloudflared` makes outbound-only connections to Cloudflare, so there are no inbound ports or firewall changes and no public IP is needed. It is free, with up to 1,000 tunnels on the Zero Trust free plan, and Cloudflare Access (free up to 50 users) can add a login in front. It requires a domain on Cloudflare DNS; Quick Tunnels without an account are for testing only. — https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/ ; https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/ ; https://www.cloudflare.com/plans/zero-trust-services/ (read 2026-09-29)
  - **Tailscale.** The Personal plan is free for up to 6 users with unlimited devices, so family devices can reach the server privately. **Funnel** can expose a local port on a public HTTPS URL without port forwarding, DNS or a public IP; it is off by default and double opt-in. — https://tailscale.com/pricing ; https://tailscale.com/docs/features/tailscale-funnel (read 2026-09-29)
  - Classic port forwarding plus dynamic DNS also works if the ISP gives a reachable public IPv4 address. No primary source on Portuguese ISPs' CGNAT practices was checked.
- **Lock-in:** none, but you own backups, TLS, OS and security updates, and power/ISP outages.

## Caveats

- **Verification method.** Direct page fetches were blocked by the sandbox egress policy. Every figure comes from official-domain search extracts dated 2026-09-29. Before the decision ticket relies on a number, open the cited page to confirm it, especially the items marked **unconfirmed** (Vercel Pro fee, Cloudflare Paid included usage, Supabase Edge Function quota, Netlify DB storage rate, Railway Free caps, current Turso archiving).
- **Inactivity is the main risk for a low-traffic family app.** The relevant rules are Supabase (pause after 1 week), Oracle ADB (stop after 7 days, delete after 90), Oracle idle VMs and 30-day-idle accounts, Render free Postgres (deleted about 44 days after creation regardless of activity), Turso (archive after 10 days, possibly outdated), and Neon (scale to zero after 5 min; data kept).
- **Hard caps stop the app instead of billing.** Vercel Hobby pauses for up to 30 days; Netlify Free pauses until the next cycle; Firebase Spark shuts off for the rest of the month; Cloudflare D1 errors until midnight UTC. At this app's volume these caps are unlikely to be hit, but a bug such as a polling loop could hit them.
- **Cold starts** apply to Render free web services (15 min idle), Neon compute (5 min idle) and Railway serverless mode.
- **Terms of use.** Vercel Hobby is restricted to personal, non-commercial use, which the stated use case matches.
- **Churn.** Fly.io, Netlify (credit-based plans, DB GA), Oracle (A1 cut in July 2026), Cloudflare D1 (enforcement from 2026-09-01) and Render (Postgres expiry cut from 90 to 30 days) all changed free-tier terms recently. Expect further changes.
- **EU data location** was not researched per provider (region choice on free tiers); it may matter for a Portugal-based family.
