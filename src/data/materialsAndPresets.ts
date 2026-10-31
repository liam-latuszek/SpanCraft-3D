/**
 * ============================================================================
 * FILE: src/data/materialsAndPresets.ts
 * DESCRIPTION:
 * Engineering Materials Library and Built-in Mechanical/Civil Worksheet Presets.
 * Contains calibrated mechanical properties (Young's modulus E, yield strength
 * sigma_yield, ultimate strength, density) for 7 structural materials, plus a
 * procedural SVG worksheet generator and 4 ready-to-run bridge/truss presets.
 * ============================================================================
 */

import {
  MaterialSpec,
  WorksheetPreset,
  StructuralNode,
  StructuralBeam,
  ExternalLoad,
} from '../types/structural';

/**
 * ============================================================================
 * SECTION 1: STRUCTURAL ENGINEERING MATERIAL LIBRARY
 * Provides realistic elastic modulus (GPa), yield stress (MPa), density (kg/m^3),
 * and PBR appearance properties for individual beam customization.
 * ============================================================================
 */
export const MATERIAL_LIBRARY: MaterialSpec[] = [
  {
    id: 'steel_a36',
    name: 'Structural Steel (ASTM A36)',
    shortName: 'A36 Steel',
    category: 'Steel',
    youngsModulusGPa: 200,
    yieldStrengthMPa: 250,
    ultimateStrengthMPa: 400,
    densityKgM3: 7850,
    colorHex: '#64748B',
    roughness: 0.35,
    metalness: 0.85,
    description:
      'Standard hot-rolled carbon structural steel used in civil bridge trusses and buildings.',
  },
  {
    id: 'steel_a572',
    name: 'High-Strength Steel (ASTM A572 Gr.50)',
    shortName: 'A572 HSLA Steel',
    category: 'Steel',
    youngsModulusGPa: 200,
    yieldStrengthMPa: 345,
    ultimateStrengthMPa: 450,
    densityKgM3: 7850,
    colorHex: '#475569',
    roughness: 0.3,
    metalness: 0.9,
    description:
      'High-strength low-alloy columbium-vanadium steel for heavy-duty highway bridge chords.',
  },
  {
    id: 'alu_6061',
    name: 'Aerospace Aluminum (6061-T6)',
    shortName: '6061-T6 Aluminum',
    category: 'Aluminum',
    youngsModulusGPa: 68.9,
    yieldStrengthMPa: 276,
    ultimateStrengthMPa: 310,
    densityKgM3: 2700,
    colorHex: '#94A3B8',
    roughness: 0.25,
    metalness: 0.92,
    description:
      'Precipitation-hardened aluminum alloy; lightweight with 1/3 the elastic stiffness of steel.',
  },
  {
    id: 'alu_6063',
    name: 'Architectural Aluminum (6063-T5)',
    shortName: '6063-T5 Aluminum',
    category: 'Aluminum',
    youngsModulusGPa: 68.3,
    yieldStrengthMPa: 145,
    ultimateStrengthMPa: 186,
    densityKgM3: 2700,
    colorHex: '#CBD5E1',
    roughness: 0.28,
    metalness: 0.88,
    description:
      'Medium-strength extruded aluminum alloy; reaches maximum yield stress earlier under heavy loads.',
  },
  {
    id: 'timber_douglas',
    name: 'Structural Timber (Douglas Fir Glulam)',
    shortName: 'Douglas Fir Timber',
    category: 'Timber',
    youngsModulusGPa: 13.1,
    yieldStrengthMPa: 45,
    ultimateStrengthMPa: 65,
    densityKgM3: 530,
    colorHex: '#B45309',
    roughness: 0.75,
    metalness: 0.05,
    description:
      'Engineered glued-laminated timber; low weight but requires larger sections due to 45 MPa yield limit.',
  },
  {
    id: 'cfrp_comp',
    name: 'Carbon Fiber Composite (CFRP)',
    shortName: 'Carbon Fiber CFRP',
    category: 'Composite',
    youngsModulusGPa: 155,
    yieldStrengthMPa: 620,
    ultimateStrengthMPa: 750,
    densityKgM3: 1600,
    colorHex: '#1E293B',
    roughness: 0.2,
    metalness: 0.45,
    description:
      'Ultra-high tensile strength carbon composite for reinforcing critical overstressed members.',
  },
  {
    id: 'iron_wrought',
    name: 'Historic Wrought Iron (Lattice Spec)',
    shortName: 'Wrought Iron',
    category: 'Iron',
    youngsModulusGPa: 190,
    yieldStrengthMPa: 160,
    ultimateStrengthMPa: 240,
    densityKgM3: 7700,
    colorHex: '#57534E',
    roughness: 0.55,
    metalness: 0.75,
    description: '19th-century fibrous iron alloy with modest yield threshold.',
  },
];

