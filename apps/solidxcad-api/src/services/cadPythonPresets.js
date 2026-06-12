/**
 * Tested build123d generators — used when LLM scripts fail or for known patterns (Hilbert).
 */

export const CAD_HELPERS = `
import math

def _fuse_all(shapes):
    valid = [s for s in shapes if s is not None and hasattr(s, "wrapped")]
    if not valid:
        raise RuntimeError("no valid shapes to fuse")
    part = valid[0]
    for s in valid[1:]:
        part = part + s
    return part


def _axis_bar(p0, p1, thickness):
    x0, y0, z0 = float(p0[0]), float(p0[1]), float(p0[2])
    x1, y1, z1 = float(p1[0]), float(p1[1]), float(p1[2])
    mx, my, mz = (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2
    dx, dy, dz = abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)
    if dx < 1e-9 and dy < 1e-9 and dz < 1e-9:
        return None
    t = float(thickness)
    if dx >= dy and dx >= dz:
        return Pos(mx, my, mz) * Box(dx, t, t)
    if dy >= dx and dy >= dz:
        return Pos(mx, my, mz) * Box(t, dy, t)
    return Pos(mx, my, mz) * Box(t, t, dz)


def hilbert3d(order):
    """Integer lattice points on a 3D Hilbert curve (axis-aligned segments)."""
    order = int(max(1, min(order, 3)))

    def hilbert(x, y, z, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, size, n):
        if n == 0:
            return [(x + (ax + bx + cx + dx) * size / 2,
                     y + (ay + by + cy + dy) * size / 2,
                     z + (az + bz + cz + dz) * size / 2)]
        out = []
        out += hilbert(x, y, z, ax, ay, az, cx, cy, cz, bx, by, bz, dx, dy, dz, size / 2, n - 1)
        out += hilbert(x + ax * size / 2, y + ay * size / 2, z + az * size / 2,
                       dx, dy, dz, ax, ay, az, cx, cy, cz, bx, by, bz, size / 2, n - 1)
        out += hilbert(x + ax * size / 2 + bx * size / 2, y + ay * size / 2 + by * size / 2,
                       z + az * size / 2 + bz * size / 2, ax, ay, az, bx, by, bz, dx, dy, dz,
                       cx, cy, cz, size / 2, n - 1)
        out += hilbert(x + ax * size / 2 + bx * size / 2 + cx * size / 2,
                       y + ay * size / 2 + by * size / 2 + cy * size / 2,
                       z + az * size / 2 + bz * size / 2 + cz * size / 2,
                       bx, by, bz, dx, dy, dz, ax, ay, az, cx, cy, cz, size / 2, n - 1)
        out += hilbert(x + ax * size / 2 + bx * size / 2 + cx * size / 2 + dx * size / 2,
                       y + ay * size / 2 + by * size / 2 + cy * size / 2 + dy * size / 2,
                       z + az * size / 2 + bz * size / 2 + cz * size / 2 + dz * size / 2,
                       cx, cy, cz, dx, dy, dz, bx, by, bz, ax, ay, az, size / 2, n - 1)
        out += hilbert(x + ax * size + bx * size / 2 + cx * size / 2 + dx * size / 2,
                       y + ay * size + by * size / 2 + cy * size / 2 + dy * size / 2,
                       z + az * size + bz * size / 2 + cz * size / 2 + dz * size / 2,
                       dx, dy, dz, ax, ay, az, cx, cy, cz, bx, by, bz, size / 2, n - 1)
        out += hilbert(x + ax * size + bx * size / 2 + cx * size / 2,
                       y + ay * size + by * size / 2 + cy * size / 2,
                       z + az * size + bz * size / 2 + cz * size / 2,
                       ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, size / 2, n - 1)
        out += hilbert(x + ax * size + bx * size / 2,
                       y + ay * size + by * size / 2,
                       z + az * size + bz * size / 2,
                       cx, cy, cz, bx, by, bz, dx, dy, dz, ax, ay, az, size / 2, n - 1)
        return out

    span = 2 ** order
    raw = hilbert(0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, span, order)
    pts = [raw[0]]
    for p in raw[1:]:
        if p != pts[-1]:
            pts.append(p)
    return pts
`;

export function detectHilbertRequest(text = '') {
  return /\bhilbert\b/i.test(text);
}

