#!/usr/bin/env python3
"""SolidX CAD built-in STL slicer — no OrcaSlicer / GitHub download required."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
import trimesh


def load_mesh(path: Path) -> trimesh.Trimesh:
    loaded = trimesh.load(path, force="mesh")
    if isinstance(loaded, trimesh.Scene):
        meshes = [g for g in loaded.geometry.values() if isinstance(g, trimesh.Trimesh)]
        if not meshes:
            raise RuntimeError("STL scene contains no mesh geometry")
        loaded = trimesh.util.concatenate(meshes)
    if not isinstance(loaded, trimesh.Trimesh) or loaded.vertices.size == 0:
        raise RuntimeError("Could not load a valid mesh from input")
    return loaded


def center_on_bed(mesh: trimesh.Trimesh, bed_w: float, bed_d: float) -> trimesh.Trimesh:
    out = mesh.copy()
    bounds = out.bounds
    cx = (bounds[0][0] + bounds[1][0]) / 2.0
    cy = (bounds[0][1] + bounds[1][1]) / 2.0
    out.apply_translation([bed_w / 2.0 - cx, bed_d / 2.0 - cy, -bounds[0][2]])
    return out


def section_paths(mesh: trimesh.Trimesh, z: float) -> list[np.ndarray]:
    section = mesh.section(plane_origin=[0.0, 0.0, z], plane_normal=[0.0, 0.0, 1.0])
    if section is None:
        return []
    planar, _ = section.to_planar()
    paths: list[np.ndarray] = []
    for entity in planar.entities:
        try:
            pts = planar.discrete[entity.index]
        except Exception:
            continue
        if pts is None or len(pts) < 2:
            continue
        paths.append(np.asarray(pts, dtype=float))
    return paths


def extrusion_delta(
    dist_mm: float,
    line_width_mm: float,
    layer_h_mm: float,
    filament_d_mm: float,
    multiplier: float,
) -> float:
    if dist_mm <= 0:
        return 0.0
    filament_area = math.pi * (filament_d_mm / 2.0) ** 2
    if filament_area <= 0:
        return 0.0
    return (line_width_mm * layer_h_mm * dist_mm / filament_area) * multiplier


def emit_layer_gcode(
    lines: list[str],
    z: float,
    paths: list[np.ndarray],
    *,
    feed_mm_min: float,
    travel_mm_min: float,
    line_width: float,
    layer_h: float,
    filament_d: float,
    multiplier: float,
    e_state: dict,
) -> None:
    lines.append(f";LAYER:{z:.3f}")
    lines.append(f"G0 Z{z:.3f} F{travel_mm_min:.0f}")

    for path in paths:
        if len(path) < 2:
            continue
        start = path[0]
        lines.append(
            f"G0 X{start[0]:.3f} Y{start[1]:.3f} F{travel_mm_min:.0f}"
        )
        prev = (float(start[0]), float(start[1]), z)
        for point in path[1:]:
            x, y = float(point[0]), float(point[1])
            dist = math.hypot(x - prev[0], y - prev[1])
            e_state["e"] += extrusion_delta(dist, line_width, layer_h, filament_d, multiplier)
            lines.append(
                f"G1 X{x:.3f} Y{y:.3f} E{e_state['e']:.5f} F{feed_mm_min:.0f}"
            )
            prev = (x, y, z)


def write_gcode(mesh: trimesh.Trimesh, settings: dict, output: Path) -> None:
    layer_h = float(settings.get("layerHeight", 0.2))
    nozzle_d = float(settings.get("nozzleDiameter", 0.4))
    filament_d = float(settings.get("filamentDiameter", 1.75))
    multiplier = float(settings.get("extrusionMultiplier", 100)) / 100.0
    print_speed = float(settings.get("printSpeed", 50)) * 60.0
    move_speed = float(settings.get("moveSpeed", 110)) * 60.0
    nozzle_t = int(settings.get("nozzleTemp", 200))
    bed_t = int(settings.get("bedTemp", 60))
    bed_w = float(settings.get("bedWidth", 220))
    bed_d = float(settings.get("bedDepth", 220))
    skirt_count = int(settings.get("skirtCount", 3))
    line_width = nozzle_d * 1.2

    mesh = center_on_bed(mesh, bed_w, bed_d)
    z_min, z_max = float(mesh.bounds[0][2]), float(mesh.bounds[1][2])

    lines = [
        ";SolidX CAD built-in slicer",
        "G21 ; mm",
        "G90 ; absolute",
        "M82 ; absolute extrusion",
        f"M140 S{bed_t}",
        f"M104 S{nozzle_t}",
        f"M190 S{bed_t}",
        f"M109 S{nozzle_t}",
        "G28 ; home",
        "G92 E0",
    ]

    e_state = {"e": 0.0}

    if skirt_count > 0 and z_max > layer_h:
        skirt_z = layer_h
        bounds = mesh.bounds
        margin = line_width * 2.0
        x0, y0 = bounds[0][0] - margin, bounds[0][1] - margin
        x1, y1 = bounds[1][0] + margin, bounds[1][1] + margin
        for _ in range(max(1, skirt_count)):
            rect = np.array(
                [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]],
                dtype=float,
            )
            emit_layer_gcode(
                lines,
                skirt_z,
                [rect],
                feed_mm_min=print_speed,
                travel_mm_min=move_speed,
                line_width=line_width,
                layer_h=layer_h,
                filament_d=filament_d,
                multiplier=multiplier,
                e_state=e_state,
            )

    z = z_min + layer_h
    layer_count = 0
    while z <= z_max + 1e-6:
        paths = section_paths(mesh, z)
        if paths:
            emit_layer_gcode(
                lines,
                z,
                paths,
                feed_mm_min=print_speed,
                travel_mm_min=move_speed,
                line_width=line_width,
                layer_h=layer_h,
                filament_d=filament_d,
                multiplier=multiplier,
                e_state=e_state,
            )
            layer_count += 1
        z += layer_h

    if layer_count == 0:
        raise RuntimeError("Mesh produced no printable layers")

    lines.extend(
        [
            "M104 S0",
            "M140 S0",
            "G92 E0",
            "G28 X0 Y0",
            "M84",
            ";SolidX CAD slice complete",
        ]
    )
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="SolidX CAD built-in mesh slicer")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--settings", required=True)
    args = parser.parse_args()

    settings_path = Path(args.settings)
    settings = json.loads(settings_path.read_text(encoding="utf-8"))
    mesh = load_mesh(Path(args.input))
    write_gcode(mesh, settings, Path(args.output))
    print(json.dumps({"ok": True, "layers": True}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as err:
        print(json.dumps({"ok": False, "error": str(err)}), file=sys.stderr)
        raise SystemExit(1) from err