/**
 * Dictionary lookup map for O(1) retrieval of a MaterialSpec by its ID.
 */
export const MATERIAL_MAP: Record<string, MaterialSpec> = Object.fromEntries(
  MATERIAL_LIBRARY.map((m) => [m.id, m])
);

/**
 * Retrieves a MaterialSpec by its string ID, falling back to ASTM A36 Steel
 * if an unrecognized ID is passed.
 */
export function getMaterialById(id: string): MaterialSpec {
  return MATERIAL_MAP[id] || MATERIAL_LIBRARY[0];
}

/**
 * ============================================================================
 * SECTION 2: PROCEDURAL 2D WORKSHEET DIAGRAM SVG GENERATOR
 * Renders an authentic university mechanical engineering problem sheet SVG
 * (complete with graph grid, title block, pin/roller symbols, beams, and load
 * arrows) so built-in presets and user-edited topologies always have a crisp
 * 2D worksheet representation.
 * ============================================================================
 */
export function generateWorksheetSvgDataUrl(
  title: string,
  courseCode: string,
  nodes: StructuralNode[],
  beams: StructuralBeam[],
  loads: ExternalLoad[]
): string {
  const width = 900;
  const height = 520;
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 12);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 4);

  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const padX = 130;
  const padY = 120;
  const scale = Math.min(
    (width - padX * 2) / spanX,
    (height - padY * 2) / spanY
  );

  // Coordinate transformation helpers from meters (x, y) to SVG pixels
  const toScreenX = (x: number) => padX + (x - minX) * scale;
  const toScreenY = (y: number) => height - padY - (y - minY) * scale;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // 1. Generate engineering graph paper grid lines
  let gridLines = '';
  for (let gx = 0; gx <= width; gx += 25) {
    gridLines += `<line x1="${gx}" y1="0" x2="${gx}" y2="${height}" stroke="#cbd5e1" stroke-width="${
      gx % 100 === 0 ? '0.8' : '0.4'
    }" stroke-opacity="0.55" />`;
  }
  for (let gy = 0; gy <= height; gy += 25) {
    gridLines += `<line x1="0" y1="${gy}" x2="${width}" y2="${gy}" stroke="#cbd5e1" stroke-width="${
      gy % 100 === 0 ? '0.8' : '0.4'
    }" stroke-opacity="0.55" />`;
  }

  // 2. Generate structural beam lines
  let beamElements = '';
  for (const b of beams) {
    const n1 = nodeMap.get(b.startNodeId);
    const n2 = nodeMap.get(b.endNodeId);
    if (!n1 || !n2) continue;
    const x1 = toScreenX(n1.x);
    const y1 = toScreenY(n1.y);
    const x2 = toScreenX(n2.x);
    const y2 = toScreenY(n2.y);
    beamElements += `
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1e293b" stroke-width="6" stroke-linecap="round" />
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" />
    `;
  }

  // 3. Generate Pin, Roller, and Fixed support schematics
  let supportElements = '';
  for (const n of nodes) {
    const sx = toScreenX(n.x);
    const sy = toScreenY(n.y);
    if (n.support === 'pin') {
      supportElements += `
        <polygon points="${sx},${sy + 4} ${sx - 16},${sy + 28} ${sx + 16},${sy + 28}" fill="#e2e8f0" stroke="#0f172a" stroke-width="2" />
        <line x1="${sx - 22}" y1="${sy + 28}" x2="${sx + 22}" y2="${sy + 28}" stroke="#0f172a" stroke-width="2.5" />
      `;
    } else if (n.support === 'roller_y') {
      supportElements += `
        <polygon points="${sx},${sy + 4} ${sx - 14},${sy + 22} ${sx + 14},${sy + 22}" fill="#e2e8f0" stroke="#0f172a" stroke-width="2" />
        <circle cx="${sx - 7}" cy="${sy + 26}" r="4" fill="#ffffff" stroke="#0f172a" stroke-width="1.8" />
        <circle cx="${sx + 7}" cy="${sy + 26}" r="4" fill="#ffffff" stroke="#0f172a" stroke-width="1.8" />
        <line x1="${sx - 22}" y1="${sy + 31}" x2="${sx + 22}" y2="${sy + 31}" stroke="#0f172a" stroke-width="2.5" />
      `;
    } else if (n.support === 'fixed') {
      supportElements += `
        <rect x="${sx - 18}" y="${sy - 18}" width="12" height="36" fill="#cbd5e1" stroke="#0f172a" stroke-width="2" />
      `;
    }
  }

  // 4. Generate external point force vectors
  let loadElements = '';
  for (const l of loads) {
    const n = nodeMap.get(l.nodeId);
    if (!n) continue;
    const sx = toScreenX(n.x);
    const sy = toScreenY(n.y);
    const rad = (l.angleDeg * Math.PI) / 180;
    const ux = Math.cos(rad);
    const uy = -Math.sin(rad);
    const arrowLen = 58;
    const startX = sx - ux * (arrowLen + 10);
    const startY = sy - uy * (arrowLen + 10);
    const endX = sx - ux * 10;
    const endY = sy - uy * 10;
    loadElements += `
      <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="#dc2626" stroke-width="3" marker-end="url(#arrow)" />
      <text x="${startX}" y="${startY - 8}" text-anchor="middle" font-family="monospace" font-size="13" font-weight="bold" fill="#b91c1c">${l.magnitudeKN} kN</text>
    `;
  }

  // 5. Generate Joint circles and ID labels
  let nodeElements = '';
  for (const n of nodes) {
    const sx = toScreenX(n.x);
    const sy = toScreenY(n.y);
    const labelOffsetY = n.y > (minY + maxY) / 2 ? -16 : 18;
    const labelOffsetX = n.support !== 'none' ? -20 : 0;
    nodeElements += `
      <circle cx="${sx}" cy="${sy}" r="6.5" fill="#ffffff" stroke="#0f172a" stroke-width="2.5" />
      <text x="${sx + labelOffsetX}" y="${sy + labelOffsetY}" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="bold" fill="#0f172a">${n.id}</text>
    `;
  }

  const leftX = toScreenX(minX);
  const rightX = toScreenX(maxX);
  const dimY = height - 42;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#dc2626" />
      </marker>
    </defs>
    <rect width="100%" height="100%" fill="#f8fafc" />
    ${gridLines}
    <rect x="16" y="16" width="${width - 32}" height="${height - 32}" fill="none" stroke="#334155" stroke-width="2" />
    <rect x="20" y="20" width="${width - 40}" height="46" fill="#f1f5f9" stroke="#334155" stroke-width="1" />
    <text x="34" y="42" font-family="monospace" font-size="14" font-weight="bold" fill="#0f172a">${courseCode} — PROBLEM SHEET: ${title.toUpperCase()}</text>
    <text x="34" y="58" font-family="monospace" font-size="11" fill="#475569">DETERMINE INTERNAL MEMBER FORCES, STRESSES, AND JOINT EQUILIBRIUM</text>
    ${beamElements}
    ${supportElements}
    ${loadElements}
    ${nodeElements}
    <line x1="${leftX}" y1="${dimY}" x2="${rightX}" y2="${dimY}" stroke="#475569" stroke-width="1.5" />
    <line x1="${leftX}" y1="${dimY - 6}" x2="${leftX}" y2="${dimY + 6}" stroke="#475569" stroke-width="1.5" />
    <line x1="${rightX}" y1="${dimY - 6}" x2="${rightX}" y2="${dimY + 6}" stroke="#475569" stroke-width="1.5" />
    <text x="${(leftX + rightX) / 2}" y="${dimY - 6}" text-anchor="middle" font-family="monospace" font-size="12" fill="#334155">Total Span L = ${spanX.toFixed(
    1
  )} m | Height H = ${spanY.toFixed(1)} m</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * ============================================================================
 * SECTION 3: BUILT-IN ENGINEERING WORKSHEET PRESETS
 * Defines 4 complete statics/mechanics problems with nodes, beams, loads,
 * and 3D bridge extrapolation assumptions.
 * ============================================================================
 */

