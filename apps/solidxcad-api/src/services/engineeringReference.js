/** Local engineering snippets — keyword retrieval without external vector DB. */

const SNIPPETS = [
  {
    keys: /\b(rocket|engine|nozzle|combustion|turbopump|injector|bell|thrust\s*chamber)\b/i,
    text: `Rocket engine CAD (conceptual mechanical model):
- Decompose: injector plate, combustion chamber (cylinder), converging-diverging nozzle bell, flange mounts, feed lines as simplified cylinders
- Typical proportions: chamber L/D ~2–4, nozzle expansion ratio 10–40 for concept models; throat diameter sets scale
- Use mm; wall thickness 2–8 mm for visual solids unless user specifies pressure vessel analysis
- Compound assembly with labeled children; import catalog fasteners only when named`,
  },
  {
    keys: /\b(robot|urdf|manipulator|6\s*dof|joint|gripper)\b/i,
    text: `Robot URDF: meters; revolute joints with axis, limits (±π typical), inertial tags (mass ~ link volume × density); base_link fixed; serial chain naming link_1…link_n`,
  },
  {
    keys: /\b(m3|m4|m5|socket\s*head|iso\s*4762|fastener|bolt)\b/i,
    text: `ISO metric fasteners: M3 clearance hole ~3.4 mm, M4 ~4.5 mm; socket head cap M3 head OD ~5.5 mm; use step.parts import when user names hardware`,
  },
  {
    keys: /\b(gear|helical|spur|module)\b/i,
    text: `Gears: module mm = pitch diameter / teeth; helical needs helix angle and face width; keep teeth count ≥12 for mesh stability in CAD`,
  },
  {
    keys: /\b(lattice|gyroid|infill|3d\s*print)\b/i,
    text: `Printed parts: min wall 1.2–2 mm FDM; lattice/gyroid as implicit CAD or simplified strut patterns; export STL + optional 3MF for slicing`,
  },
  {
    keys: /\b(gazebo|simulation|sdf)\b/i,
    text: `SDF simulation: meters, inertial + collision + visual per link; simplify collision meshes; match joint types to mechanism`,
  },
];

export function matchEngineeringReference(userMessage = '', skill = '') {
  const text = `${userMessage} ${skill}`;
  const hits = SNIPPETS.filter((s) => s.keys.test(text));
  if (!hits.length) return '';
  return hits.map((h) => h.text).join('\n\n');
}
