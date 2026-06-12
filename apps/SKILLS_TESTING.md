# SolidX CAD — Full skills testing guide

Test after `npm run dev` from `apps/`, logged in, with `.env` configured (OpenRouter, MongoDB, `STORAGE_BACKEND=local`, Python venv, OrcaSlicer for gcode).

Watch the **Agent pipeline** panel in chat — each step shows skill name and ✓/✗ status.

---

## 0. Environment checklist

| Check | How |
|-------|-----|
| API health | http://localhost:4000/health → `"ok":true` |
| Skills list | Chat footer lists all skills; `GET /api/agent/skills` (auth) |
| Storage | API log: `[storage] saved locally` |
| Python | `PYTHON_BIN` → `import build123d` works |
| Slicer | `ORCASLICER_BIN` + `SLICER_PROFILE_PATH` set |
| Viewer | CAD Viewer tab loads; port ~4178 |

---

## 1. CAD (skills/cad → STEP/STL/GLB)

**Chat prompt:**
```
make a 30mm cube
```

**Pass criteria:**
- Agent: `▶ Skill: CAD` → `skills/cad/scripts/step` → `✓ Done`
- Files: `models/part_*.step`, `models/part_*.stl`, `models/part_*.py` (generator)
- CAD Viewer: STEP renders; GLB sidecar (`.part_*.step.glb` or `part_*.glb`)

**3MF export:**
```
make a 30mm cube and export 3MF
```
- Files: `models/part_*.3mf`

**DXF / laser (needs gen_dxf in script):**
```
flat 50×30mm plate with 4 holes, export DXF for laser cutting
```
- Files: `models/part_*.dxf` when AI includes `gen_dxf()`

**Assembly with catalog parts (2-step):**
1. `import M3 socket head screw from step.parts`
2. `assembly: mount plate 50×30mm with 4 holes for imported screws`

**Pass:** plate STEP in `models/`; screws in `parts/`; CAD prompt sees project files list

---

## 2. URDF (robot)

**Chat prompt:**
```
create a simple 2-link robot arm URDF
```

**Pass criteria:**
- Agent: `Skill: URDF` → `Running skills/urdf` → `Saved robot_*.urdf`
- Files: `models/robot_*.urdf` + `models/robot_*.py` (generator sidecar)
- CAD Viewer: robot links visible; **no** "generator source missing" warning

**Hand (keep simple):**
```
simple robotic hand with palm and 3 fingers as URDF
```

---

## 3. SRDF (MoveIt)

**Prerequisite:** URDF in project (step 2).

**Chat prompt:**
```
generate MoveIt SRDF with planning groups for the robot arm
```

**Pass criteria:**
- Agent: `Skill: SRDF` → `Saved robot_*.srdf` + `.py`
- CAD Viewer: SRDF file in `models/`

---

## 4. SDF (Gazebo)

**Chat prompt:**
```
create a simple box robot SDF model for Gazebo
```

**Pass criteria:**
- Agent: `Skill: SDF` → `models/model_*.sdf` + `.py`
- CAD Viewer lists SDF file

---

## 5. Implicit CAD

**Chat prompt:**
```
implicit CAD rounded box 40mm × 30mm × 20mm
```

**Pass criteria:**
- Agent: `Skill: Implicit CAD` → `models/implicit_*.implicit.js`
- Mesh exports: `models/implicit_*.glb`, `models/implicit_*.stl` (auto)
- Optional: `implicit CAD sphere 25mm — export 3MF` → `implicit_*.3mf`
- CAD Viewer: implicit raymarch preview (experimental)

---

## 6. step.parts (catalog import)

**Chat prompt:**
```
import M3 socket head screw from step.parts
```

**Pass criteria:**
- Agent: `step.parts — searching` → `✓ Imported parts/…`
- File in `parts/*.step`
- CAD Viewer shows imported STEP

**Alternative:** Parts tab → search → Import STEP

---

## 7. G-code (slicing)

**Prerequisite:** STL or STEP in project.

**Option A — Slice tab:** Tools → Slice → Generate G-code

**Option B — Chat after CAD:**
```
make a 20mm cube and slice it for 3D printing
```

**Option C — Slice existing part:**
```
slice the latest part for printing
```

**Pass criteria:**
- Agent: `Slicing … (skills/gcode)` → `✓ G-code saved: slices/*.gcode`
- CAD Viewer: open `slices/*.gcode` → toolpath preview

---

## 8. SendCutSend (preflight)

**Prerequisite:** STEP or DXF in project.

**Chat prompt:**
```
SendCutSend preflight for laser cutting
```

**Pass criteria:**
- Agent: `Skill: SendCutSend` → `Preflight report saved: models/sendcutsend_*.md`
- Report lists file name, size, DXF status, next manual steps
- If matching `.py` has `gen_dxf()`, auto-exports `models/*.dxf`

---

## 9. CAD Viewer (auto)

| Action | Pass |
|--------|------|
| Open CAD Viewer tab | Workspace syncs project files |
| File tree | Shows models/, parts/, slices/ |
| Switch file | Viewer updates |
| After any generation | `Syncing CAD Viewer workspace` in agent log |

---

## 10. Not in chat (manual / future)

| Skill | Status |
|-------|--------|
| **Bambu Labs print** | CLI only (`skills/bambu-labs`) — needs G-code + printer IP |
| **Full SendCutSend API validation** | Preflight report + optional DXF; full catalog compare is agent-local skill |

---

## Quick smoke (15 min)

1. Login → new project  
2. `30mm cube` → CAD Viewer shows STEP  
3. `simple 2-link robot arm URDF` → URDF + .py in models/  
4. `import 608 bearing from step.parts` → parts/ file  
5. Slice tab → G-code (if OrcaSlicer installed)  
6. `implicit CAD sphere 25mm radius` → .implicit.js  
7. `SendCutSend preflight` (after step 2) → .md report  

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No files after chat | Restart API; send **new** message; check agent panel for ✗ |
| URDF generator missing | Regenerate — needs matching `.py` beside `.urdf` |
| Slice fails | Set `ORCASLICER_BIN` + `SLICER_PROFILE_PATH`; restart API |
| Wrong skill selected | Include keyword: URDF, slice, implicit, SRDF, import screw |
| OpenRouter 402 | Add credits or switch to Haiku/Gemini in model dropdown |