// Preset 1: Pratt River Valley Bridge
const prattNodes: StructuralNode[] = [
  { id: 'A', x: 0, y: 0, support: 'pin' },
  { id: 'B', x: 4, y: 0, support: 'none' },
  { id: 'C', x: 8, y: 0, support: 'none' },
  { id: 'D', x: 12, y: 0, support: 'none' },
  { id: 'E', x: 16, y: 0, support: 'roller_y' },
  { id: 'F', x: 4, y: 4, support: 'none' },
  { id: 'G', x: 8, y: 4, support: 'none' },
  { id: 'H', x: 12, y: 4, support: 'none' },
];

const prattBeams: StructuralBeam[] = [
  { id: 'AB', startNodeId: 'A', endNodeId: 'B', materialId: 'steel_a36', crossSectionAreaCm2: 14, profile: 'i_beam', role: 'bottom_chord' },
  { id: 'BC', startNodeId: 'B', endNodeId: 'C', materialId: 'steel_a36', crossSectionAreaCm2: 14, profile: 'i_beam', role: 'bottom_chord' },
  { id: 'CD', startNodeId: 'C', endNodeId: 'D', materialId: 'steel_a36', crossSectionAreaCm2: 14, profile: 'i_beam', role: 'bottom_chord' },
  { id: 'DE', startNodeId: 'D', endNodeId: 'E', materialId: 'steel_a36', crossSectionAreaCm2: 14, profile: 'i_beam', role: 'bottom_chord' },
  { id: 'AF', startNodeId: 'A', endNodeId: 'F', materialId: 'steel_a36', crossSectionAreaCm2: 16, profile: 'box_girder', role: 'top_chord' },
  { id: 'FG', startNodeId: 'F', endNodeId: 'G', materialId: 'alu_6063', crossSectionAreaCm2: 12, profile: 'box_girder', role: 'top_chord' },
  { id: 'GH', startNodeId: 'G', endNodeId: 'H', materialId: 'alu_6063', crossSectionAreaCm2: 12, profile: 'box_girder', role: 'top_chord' },
  { id: 'HE', startNodeId: 'H', endNodeId: 'E', materialId: 'steel_a36', crossSectionAreaCm2: 16, profile: 'box_girder', role: 'top_chord' },
  { id: 'BF', startNodeId: 'B', endNodeId: 'F', materialId: 'alu_6061', crossSectionAreaCm2: 10, profile: 'tubular', role: 'web_vertical' },
  { id: 'CG', startNodeId: 'C', endNodeId: 'G', materialId: 'alu_6061', crossSectionAreaCm2: 10, profile: 'tubular', role: 'web_vertical' },
  { id: 'DH', startNodeId: 'D', endNodeId: 'H', materialId: 'alu_6061', crossSectionAreaCm2: 10, profile: 'tubular', role: 'web_vertical' },
  { id: 'FC', startNodeId: 'F', endNodeId: 'C', materialId: 'steel_a36', crossSectionAreaCm2: 11, profile: 'tubular', role: 'web_diagonal' },
  { id: 'HC', startNodeId: 'H', endNodeId: 'C', materialId: 'steel_a36', crossSectionAreaCm2: 11, profile: 'tubular', role: 'web_diagonal' },
];