export function parseHilbertParams(text = '') {
  const msg = text.toLowerCase();
  let order = 2;
  const levelMatch = msg.match(/level\s*(\d+)|order\s*(\d+)|\bL\s*(\d+)\b/);
  if (levelMatch) {
    order = parseInt(levelMatch[1] || levelMatch[2] || levelMatch[3], 10);
  }
  order = Math.max(1, Math.min(order, 3));

  let envelopeMm = 30;
  const cubeMatch = msg.match(/(\d+(?:\.\d+)?)\s*mm\s*cube/);
  const envMatch = msg.match(/envelope\s*(\d+(?:\.\d+)?)\s*mm/);
  if (cubeMatch) envelopeMm = parseFloat(cubeMatch[1]);
  else if (envMatch) envelopeMm = parseFloat(envMatch[1]);

  let barMm = 2;
  const barMatch = msg.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:square\s*)?bars?/);
  const barMatch2 = msg.match(/bars?\s*(\d+(?:\.\d+)?)\s*mm/);
  const barMatch3 = msg.match(/square\s*bars?\s*(\d+(?:\.\d+)?)/);
  if (barMatch) barMm = parseFloat(barMatch[1]);
  else if (barMatch2) barMm = parseFloat(barMatch2[1]);
  else if (barMatch3) barMm = parseFloat(barMatch3[1]);

  barMm = Math.max(0.5, Math.min(barMm, envelopeMm / 4));
  return { order, envelopeMm, barMm };
}

export function buildHilbertGenStep({ order = 2, envelopeMm = 30, barMm = 2 } = {}) {
  return `from build123d import *
${CAD_HELPERS}

def gen_step():
    order = ${order}
    envelope = ${envelopeMm}
    bar = ${barMm}
    pts = hilbert3d(order)
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    zs = [p[2] for p in pts]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    min_z, max_z = min(zs), max(zs)
    span = max(max_x - min_x, max_y - min_y, max_z - min_z) or 1.0
    scale = envelope / span
    scaled = [((p[0] - min_x) * scale, (p[1] - min_y) * scale, (p[2] - min_z) * scale) for p in pts]
    boxes = []
    for i in range(len(scaled) - 1):
        seg = _axis_bar(scaled[i], scaled[i + 1], bar)
        if seg is not None:
            boxes.append(seg)
    part = _fuse_all(boxes)
    shell = Box(envelope, envelope, envelope, align=(Align.MIN, Align.MIN, Align.MIN))
    part = shell & part
    return part
`;
}

export function injectCadHelpers(code) {
  if (code.includes('_fuse_all') && code.includes('def hilbert3d')) {
    return code;
  }
  const importsEnd = code.search(/\n(?:def |class )/);
  const insertAt = importsEnd > 0 ? importsEnd : code.indexOf('\n\n') + 1;
  if (insertAt <= 0) {
    return `from build123d import *\n${CAD_HELPERS}\n${code}`;
  }
  return `${code.slice(0, insertAt)}\n${CAD_HELPERS}\n${code.slice(insertAt)}`;
}

export function parsePlateParams(text = '') {
  const m = text.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*[x×]\s*(\d+(?:\.\d+)?))?\s*mm/i);
  if (m) {
    return {
      length: parseFloat(m[1]),
      width: parseFloat(m[2]),
      thick: m[3] ? parseFloat(m[3]) : 5,
    };
  }
  return { length: 50, width: 30, thick: 5 };
}

export function wantsAssembly(text = '') {
  return /\b(assembly|assemble|assembly\s*tree|mount\s*plate|mounting\s*plate)\b/i.test(text)
    || /\b(separate\s+parts?|named\s+children|compound\s+with)\b/i.test(text)
    || (/\b(plate|bracket|panel)\b/i.test(text) && /\b(screw|bolt|fastener|hole)/i.test(text));
}

export function detectAssemblyWithParts(text = '', partCount = 0) {
  if (!partCount) return false;
  return wantsAssembly(text);
}

export function buildAssemblyMountGenStep({
  length = 50,
  width = 30,
  thick = 5,
  screwRelPath = 'parts/screw.step',
  holeRadius = 1.6,
} = {}) {
  const inset = 5;
  const hx = (length / 2 - inset).toFixed(2);
  const hy = (width / 2 - inset).toFixed(2);
  const escaped = screwRelPath.replace(/\\/g, '/').replace(/"/g, '\\"');
  return `from build123d import *

def gen_step():
    length, width, thick = ${length}, ${width}, ${thick}
    hole_r = ${holeRadius}
    with BuildPart() as bp:
        Box(length, width, thick)
        for x, y in [(-${hx}, -${hy}), (${hx}, -${hy}), (${hx}, ${hy}), (-${hx}, ${hy})]:
            with Locations((x, y)):
                Hole(radius=hole_r)
        plate = bp.part

    screw = import_step("${escaped}")
    hole_xy = [(-${hx}, -${hy}), (${hx}, -${hy}), (${hx}, ${hy}), (-${hx}, ${hy})]
    screws = []
    for x, y in hole_xy:
        screws.append(Pos(x, y, thick / 2) * screw)
    return Compound(label="mount_plate_assembly", children=[plate, *screws])
`;
}

export function sanitizeInventedApis(code) {
  let out = code;
  out = out.replace(/\bangle_degrees\s*\(/g, '(');
  out = out.replace(/\bAngle\s*\(/g, '(');
  out = out.replace(/\bdegrees\s*\(\s*([^)]+)\s*\)\s*\*\s*math\.pi\s*\/\s*180/g, '$1');
  return out;
}

export function sanitizeRotationUsage(code) {
  let out = code;
  out = out.replace(/Rot\s*\(\s*([XYZ])\s*=\s*([^,)]+)\s*\)/gi, 'Rot($2, Axis.$1)');
  out = out.replace(
    /Rot\s*\(\s*axis\s*=\s*Axis\.([XYZ])\s*,\s*angle\s*=\s*([^)]+)\s*\)/gi,
    'Rot($2, Axis.$1)',
  );
  return out;
}

