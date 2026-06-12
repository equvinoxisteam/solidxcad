# SolidX CAD — Implementation Roadmap

Phased plan from **zero portal** to **CadX-class MVP**, using existing text-to-cad assets.

**Estimates:** 1 developer ≈ calendar weeks shown. Parallel team shrinks wall time.

---

## Credit & Plan Model (v1)

| Plan | Price | Credits | Projects | Notes |
|------|-------|---------|----------|-------|
| Free | $0 | **100** on signup | 3 | No monthly refresh in v1 |
| Pro | **$20/mo** | TBD (e.g. 500/mo) | Unlimited | Stripe subscription |

### Credit costs (initial — tune after telemetry)

| Action | Credits |
|--------|---------|
| AI chat message (no tool) | 1 |
| Text → STEP generation | 10 |
| Implicit model generation | 8 |
| STEP inspect / measure | 3 |
| step.parts search | 1 |
| step.parts download | 2 |
| Slice to G-code | 15 |
| STL/3MF export | 2 |
| URDF generation | 12 |
| SendCutSend preflight | 5 |

---

## Phase 0 — Foundation (Week 1–2)

**Goal:** Deployable shell with auth, billing skeleton, dark UI.

### Tasks

- [ ] **P0.1** Create `apps/solidxcad-web` — Next.js 15, TypeScript, Tailwind, shadcn/ui
- [ ] **P0.2** Implement VS Code dark design tokens — [UI-DESIGN.md](./UI-DESIGN.md)
- [ ] **P0.3** Create `apps/solidxcad-api` — Express or Next route handlers
- [ ] **P0.4** MongoDB schema: users, projects, credit_transactions, jobs
- [ ] **P0.5** Auth: register, login, JWT, refresh, password reset email (Gmail API)
- [ ] **P0.6** Admin seed user from env `ADMIN_EMAIL` / `ADMIN_PASSWORD` (hashed)
- [ ] **P0.7** Stripe: products, Free + Pro prices, Checkout, Customer Portal
- [ ] **P0.8** Stripe webhooks: subscription lifecycle + credit grants
- [ ] **P0.9** Credit middleware: check balance before job, atomic debit
- [ ] **P0.10** S3 upload helper (presigned PUT for user uploads)
- [ ] **P0.11** DNS: `solidxcad.equvinoxis.com`, `api.solidxcad.equvinoxis.com`
- [ ] **P0.12** `ENV.example` wired; secrets in Railway/Vercel only
- [ ] **P0.13** Landing page: hero, features, pricing (Free 100 / Pro $20)

**Exit criteria:** User can sign up, see 100 credits, upgrade to Pro via Stripe test mode.

---

## Phase 1 — MVP Design Studio (Week 3–5)

**Goal:** User asks for CAD → gets STEP in viewer. Core product loop.

### Tasks

- [ ] **P1.1** Dashboard: project list, create/delete project, credit balance badge
- [ ] **P1.2** Project detail: file tree, job history, empty viewer pane
- [ ] **P1.3** Redis + BullMQ job queue
- [ ] **P1.4** CAD worker Docker image (Python 3.11 + build123d + cadpy bundle)
- [ ] **P1.5** OpenRouter integration — streaming chat endpoint
- [ ] **P1.6** Agent orchestrator with tool: `generate_step`
- [ ] **P1.7** Worker: run cad skill pipeline, upload `.step` + `.glb` sidecar to S3
- [ ] **P1.8** Cloud viewer integration (Option A iframe or Option B embedded workbench)
- [ ] **P1.9** `GET /api/projects/:id/catalog` for viewer `?dir=`
- [ ] **P1.10** AI chat panel in studio (left sidebar) with job progress toasts
- [ ] **P1.11** Export buttons: download STEP, STL (cadpy worker job)
- [ ] **P1.12** Error handling: insufficient credits, job failed, retry

**Exit criteria:** End-to-end demo: prompt → STEP appears in 3D viewer → download STEP.

---

## Phase 2 — Manufacturing & Parts (Week 6–8)

**Goal:** Slice, parts library, implicit CAD — differentiation vs basic text-to-mesh tools.

### Tasks