const prattLoads: ExternalLoad[] = [
  { id: 'L1', nodeId: 'B', magnitudeKN: 75, angleDeg: -90, label: 'P1 = 75 kN' },
  { id: 'L2', nodeId: 'C', magnitudeKN: 135, angleDeg: -90, label: 'P2 = 135 kN' },
  { id: 'L3', nodeId: 'D', magnitudeKN: 95, angleDeg: -90, label: 'P3 = 95 kN' },
];

// Preset 2: Warren Gorge Highway Truss
const warrenNodes: StructuralNode[] = [
  { id: 'A', x: 0, y: 0, support: 'pin' },
  { id: 'B', x: 4, y: 0, support: 'none' },
  { id: 'C', x: 8, y: 0, support: 'none' },
  { id: 'D', x: 12, y: 0, support: 'none' },
  { id: 'E', x: 16, y: 0, support: 'roller_y' },
  { id: 'F', x: 2, y: 3.5, support: 'none' },
  { id: 'G', x: 6, y: 3.5, support: 'none' },
  { id: 'H', x: 10, y: 3.5, support: 'none' },
  { id: 'I', x: 14, y: 3.5, support: 'none' },
];

const warrenBeams: StructuralBeam[] = [
  { id: 'AB', startNodeId: 'A', endNodeId: 'B', materialId: 'steel_a36', crossSectionAreaCm2: 15, profile: 'i_beam', role: 'bottom_chord' },
  { id: 'BC', startNodeId: 'B', endNodeId: 'C', materialId: 'steel_a36', crossSectionAreaCm2: 15, profile: 'i_beam', role: 'bottom_chord' },
  { id: 'CD', startNodeId: 'C', endNodeId: 'D', materialId: 'steel_a36', crossSectionAreaCm2: 15, profile: 'i_beam', role: 'bottom_chord' },
  { id: 'DE', startNodeId: 'D', endNodeId: 'E', materialId: 'steel_a36', crossSectionAreaCm2: 15, profile: 'i_beam', role: 'bottom_chord' },
  { id: 'FG', startNodeId: 'F', endNodeId: 'G', materialId: 'steel_a36', crossSectionAreaCm2: 15, profile: 'box_girder', role: 'top_chord' },
  { id: 'GH', startNodeId: 'G', endNodeId: 'H', materialId: 'alu_6063', crossSectionAreaCm2: 11, profile: 'box_girder', role: 'top_chord' },
  { id: 'HI', startNodeId: 'H', endNodeId: 'I', materialId: 'steel_a36', crossSectionAreaCm2: 15, profile: 'box_girder', role: 'top_chord' },
  { id: 'AF', startNodeId: 'A', endNodeId: 'F', materialId: 'steel_a36', crossSectionAreaCm2: 13, profile: 'tubular', role: 'web_diagonal' },
  { id: 'FB', startNodeId: 'F', endNodeId: 'B', materialId: 'steel_a36', crossSectionAreaCm2: 13, profile: 'tubular', role: 'web_diagonal' },
  { id: 'BG', startNodeId: 'B', endNodeId: 'G', materialId: 'alu_6061', crossSectionAreaCm2: 11, profile: 'tubular', role: 'web_diagonal' },
  { id: 'GC', startNodeId: 'G', endNodeId: 'C', materialId: 'alu_6061', crossSectionAreaCm2: 11, profile: 'tubular', role: 'web_diagonal' },
  { id: 'CH', startNodeId: 'C', endNodeId: 'H', materialId: 'alu_6061', crossSectionAreaCm2: 11, profile: 'tubular', role: 'web_diagonal' },
  { id: 'HD', startNodeId: 'H', endNodeId: 'D', materialId: 'alu_6061', crossSectionAreaCm2: 11, profile: 'tubular', role: 'web_diagonal' },
  { id: 'DI', startNodeId: 'D', endNodeId: 'I', materialId: 'steel_a36', crossSectionAreaCm2: 13, profile: 'tubular', role: 'web_diagonal' },
  { id: 'IE', startNodeId: 'I', endNodeId: 'E', materialId: 'steel_a36', crossSectionAreaCm2: 13, profile: 'tubular', role: 'web_diagonal' },
];

