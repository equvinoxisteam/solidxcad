# SolidX CAD — Feature Matrix

Comparison of [CadX Studio](https://cadxstudio.in/) vs **what we have today** vs **SolidX v1 target**.

Legend: ✅ Have now · 🔨 Build for portal · 🔮 Future · ❌ Not planned v1

---

## AI & Generation

| Feature | CadX | Repo today | SolidX v1 |
|---------|------|------------|-----------|
| Text-to-CAD | ✅ | ✅ `skills/cad` | 🔨 Orchestrator + worker |
| Image-to-CAD | ✅ (marketing) | ✅ cad skill supports images | 🔨 Phase 1 |
| Implicit / SDF CAD | ❌ | ✅ `skills/implicit-cad` | 🔨 Phase 2 — **differentiator** |
| Agentic multi-step design | ✅ | ✅ agent skills locally | 🔨 OpenRouter tools |
| AI model tiers | ✅ | ❌ | 🔨 fast vs CAD model via OpenRouter |
| Engineering intent chat | ✅ | Partial in SKILL.md | 🔨 Chat UI + credits |

---

## CAD Workbench

| Feature | CadX | Repo today | SolidX v1 |
|---------|------|------------|-----------|
| Browser 3D viewer | ✅ | ✅ `viewer/` + `cadjs` | 🔨 Embed viewer |
| STEP B-Rep viewing | ✅ | ✅ GLB sidecar + topology | 🔨 S3-backed |
| Face/edge picking | ✅ | ✅ viewer | 🔨 Port cloud backend |
| Parametric feature tree editor | ✅ | ❌ | 🔮 Phase 4+ |
| Sketch / extrude manual UI | ✅ | ❌ | 🔮 Not v1 |
| Live dimension tweaks | ✅ | Partial via regenerate | 🔨 "edit via chat" v1 |
| Assembly multi-part | ✅ | ✅ cad assemblies | 🔨 Phase 1–2 |
| Mass properties panel | ✅ | ✅ inspect skill | 🔨 Phase 1 sidebar |
| AR preview | ✅ | ❌ | 🔮 |

---

## Parts & Libraries

| Feature | CadX | Repo today | SolidX v1 |
|---------|------|------------|-----------|
| Off-the-shelf parts catalog | ❌ | ✅ `step.parts` + skill | 🔨 Phase 2 — **differentiator** |
| Fasteners, bearings, motors | ❌ | ✅ api.step.parts | 🔨 Parts browser panel |

---

## Manufacturing

| Feature | CadX | Repo today | SolidX v1 |
|---------|------|------------|-----------|
| STL export | ✅ | ✅ cadpy | 🔨 Phase 1 |
| STEP export | ✅ | ✅ native | 🔨 Phase 1 |
| IGES export | ✅ | ❌ | 🔮 |
| 3MF export | Partial | ✅ | 🔨 Phase 2 |
| G-code slicing | ✅ (roadmap) | ✅ `skills/gcode` | 🔨 Phase 2 — **differentiator** |
| G-code toolpath preview | Partial | ✅ viewer + cadjs | 🔨 Phase 2 |
| Bambu print handoff | ❌ | ✅ `skills/bambu-labs` | 🔨 Docs + download gcode |
| Sheet metal / laser preflight | ❌ | ✅ `skills/sendcutsend` | 🔨 Phase 2 optional |
| DFM / stress analysis | ✅ (marketing) | ❌ | 🔮 |

---

## Robotics

| Feature | CadX | Repo today | SolidX v1 |
|---------|------|------------|-----------|
| URDF generation | ❌ | ✅ `skills/urdf` | 🔨 Phase 3 — **differentiator** |
| SRDF / MoveIt | ❌ | ✅ `skills/srdf` | 🔨 Phase 3 |
| SDF simulation worlds | ❌ | ✅ `skills/sdf` | 🔨 Phase 3 |
| MoveIt2 IK in viewer | ❌ | ✅ optional websocket | 🔮 |

---

## Collaboration

| Feature | CadX | Repo today | SolidX v1 |
|---------|------|------------|-----------|
| Projects workspace | ✅ | ❌ | 🔨 Phase 1 |
| Git-style branches | ✅ | ❌ | 🔮 Phase 3 lite (versions) |
| Real-time co-edit | ✅ Pro+ | ❌ | 🔮 Phase 4 |
| Share read-only link | Implied | ❌ | 🔨 Phase 3 |
| Activity feed | ✅ | ❌ | 🔨 Phase 3 |

---

## Account & Billing

| Feature | CadX | Repo today | SolidX v1 |
|---------|------|------------|-----------|
| Free tier | ✅ 2 projects | ❌ | 🔨 100 credits, 3 projects |
| Paid subscription | ✅ $20/mo | ❌ | 🔨 Stripe Pro $20 |
| Credit metering | ✅ | ❌ | 🔨 Phase 0 |
| SSO / enterprise | ✅ Engineer | ❌ | 🔮 |

---

## SolidX Competitive Story

**Match CadX on:** AI text-to-CAD, browser viewer, STEP export, dark pro UI, credit SaaS.

**Beat CadX on (v1):**

1. **Full manufacturing path** — slice → G-code preview (real slicers, not roadmap)
2. **step.parts** — 12k+ standard parts in one click
3. **Robotics stack** — URDF/SRDF/SDF in same portal
4. **Implicit CAD** — shader-based models for lightweight web preview
5. **Open skill ecosystem** — same engine as open-source CAD Skills library

**Defer vs CadX:**

- Native in-browser sketch/extrude kernel (months of R&D)
- Real-time Git-style branching (Phase 3+)
