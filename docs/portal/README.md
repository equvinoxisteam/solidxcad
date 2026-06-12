# SolidX CAD Portal — Planning Hub

Browser-native AI CAD platform built on the **text-to-cad** skills workbench.

| Doc | Purpose |
|-----|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, services, data flow, deployment |
| [ROADMAP.md](./ROADMAP.md) | Phased build plan, sprint checklist, credit model |
| [FEATURES.md](./FEATURES.md) | CadX Studio parity matrix vs what we already have |
| [UI-DESIGN.md](./UI-DESIGN.md) | Dark VS Code–style layout, screens, component map |
| [ENV.example](./ENV.example) | Environment variable template (no secrets) |

## Product

| Item | Value |
|------|-------|
| **Name** | SolidX CAD |
| **Marketing URL** | `https://solidxcad.equvinoxis.com` |
| **API URL** | `https://api.solidxcad.equvinoxis.com` |
| **Positioning** | AI design engine in the browser — prompt → STEP → slice → print |

## What We Already Have (Repo Assets)

This repo is **not** a SaaS today. It is a **skills workbench** with:

- **10 agent skills** — CAD, implicit CAD, viewer, step.parts, URDF/SRDF/SDF, gcode, Bambu, SendCutSend
- **CAD Viewer** — full React workbench (`viewer/`) with STEP/GLB/G-code/URDF preview
- **Shared packages** — `cadjs`, `implicitjs`, `cadpy` (render, export, topology)
- **step.parts** — nested catalog + external API for off-the-shelf STEP parts
- **No multi-tenant backend** — skills run locally via agents/CLI

The portal **wraps** these capabilities in a hosted product layer: auth, credits, job queue, S3 storage, Stripe billing, and an OpenRouter-driven agent orchestrator.

## Quick Start for Builders

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) for service boundaries.
2. Follow [ROADMAP.md](./ROADMAP.md) Phase 0 → Phase 1 for MVP.
3. Copy [ENV.example](./ENV.example) to `.env` locally — **never commit real keys**.
4. New app code should live in a **sibling monorepo folder** `apps/solidxcad/` (recommended) or a new repo `solidxcad-portal` that vendors this repo as a submodule.

## Security Notice

If credentials were ever pasted in chat, issue, or commit history:

1. **Rotate immediately**: MongoDB password, JWT secret, AWS keys, Razorpay, Gmail OAuth, admin password.
2. Store secrets only in deployment env (Railway, Vercel, AWS Secrets Manager) — not in git.
3. Use Stripe (not Razorpay) for USD pricing as specified; keep Razorpay keys out of this product unless you add INR later.