const warrenLoads: ExternalLoad[] = [
  { id: 'L1', nodeId: 'B', magnitudeKN: 90, angleDeg: -90, label: 'Axle 1 = 90 kN' },
  { id: 'L2', nodeId: 'C', magnitudeKN: 150, angleDeg: -90, label: 'Main Load = 150 kN' },
  { id: 'L3', nodeId: 'D', magnitudeKN: 90, angleDeg: -90, label: 'Axle 2 = 90 kN' },
];

// Preset 3: Howe Canyon Timber & Steel Arch
const timberArchNodes: StructuralNode[] = [
  { id: 'A', x: 0, y: 0, support: 'pin' },
  { id: 'B', x: 4, y: 0.8, support: 'none' },
  { id: 'C', x: 8, y: 1.2, support: 'none' },
  { id: 'D', x: 12, y: 0.8, support: 'none' },
  { id: 'E', x: 16, y: 0, support: 'roller_y' },
  { id: 'F', x: 4, y: 4.0, support: 'none' },
  { id: 'G', x: 8, y: 4.5, support: 'none' },
  { id: 'H', x: 12, y: 4.0, support: 'none' },
];

const timberArchBeams: StructuralBeam[] = [
  { id: 'AB', startNodeId: 'A', endNodeId: 'B', materialId: 'steel_a36', crossSectionAreaCm2: 18, profile: 'box_girder', role: 'bottom_chord' },
  { id: 'BC', startNodeId: 'B', endNodeId: 'C', materialId: 'steel_a36', crossSectionAreaCm2: 18, profile: 'box_girder', role: 'bottom_chord' },
  { id: 'CD', startNodeId: 'C', endNodeId: 'D', materialId: 'steel_a36', crossSectionAreaCm2: 18, profile: 'box_girder', role: 'bottom_chord' },
  { id: 'DE', startNodeId: 'D', endNodeId: 'E', materialId: 'steel_a36', crossSectionAreaCm2: 18, profile: 'box_girder', role: 'bottom_chord' },
  { id: 'AF', startNodeId: 'A', endNodeId: 'F', materialId: 'timber_douglas', crossSectionAreaCm2: 42, profile: 'box_girder', role: 'top_chord' },
  { id: 'FG', startNodeId: 'F', endNodeId: 'G', materialId: 'timber_douglas', crossSectionAreaCm2: 36, profile: 'box_girder', role: 'top_chord' },
  { id: 'GH', startNodeId: 'G', endNodeId: 'H', materialId: 'timber_douglas', crossSectionAreaCm2: 36, profile: 'box_girder', role: 'top_chord' },
  { id: 'HE', startNodeId: 'H', endNodeId: 'E', materialId: 'timber_douglas', crossSectionAreaCm2: 42, profile: 'box_girder', role: 'top_chord' },
  { id: 'BF', startNodeId: 'B', endNodeId: 'F', materialId: 'steel_a36', crossSectionAreaCm2: 10, profile: 'tubular', role: 'web_vertical' },
  { id: 'CG', startNodeId: 'C', endNodeId: 'G', materialId: 'steel_a36', crossSectionAreaCm2: 10, profile: 'tubular', role: 'web_vertical' },
  { id: 'DH', startNodeId: 'D', endNodeId: 'H', materialId: 'steel_a36', crossSectionAreaCm2: 10, profile: 'tubular', role: 'web_vertical' },
  { id: 'BG', startNodeId: 'B', endNodeId: 'G', materialId: 'timber_douglas', crossSectionAreaCm2: 32, profile: 'tubular', role: 'web_diagonal' },
  { id: 'DG', startNodeId: 'D', endNodeId: 'G', materialId: 'timber_douglas', crossSectionAreaCm2: 32, profile: 'tubular', role: 'web_diagonal' },
];

