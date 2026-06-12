# SolidX CAD — UI Design Spec

Dark, cloud IDE aesthetic inspired by **VS Code** and **CadX Studio** marketing — professional engineering tool, not consumer glossy.

---

## Design Tokens

```css
/* VS Code Dark+ inspired */
--bg-base:        #1e1e1e;   /* editor background */
--bg-sidebar:     #252526;   /* activity bar / side panels */
--bg-panel:       #2d2d2d;   /* inputs, cards */
--bg-elevated:    #333333;   /* modals, dropdowns */
--border:         #3c3c3c;
--text-primary:   #cccccc;
--text-secondary: #858585;
--text-muted:     #6a6a6a;
--accent:         #007acc;   /* VS Code blue — primary CTA */
--accent-hover:   #1a8ad4;
--success:        #4ec9b0;
--warning:        #dcdcaa;
--error:          #f48771;
--font-ui:        'Inter', system-ui, sans-serif;
--font-mono:      'JetBrains Mono', 'Cascadia Code', monospace;
```

**Accent alternative:** `#0ea5e9` (sky) if you want less Microsoft-blue.

---

## Layout — Design Studio (Main App)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ◉ SolidX    [Project: Motor Mount ▾]     Credits: 87   [Pro ↑]  @user  │  top bar 48px
├────┬─────────────────────────────────────────────────────────┬───────────┤
│ 📁 │                                                         │  AI Chat  │
│ 🔧 │              3D VIEWER (cadjs / Three.js)               │           │
│ 📦 │         orbit · pick · clip · measure · export        │  messages │
│ 🖨 │                                                         │  ──────── │
│    │                                                         │  [input]  │
│ 56 │                                                         │  Send     │
│ px │                                                         │  320px    │
├────┴─────────────────────────────────────────────────────────┴───────────┤
│  Jobs: ● Generating STEP…  │  Console / inspect output (collapsible)      │  120px
└──────────────────────────────────────────────────────────────────────────┘
```

### Activity bar (left, 48px)

| Icon | Panel |
|------|-------|
| Files | Project tree — STEP, STL, gcode, implicit.js |
| Tools | Slice settings, export, inspect |
| Parts | step.parts search browser |
| Print | G-code jobs, printer profiles |
| Settings | Project + account link |

### Center — Viewer

- Reuse **viewer workbench** toolbar: view cube, clip, ortho/persp, fit
- Loading skeleton while job runs
- Empty state: "Describe what you want to build" + example prompts

### Right — AI Chat

- Streaming markdown responses
- Tool call chips: `Generating STEP…`, `Searching parts…`
- Credit cost hint before expensive actions
- Model badge: Fast / CAD Quality

### Bottom — Panel

- Tabs: **Jobs** | **Console** | **Properties** (mass, bbox from inspect)
- Resizable like VS Code terminal

---

## Screens

### 1. Landing (`/`)

- Hero: "AI Design Engine in the Browser" + prompt demo GIF (use `assets/text-to-cad-demo.gif`)
- Feature grid: Text-to-STEP, Slice, Parts library, Robotics
- Pricing: Free 100 credits | Pro $20/mo
- CTA: Start free → `/register`

### 2. Auth (`/login`, `/register`)

- Centered card on `--bg-base`
- Email + password; Google OAuth Phase 4
- Minimal branding

### 3. Dashboard (`/dashboard`)

```
┌─────────────────────────────────────────┐
│  New Project [+]          Credits: 100  │
├─────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ thumb   │ │ thumb   │ │ + New   │   │
│  │ Mount   │ │ Bracket │ │         │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│  Recent jobs table                      │
└─────────────────────────────────────────┘
```

### 4. Studio (`/projects/[id]`)

Full layout above.

### 5. Settings (`/settings`)

- Profile, password
- Billing → Stripe Customer Portal
- API usage (future)
- OpenRouter model preference

### 6. Admin (`/admin`)

- Users, credit grants, job failures — `ADMIN_EMAIL` only

---

## Component Library

| Component | Source |
|-----------|--------|
| Button, Input, Dialog | shadcn/ui |
| DataTable | TanStack Table |
| 3D Canvas | viewer + cadjs (do not rebuild) |
| Chat | Custom + `ai` SDK Vercel for SSE |
| Icons | Lucide (VS Code–like stroke) |
| Toasts | sonner |

---

## Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| Desktop ≥1280px | Full 3-panel studio |
| Tablet | Hide parts panel; chat overlay |
| Mobile | Dashboard + marketing only; studio "desktop recommended" banner |

CAD editing is **desktop-first** (same as CadX).

---

## Motion

- Subtle: panel slide 150ms ease
- Job progress: indeterminate bar on top bar (VS Code style)
- No heavy animations — engineering tool feel

---

## Sample Prompt Chips (Empty Viewer)

- "Motor mount bracket, 50×30mm, 4× M3 holes"
- "Enclosure for Raspberry Pi 4 with ventilation slots"
- "Add M3×20 socket head cap screw from parts library"
- "Slice this model for 0.2mm layers, 20% infill"