const FUSE_HELPER = `
def _fuse_all(shapes):
    valid = [s for s in shapes if s is not None and hasattr(s, "wrapped")]
    if not valid:
        raise RuntimeError("no valid shapes to fuse")
    part = valid[0]
    for s in valid[1:]:
        part = part + s
    return part
`.trim();

export function sanitizeCompoundInCode(code) {
  let out = code;
  if (!/Compound\s*\(/i.test(out)) return out;
  if (!out.includes('_fuse_all')) {
    const anchor = out.match(/^(from build123d import[^\n]*\n)/i);
    if (anchor) {
      out = out.replace(anchor[0], `${anchor[0]}\n${FUSE_HELPER}\n\n`);
    } else {
      out = `${FUSE_HELPER}\n\n${out}`;
    }
  }
  out = out.replace(
    /return\s+Compound\s*\([\s\S]*?children\s*=\s*\[([\s\S]*?)\][\s\S]*?\)/gi,
    'return _fuse_all([$1])',
  );
  out = out.replace(/return\s+Compound\s*\([^)]+\)/gi, 'return _fuse_all([])');
  return out;
}

export function detectGearRequest(text = '') {
  return /\b(gear|spur|helical|pinion|teeth|module)\b/i.test(text);
}

export function parseBoxParams(text = '') {
  const msg = text.toLowerCase();
  const cube = msg.match(/(\d+(?:\.\d+)?)\s*mm\s*cube/);
  if (cube) {
    const s = parseFloat(cube[1]);
    return { l: s, w: s, h: s };
  }
  const box = msg.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*mm/);
  if (box) {
    return { l: parseFloat(box[1]), w: parseFloat(box[2]), h: parseFloat(box[3]) };
  }
  const box2 = msg.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*mm/);
  if (box2) {
    return { l: parseFloat(box2[1]), w: parseFloat(box2[2]), h: 10 };
  }
  const single = msg.match(/(\d+(?:\.\d+)?)\s*mm/);
  if (single) {
    const s = parseFloat(single[1]);
    return { l: s, w: s, h: s };
  }
  return { l: 30, w: 30, h: 30 };
}

export function buildFallbackGenStep(text = '') {
  const { l, w, h } = parseBoxParams(text);
  return `from build123d import *

def gen_step():
    return Box(${l}, ${w}, ${h})
`;
}

export function buildGearFallbackGenStep(text = '') {
  const teethMatch = text.match(/(\d+)\s*[- ]?teeth|teeth\s*[:=]?\s*(\d+)/i);
  const moduleMatch = text.match(/module\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const teeth = parseInt(teethMatch?.[1] || teethMatch?.[2] || '20', 10);
  const module = moduleMatch ? parseFloat(moduleMatch[1]) : 2;
  const pitchD = teeth * module;
  const hMatch = text.match(/(?:thick(?:ness)?|height)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*mm/i);
  const height = hMatch ? parseFloat(hMatch[1]) : Math.max(8, module * 4);
  const boreMatch = text.match(/(?:bore|hole)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*mm/i);
  const bore = boreMatch ? parseFloat(boreMatch[1]) : Math.max(4, module * 2);
  return `from build123d import *

def gen_step():
    outer_r = ${(pitchD / 2).toFixed(2)}
    height = ${height.toFixed(2)}
    bore_r = ${(bore / 2).toFixed(2)}
    with BuildPart() as bp:
        Cylinder(radius=outer_r, height=height, align=(Align.CENTER, Align.CENTER, Align.MIN))
        with Locations((0, 0, 0)):
            Hole(radius=bore_r, depth=height + 1)
    return bp.part
`;
}