const timberArchLoads: ExternalLoad[] = [
  { id: 'L1', nodeId: 'F', magnitudeKN: 55, angleDeg: -90, label: 'Deck Load 1 = 55 kN' },
  { id: 'L2', nodeId: 'G', magnitudeKN: 95, angleDeg: -90, label: 'Center Deck = 95 kN' },
  { id: 'L3', nodeId: 'H', magnitudeKN: 55, angleDeg: -90, label: 'Deck Load 2 = 55 kN' },
];

// Preset 4: Cantilever Gorge Observation Boom
const cantileverNodes: StructuralNode[] = [
  { id: 'A', x: 0, y: 0, support: 'pin' },
  { id: 'B', x: 0, y: 4, support: 'pin' },
  { id: 'C', x: 4, y: 0.5, support: 'none' },
  { id: 'D', x: 4, y: 3.5, support: 'none' },
  { id: 'E', x: 8, y: 1.2, support: 'none' },
  { id: 'F', x: 8, y: 3.0, support: 'none' },
  { id: 'G', x: 12, y: 2.2, support: 'none' },
];

const cantileverBeams: StructuralBeam[] = [
  { id: 'AB', startNodeId: 'A', endNodeId: 'B', materialId: 'steel_a572', crossSectionAreaCm2: 20, profile: 'i_beam', role: 'web_vertical' },
  { id: 'BD', startNodeId: 'B', endNodeId: 'D', materialId: 'alu_6063', crossSectionAreaCm2: 16, profile: 'i_beam', role: 'top_chord' },
  { id: 'DF', startNodeId: 'D', endNodeId: 'F', materialId: 'alu_6061', crossSectionAreaCm2: 14, profile: 'i_beam', role: 'top_chord' },
  { id: 'FG', startNodeId: 'F', endNodeId: 'G', materialId: 'steel_a36', crossSectionAreaCm2: 12, profile: 'i_beam', role: 'top_chord' },
  { id: 'AC', startNodeId: 'A', endNodeId: 'C', materialId: 'steel_a36', crossSectionAreaCm2: 18, profile: 'box_girder', role: 'bottom_chord' },
  { id: 'CE', startNodeId: 'C', endNodeId: 'E', materialId: 'steel_a36', crossSectionAreaCm2: 16, profile: 'box_girder', role: 'bottom_chord' },
  { id: 'EG', startNodeId: 'E', endNodeId: 'G', materialId: 'steel_a36', crossSectionAreaCm2: 14, profile: 'box_girder', role: 'bottom_chord' },
  { id: 'BC', startNodeId: 'B', endNodeId: 'C', materialId: 'steel_a36', crossSectionAreaCm2: 14, profile: 'tubular', role: 'web_diagonal' },
  { id: 'CD', startNodeId: 'C', endNodeId: 'D', materialId: 'steel_a36', crossSectionAreaCm2: 12, profile: 'tubular', role: 'web_vertical' },
  { id: 'DE', startNodeId: 'D', endNodeId: 'E', materialId: 'steel_a36', crossSectionAreaCm2: 12, profile: 'tubular', role: 'web_diagonal' },
  { id: 'EF', startNodeId: 'E', endNodeId: 'F', materialId: 'steel_a36', crossSectionAreaCm2: 10, profile: 'tubular', role: 'web_vertical' },
];