- [ ] **P2.1** Slice worker: OrcaSlicer/PrusaSlicer in Docker
- [ ] **P2.2** Slicer UI: printer profile, layer height, infill → job → G-code
- [ ] **P2.3** G-code preview in viewer (reuse `cadjs` toolpath mesh)
- [ ] **P2.4** step.parts integration: search UI + download into project
- [ ] **P2.5** Agent tools: `search_parts`, `download_part`, `slice_gcode`
- [ ] **P2.6** Implicit CAD: generate `.implicit.js`, browser preview via `implicitjs`
- [ ] **P2.7** Implicit export job: STL/3MF/GLB to S3
- [ ] **P2.8** SendCutSend preflight (DXF/STEP) — optional panel for sheet metal users
- [ ] **P2.9** File upload: import existing STEP/STL into project
- [ ] **P2.10** Thumbnails: snapshot PNG via cad skill snapshot script

**Exit criteria:** User slices a model to G-code and previews toolpath; inserts a step.parts fastener.

---

## Phase 3 — Robotics & Collaboration (Week 9–12)

**Goal:** URDF/SRDF/SDF workflows + light collaboration.

### Tasks

- [ ] **P3.1** URDF/SRDF/SDF generation jobs via skills
- [ ] **P3.2** Robot viewer mode in workbench (existing viewer URDF support)
- [ ] **P3.3** Project versions: save named revisions (S3 copy + MongoDB metadata)
- [ ] **P3.4** Share link: read-only project view for collaborators
- [ ] **P3.5** Activity feed per project
- [ ] **P3.6** Email notifications: job complete, low credits
- [ ] **P3.7** Bambu Labs handoff docs (user runs locally; portal exports validated gcode)

**Exit criteria:** Robot arm prompt → URDF in viewer; share read-only link.

---

## Phase 4 — Polish & Growth (Week 13+)

- [ ] **P4.1** Pro credit monthly refresh automation
- [ ] **P4.2** Usage analytics dashboard (admin)
- [ ] **P4.3** OpenRouter model selector in settings (fast vs quality)
- [ ] **P4.4** Template gallery (bracket, enclosure, phone stand)
- [ ] **P4.5** Google OAuth sign-in
- [ ] **P4.6** API keys for developers (optional)
- [ ] **P4.7** Real-time co-editing (Yjs) — if product validation warrants
- [ ] **P4.8** In-browser parametric editor — long-term R&D only

---

## Sprint 0 Checklist (Start This Week)

| # | Task | Owner | Done |
|---|------|-------|------|
| 1 | Rotate all exposed secrets | Ops | ☐ |
| 2 | Create Stripe account products (Free/Pro) | Biz | ☐ |
| 3 | Register DNS `solidxcad.equvinoxis.com` | Ops | ☐ |
| 4 | New MongoDB database `solidxcad` on Atlas | Ops | ☐ |
| 5 | Scaffold `apps/solidxcad-web` | Dev | ☐ |
| 6 | Scaffold `apps/solidxcad-api` | Dev | ☐ |
| 7 | Copy ENV.example → Railway/Vercel | Ops | ☐ |
| 8 | OpenRouter account + API key | Dev | ☐ |
| 9 | Proof: local cad skill generates STEP | Dev | ☐ |
| 10 | Proof: viewer opens `models/` STEP locally | Dev | ☐ |

---

## Tech Stack Summary

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Next.js 15 + React 19 | SSR marketing, app routes, API routes option |
| UI | shadcn/ui + Tailwind | Fast dark theme, accessible |
| API | Node 20 + Express or Hono | Matches viewer stack |
| Queue | BullMQ + Redis | Job status, retries |
| DB | MongoDB Atlas | You already use it |
| Files | S3 + CloudFront | You already use it |
| AI | OpenRouter | Multi-model, one key |
| CAD runtime | Python build123d (cad skill) | Already in repo |
| 3D | cadjs + implicitjs + viewer | Already in repo |
| Pay | Stripe | USD $20/mo spec |
| Email | Gmail API | You already use it |
| Deploy | Railway (API/workers) + Vercel (web) | Or all Railway |

---

## Risk Register

| Risk | Mitigation |
|------|------------|
| Slicer headless in Docker | Spike in week 6; fallback: export STL + "download for local slice" |
| CAD worker cold start / OCP size | Large image (~2GB); keep min 1 warm instance |
| OpenRouter cost > revenue | Credit costs + use haiku for routing |
| CadX parity pressure | Ship skills-based MVP first; editor later |
| Secret leak | Rotate, never commit, use secret manager |

---

## Definition of Done — v1 Launch

1. Sign up → 100 credits
2. Create project → chat "design a motor mount" → STEP in viewer &lt; 3 min p95
3. Slice → G-code preview
4. Search step.parts → insert screw
5. Upgrade to Pro $20 via Stripe
6. Dark VS Code UI on desktop Chrome
7. Privacy policy + terms + support email