const cantileverLoads: ExternalLoad[] = [
  { id: 'L1', nodeId: 'F', magnitudeKN: 45, angleDeg: -90, label: 'Hoist 1 = 45 kN' },
  { id: 'L2', nodeId: 'G', magnitudeKN: 85, angleDeg: -90, label: 'Tip Payload = 85 kN' },
];

/**
 * Exported collection of built-in engineering worksheet presets.
 */
export const WORKSHEET_PRESETS: WorksheetPreset[] = [
  {
    id: 'pratt_valley_bridge',
    title: 'Pratt River Valley Bridge',
    subtitle: '8-Joint Hybrid Steel & Aluminum Truss',
    courseCode: 'MECH 210 · STATICS & STRESS',
    description:
      'Asymmetrically loaded 16m Pratt river bridge where top chords FG and GH use architectural aluminum (6063-T5), placing them near critical yield stress under the 135 kN mid-span load.',
    spanSummary: '16.0m Span · 8 Joints · 13 Beams',
    nodes: prattNodes,
    beams: prattBeams,
    loads: prattLoads,
    extractionNotes: [
      'Detected Pin support at Joint A (0m, 0m) and Roller support at Joint E (16m, 0m).',
      'Top chord members FG and GH are 6063-T5 Aluminum (145 MPa yield) — inspect their elevated compressive stress or upgrade them to High-Strength Steel.',
      'Use the External Forces tab to change load strengths or move loads between joints.',
    ],
    presumption3D: {
      archetype: 'Through-Truss Bridge',
      transverseWidthM: 2.7,
      deckPlacement: 'bottom_chord',
      summary:
        'Extrapolated 2D Pratt truss into a 3D twin-plane through-truss bridge (2.7m transverse spacing) with transverse steel cross-girders, bottom-chord road deck, and masonry canyon piers at Pin A and Roller E.',
    },
    worksheetSvgDataUrl: generateWorksheetSvgDataUrl(
      'Pratt River Valley Bridge',
      'MECH 210',
      prattNodes,
      prattBeams,
      prattLoads
    ),
  },
  {
    id: 'warren_gorge_truss',
    title: 'Warren Gorge Highway Truss',
    subtitle: '9-Joint Equilateral Web Highway Span',
    courseCode: 'CIVL 302 · STRUCTURAL ANALYSIS',
    description:
      'Classic 16m Warren truss subjected to a three-axle 330 kN highway load. Central top chord GH experiences maximum compression while bottom chords carry pure tension.',
    spanSummary: '16.0m Span · 9 Joints · 15 Beams',
    nodes: warrenNodes,
    beams: warrenBeams,
    loads: warrenLoads,
    extractionNotes: [
      'Equilateral triangular web geometry distributes shear across alternating tension/compression diagonals.',
      'Central top chord GH is currently 6063-T5 Aluminum and approaches maximum compressive stress.',
      'Click any joint to verify ∑Fx = 0 and ∑Fy = 0 equilibrium equations.',
    ],
    presumption3D: {
      archetype: 'Through-Truss Bridge',
      transverseWidthM: 3.0,
      deckPlacement: 'bottom_chord',
      summary:
        'Extrapolated 2D Warren equilateral truss into a 3D highway span with box-girder compression chords, wide-flange tension ties, and lower roadway deck.',
    },
    worksheetSvgDataUrl: generateWorksheetSvgDataUrl(
      'Warren Gorge Highway Truss',
      'CIVL 302',
      warrenNodes,
      warrenBeams,
      warrenLoads
    ),
  },
  {
    id: 'howe_timber_arch',
    title: 'Howe Canyon Timber & Steel Arch',
    subtitle: '8-Joint Glulam Timber & Steel Tie Bridge',
    courseCode: 'MECH 315 · MECHANICS OF MATERIALS',
    description:
      'Hybrid canyon bridge combining Douglas Fir Glulam top arch chords with A36 Steel tension ties. Demonstrates how low-modulus timber affects member stress utilization.',
    spanSummary: '16.0m Span · 8 Joints · 13 Beams',
    nodes: timberArchNodes,
    beams: timberArchBeams,
    loads: timberArchLoads,
    extractionNotes: [
      'Douglas Fir Glulam (E = 13.1 GPa, Yield = 45 MPa) carries the arch compression.',
      'Try swapping individual timber beams to Steel or Carbon Fiber to observe real-time stiffness load redistribution.',
    ],
    presumption3D: {
      archetype: 'Arch Span Bridge',
      transverseWidthM: 2.8,
      deckPlacement: 'bottom_chord',
      summary:
        'Extrapolated 2D Howe arch into a 3D timber-and-steel valley crossing with laminated timber arch ribs and tubular steel vertical hangers.',
    },
    worksheetSvgDataUrl: generateWorksheetSvgDataUrl(
      'Howe Canyon Timber & Steel Arch',
      'MECH 315',
      timberArchNodes,
      timberArchBeams,
      timberArchLoads
    ),
  },
  {
    id: 'cantilever_gorge_crane',
    title: 'Cantilever Gorge Observation Boom',
    subtitle: '7-Joint Overhanging Cliff Truss',
    courseCode: 'MECH 204 · FRAME EQUILIBRIUM',
    description:
      'Anchored at cliff-wall pin supports A and B, this 12m overhanging truss carries an 85 kN tip payload, creating severe tension along upper chord BD.',
    spanSummary: '12.0m Overhang · 7 Joints · 11 Beams',
    nodes: cantileverNodes,
    beams: cantileverBeams,
    loads: cantileverLoads,
    extractionNotes: [
      'Anchored by dual pin supports at A (0,0) and B (0,4) on the left cliff abutment.',
      'Upper chord BD carries peak tensile force from the overhanging moment arm.',
    ],
    presumption3D: {
      archetype: 'Cantilever Structure',
      transverseWidthM: 2.4,
      deckPlacement: 'bottom_chord',
      summary:
        'Extrapolated 2D cliff-anchored cantilever truss into a 3D twin-boom observation structure anchored into the left canyon wall.',
    },
    worksheetSvgDataUrl: generateWorksheetSvgDataUrl(
      'Cantilever Gorge Observation Boom',
      'MECH 204',
      cantileverNodes,
      cantileverBeams,
      cantileverLoads
    ),
  },
];
