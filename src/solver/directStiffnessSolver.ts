/**
 * ============================================================================
 * FILE: src/solver/directStiffnessSolver.ts
 * DESCRIPTION:
 * Real-Time 2D/3D Direct Stiffness Method (DSM) Finite-Element Solver and
 * Joint Free Body Diagram (FBD) Equilibrium Engine.
 *
 * Assembles the global structural stiffness matrix [K] from individual beam
 * element stiffness matrices (incorporating each beam's Young's Modulus E,
 * cross-sectional area A, length L, and direction cosines), applies pin/roller
 * boundary conditions, solves [K]{u} = {F} via Gaussian elimination with
 * partial pivoting, and derives internal member forces, stresses, safety
 * factors, and static equilibrium equations at every joint.
 * ============================================================================
 */

import {
  StructuralNode,
  StructuralBeam,
  ExternalLoad,
  StructuralAnalysisSummary,
  NodeAnalysisResult,
  BeamAnalysisResult,
  JointEquilibriumAnalysis,
  JointFBDForceVector,
  StressStatus,
} from '../types/structural';
import { getMaterialById } from '../data/materialsAndPresets';

/**
 * ============================================================================
 * SECTION 1: STRESS UTILIZATION TO HEATMAP COLOR MAPPER
 * Maps a dimensionless stress utilization ratio (|sigma| / sigma_yield)
 * to a semantic engineering status level and high-contrast heatmap color.
 * ============================================================================
 */
export function getStressVisuals(utilizationRatio: number): {
  status: StressStatus;
  colorHex: string;
} {
  const ur = Math.max(0, utilizationRatio);
  if (ur >= 1.0) {
    return { status: 'overstressed', colorHex: '#DC2626' }; // Crimson Red (>= 100% of yield)
  }
  if (ur >= 0.8) {
    return { status: 'critical', colorHex: '#F97316' }; // High-alert Orange-Red (80% - 100% of yield)
  }
  if (ur >= 0.55) {
    return { status: 'elevated', colorHex: '#F59E0B' }; // Amber Warning (55% - 80% of yield)
  }
  if (ur >= 0.28) {
    return { status: 'moderate', colorHex: '#0EA5E9' }; // Sky / Cyan (28% - 55% of yield)
  }
  return { status: 'nominal', colorHex: '#10B981' }; // Emerald Safe (0% - 28% of yield)
}

/**
 * ============================================================================
 * SECTION 2: DENSE LINEAR SYSTEM SOLVER (GAUSSIAN ELIMINATION)
 * Solves the linear algebraic system [A]{x} = {b} using Gaussian elimination
 * with partial row pivoting and small diagonal regularization so even
 * user-modified mechanisms solve smoothly without NaN or Infinity values.
 * ============================================================================
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  // Build augmented matrix [A | b]
  const M = A.map((row, i) => [...row, b[i]]);

  // Forward elimination phase with partial pivoting
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      const absVal = Math.abs(M[row][col]);
      if (absVal > maxVal) {
        maxVal = absVal;
        maxRow = row;
      }
    }

    // Swap current row with the pivot row
    if (maxRow !== col) {
      const tmp = M[col];
      M[col] = M[maxRow];
      M[maxRow] = tmp;
    }

    // Guard against zero pivot on mechanisms or floating joints
    const pivot = Math.abs(M[col][col]) < 1e-7 ? 1e-7 : M[col][col];

    // Eliminate entries below the pivot
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / pivot;
      for (let k = col; k <= n; k++) {
        M[row][k] -= factor * M[col][k];
      }
    }
  }

  // Back-substitution phase to compute unknown displacement vector {x}
  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = M[row][n];
    for (let col = row + 1; col < n; col++) {
      sum -= M[row][col] * x[col];
    }
    const diag = Math.abs(M[row][row]) < 1e-7 ? 1e-7 : M[row][row];
    x[row] = sum / diag;
  }

  return x;
}

/**
 * ============================================================================
 * SECTION 3: DIRECT STIFFNESS METHOD (DSM) STRUCTURAL SOLVER
 * Main entry point for structural physics calculations.
 *
 * Steps performed:
 * 1. Indexes all joints and allocates the (2N x 2N) global stiffness matrix [K]
 *    and global nodal load vector {F}.
 * 2. Projects external point loads {P} into horizontal (Fx) and vertical (Fy)
 *    nodal forces in Newtons.
 * 3. Loops over every beam to compute its local axial stiffness (EA/L),
 *    transforms it into global coordinates via direction cosines (c, s), and
 *    adds it into [K]. Optionally distributes beam self-weight if enabled.
 * 4. Enforces support boundary conditions (Pin, Roller, Fixed) and solves
 *    [K]{u} = {F} for nodal displacements {u}.
 * 5. Back-calculates support reaction forces {R} = [K_orig]{u} - {F_orig}.
 * 6. Evaluates internal axial force N, normal stress sigma = N/A, Euler
 *    buckling limit, utilization ratio, and Factor of Safety for every beam.
 * 7. Constructs the complete Joint Free Body Diagram (FBD) vector set and
 *    symbolic/numeric equilibrium equations (sum Fx = 0, sum Fy = 0) at every joint.
 * ============================================================================
 */
export function solveStructure(
  nodes: StructuralNode[],
  beams: StructuralBeam[],
  loads: ExternalLoad[],
  includeSelfWeight: boolean = false
): StructuralAnalysisSummary {
  const nNodes = nodes.length;
  const dofCount = nNodes * 2; // 2 Degrees of Freedom per node: [ux, uy]

  // Map each joint ID ('A', 'B', ...) to its zero-based index
  const nodeIndexMap = new Map<string, number>();
  nodes.forEach((node, idx) => nodeIndexMap.set(node.id, idx));

  // Allocate Global Stiffness Matrix K (in N/m) and Global Force Vector F (in N)
  const K: number[][] = Array.from({ length: dofCount }, () =>
    new Array(dofCount).fill(0)
  );
  const F: number[] = new Array(dofCount).fill(0);

  // Apply tiny baseline elastic regularization to prevent singular matrices on disconnected nodes
  for (let i = 0; i < dofCount; i++) {
    K[i][i] = 1e-3;
  }

  // Step 1: Assemble external point loads into the global force vector F (convert kN -> N)
  for (const load of loads) {
    const idx = nodeIndexMap.get(load.nodeId);
    if (idx === undefined) continue;
    const rad = (load.angleDeg * Math.PI) / 180;
    const fxN = load.magnitudeKN * 1000 * Math.cos(rad);
    const fyN = load.magnitudeKN * 1000 * Math.sin(rad);
    F[idx * 2] += fxN;
    F[idx * 2 + 1] += fyN;
  }

  let totalBridgeMassKg = 0;

  // Step 2: Assemble individual beam element stiffness matrices into global K
  for (const beam of beams) {
    const i1 = nodeIndexMap.get(beam.startNodeId);
    const i2 = nodeIndexMap.get(beam.endNodeId);
    if (i1 === undefined || i2 === undefined || i1 === i2) continue;

    const n1 = nodes[i1];
    const n2 = nodes[i2];
    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) continue;

    // Direction cosines c = cos(theta), s = sin(theta)
    const c = dx / L;
    const s = dy / L;

    // Retrieve material and apply any per-beam custom Young's modulus override
    const mat = getMaterialById(beam.materialId);
    const E_GPa = beam.customYoungsGPa ?? mat.youngsModulusGPa;
    const E_Pa = E_GPa * 1e9; // Convert GPa -> Pascals (N/m^2)
    const A_m2 = Math.max(beam.crossSectionAreaCm2, 0.5) * 1e-4; // Convert cm^2 -> m^2

    // Axial bar stiffness kAxial = EA / L
    const kAxial = (E_Pa * A_m2) / L;
    // Small frame shear stiffness (0.2% of axial) to stabilize collinear truss nodes
    const kTrans = kAxial * 0.002;

    // Compute beam mass and optional gravity dead load
    const massKg = mat.densityKgM3 * A_m2 * L;
    totalBridgeMassKg += massKg;

    if (includeSelfWeight) {
      const halfWeightN = 0.5 * massKg * 9.81;
      F[i1 * 2 + 1] -= halfWeightN;
      F[i2 * 2 + 1] -= halfWeightN;
    }

    // 4x4 Element stiffness matrix entries in global XY coordinates
    const kxx = kAxial * c * c + kTrans * s * s;
    const kyy = kAxial * s * s + kTrans * c * c;
    const kxy = (kAxial - kTrans) * c * s;

    const dofs = [i1 * 2, i1 * 2 + 1, i2 * 2, i2 * 2 + 1];
    const ke = [
      [kxx, kxy, -kxx, -kxy],
      [kxy, kyy, -kxy, -kyy],
      [-kxx, -kxy, kxx, kxy],
      [-kxy, -kyy, kxy, kyy],
    ];

    for (let r = 0; r < 4; r++) {
      for (let col = 0; col < 4; col++) {
        K[dofs[r]][dofs[col]] += ke[r][col];
      }
    }
  }

  // Save unreduced copies of K and F so we can compute exact support reactions R = K_orig * u - F_orig
  const K_orig = K.map((row) => [...row]);
  const F_orig = [...F];

  // Step 3: Identify constrained degrees of freedom from Pin, Roller, and Fixed supports
  const constrainedDofs = new Set<number>();
  nodes.forEach((node, idx) => {
    if (node.support === 'pin' || node.support === 'fixed') {
      constrainedDofs.add(idx * 2); // Constrain X
      constrainedDofs.add(idx * 2 + 1); // Constrain Y
    } else if (node.support === 'roller_y') {
      constrainedDofs.add(idx * 2 + 1); // Constrain Y only
    } else if (node.support === 'roller_x') {
      constrainedDofs.add(idx * 2); // Constrain X only
    }
  });

  // Safety guard: if user removed supports in the editor, auto-stabilize endpoints
  const solverNotes: string[] = [];
  if (constrainedDofs.size < 3 && nodes.length >= 2) {
    solverNotes.push(
      'Structure had fewer than 3 support constraints; stabilized first and last joints automatically.'
    );
    constrainedDofs.add(0);
    constrainedDofs.add(1);
    constrainedDofs.add((nodes.length - 1) * 2 + 1);
  }

  // Zero out constrained rows and columns in K and set diagonal to 1
  for (const dof of constrainedDofs) {
    for (let j = 0; j < dofCount; j++) {
      K[dof][j] = 0;
      K[j][dof] = 0;
    }
    K[dof][dof] = 1;
    F[dof] = 0;
  }

  // Step 4: Solve linear system for nodal displacement vector u (in meters)
  const u = solveLinearSystem(K, F);

  // Step 5: Compute nodal deflections (mm) and support reactions (kN)
  const nodeResults: Record<string, NodeAnalysisResult> = {};
  let maxDisplacementMm = 0;
  let maxDeflectionNodeId: string | null = null;

  nodes.forEach((node, idx) => {
    const uxM = u[idx * 2] || 0;
    const uyM = u[idx * 2 + 1] || 0;
    const dxMm = uxM * 1000;
    const dyMm = uyM * 1000;
    const dispMagMm = Math.hypot(dxMm, dyMm);

    if (dispMagMm > maxDisplacementMm) {
      maxDisplacementMm = dispMagMm;
      maxDeflectionNodeId = node.id;
    }

    let rxN = 0;
    let ryN = 0;
    if (
      node.support === 'pin' ||
      node.support === 'fixed' ||
      node.support === 'roller_x'
    ) {
      let internalFx = 0;
      for (let j = 0; j < dofCount; j++) {
        internalFx += K_orig[idx * 2][j] * u[j];
      }
      rxN = internalFx - F_orig[idx * 2];
    }
    if (
      node.support === 'pin' ||
      node.support === 'fixed' ||
      node.support === 'roller_y'
    ) {
      let internalFy = 0;
      for (let j = 0; j < dofCount; j++) {
        internalFy += K_orig[idx * 2 + 1][j] * u[j];
      }
      ryN = internalFy - F_orig[idx * 2 + 1];
    }

    const rxKN = rxN / 1000;
    const ryKN = ryN / 1000;
    const rMagKN = Math.hypot(rxKN, ryKN);
    const rAngleDeg = (Math.atan2(ryKN, rxKN) * 180) / Math.PI;

    nodeResults[node.id] = {
      nodeId: node.id,
      x: node.x,
      y: node.y,
      support: node.support,
      dxMm,
      dyMm,
      reactionRxKN: rxKN,
      reactionRyKN: ryKN,
      reactionMagnitudeKN: rMagKN,
      reactionAngleDeg: rAngleDeg,
    };
  });

  // Step 6: Compute internal axial forces, stresses, and utilization ratios for every beam
  const beamResults: Record<string, BeamAnalysisResult> = {};
  let maxUtilizationRatio = 0;
  let criticalBeamId: string | null = null;
  let overstressedBeamCount = 0;
  let criticalBeamCount = 0;

  for (const beam of beams) {
    const i1 = nodeIndexMap.get(beam.startNodeId);
    const i2 = nodeIndexMap.get(beam.endNodeId);
    if (i1 === undefined || i2 === undefined) continue;

    const n1 = nodes[i1];
    const n2 = nodes[i2];
    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    const L = Math.max(Math.hypot(dx, dy), 0.001);
    const c = dx / L;
    const s = dy / L;
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    const mat = getMaterialById(beam.materialId);
    const effectiveYoungsGPa = beam.customYoungsGPa ?? mat.youngsModulusGPa;
    const effectiveYieldMPa = beam.customYieldMPa ?? mat.yieldStrengthMPa;

    const E_Pa = effectiveYoungsGPa * 1e9;
    const A_m2 = Math.max(beam.crossSectionAreaCm2, 0.5) * 1e-4;

    const u1x = u[i1 * 2] || 0;
    const u1y = u[i1 * 2 + 1] || 0;
    const u2x = u[i2 * 2] || 0;
    const u2y = u[i2 * 2 + 1] || 0;

    // Axial extension deltaL = (u2 - u1) dot unit_vector
    const deltaLM = (u2x - u1x) * c + (u2y - u1y) * s;
    const axialForceN = ((E_Pa * A_m2) / L) * deltaLM;
    const axialForceKN = axialForceN / 1000;

    // Normal stress in MPa: Force(N) / Area(m^2) / 10^6
    const normalStressMPa = axialForceN / A_m2 / 1e6;
    const absStressMPa = Math.abs(normalStressMPa);

    // Euler critical buckling stress for slender compression struts
    const I_m4 = 0.12 * A_m2 * A_m2;
    const eulerBucklingForceN = (Math.PI * Math.PI * E_Pa * I_m4) / (L * L);
    const bucklingCriticalStressMPa = eulerBucklingForceN / A_m2 / 1e6;

    // Utilization Ratio = |sigma| / sigma_yield
    const utilizationRatio = absStressMPa / Math.max(effectiveYieldMPa, 1);
    const safetyFactor =
      absStressMPa < 0.05 ? 99.9 : Math.min(99.9, effectiveYieldMPa / absStressMPa);

    const forceState: 'Tension' | 'Compression' | 'Zero-Force' =
      Math.abs(axialForceKN) < 0.05
        ? 'Zero-Force'
        : axialForceKN > 0
        ? 'Tension'
        : 'Compression';

    const { status, colorHex } = getStressVisuals(utilizationRatio);

    if (utilizationRatio >= 1.0) overstressedBeamCount++;
    else if (utilizationRatio >= 0.8) criticalBeamCount++;

    if (utilizationRatio > maxUtilizationRatio) {
      maxUtilizationRatio = utilizationRatio;
      criticalBeamId = beam.id;
    }

    const strainMilli = (deltaLM / L) * 1000;
    const massKg = mat.densityKgM3 * A_m2 * L;

    beamResults[beam.id] = {
      beamId: beam.id,
      startNodeId: beam.startNodeId,
      endNodeId: beam.endNodeId,
      material: mat,
      effectiveYieldMPa,
      effectiveYoungsGPa,
      crossSectionAreaCm2: beam.crossSectionAreaCm2,
      lengthM: L,
      angleDeg,
      axialForceKN,
      forceState,
      normalStressMPa,
      absStressMPa,
      bucklingCriticalStressMPa,
      utilizationRatio,
      safetyFactor,
      strainMilli,
      elongationMm: deltaLM * 1000,
      massKg,
      status,
      stressColorHex: colorHex,
    };
  }

  // Step 7: Build Joint Free Body Diagram (FBD) Equilibrium Analysis for every joint
  const jointFBDs: Record<string, JointEquilibriumAnalysis> = {};

  for (const node of nodes) {
    const vectors: JointFBDForceVector[] = [];
    const nRes = nodeResults[node.id];

    // 7a. Collect internal member forces acting on this joint
    for (const beam of beams) {
      if (beam.startNodeId !== node.id && beam.endNodeId !== node.id) continue;
      const otherNodeId =
        beam.startNodeId === node.id ? beam.endNodeId : beam.startNodeId;
      const otherNode = nodes[nodeIndexMap.get(otherNodeId)!];
      if (!otherNode) continue;

      const bRes = beamResults[beam.id];
      if (!bRes) continue;

      // Geometric angle from this joint toward the connected joint
      const memberRayDeg =
        (Math.atan2(otherNode.y - node.y, otherNode.x - node.x) * 180) / Math.PI;
      const memberRayRad = (memberRayDeg * Math.PI) / 180;

      // Tension (+) pulls AWAY from the joint along memberRayDeg;
      // Compression (-) pushes INTO the joint (opposing memberRayDeg).
      const forceMagKN = Math.abs(bRes.axialForceKN);
      const fxKN = bRes.axialForceKN * Math.cos(memberRayRad);
      const fyKN = bRes.axialForceKN * Math.sin(memberRayRad);

      vectors.push({
        id: `fbd_beam_${beam.id}`,
        sourceType: 'member',
        label: `F_${beam.id}`,
        subLabel: `${bRes.forceState} (${bRes.material.shortName})`,
        magnitudeKN: forceMagKN,
        angleDeg: memberRayDeg,
        fxKN,
        fyKN,
        memberState: bRes.forceState,
        beamId: beam.id,
        stressRatio: bRes.utilizationRatio,
        colorHex: bRes.stressColorHex,
      });
    }

    // 7b. Collect external point loads applied at this joint
    for (const load of loads) {
      if (load.nodeId !== node.id) continue;
      const rad = (load.angleDeg * Math.PI) / 180;
      const fxKN = load.magnitudeKN * Math.cos(rad);
      const fyKN = load.magnitudeKN * Math.sin(rad);
      vectors.push({
        id: `fbd_load_${load.id}`,
        sourceType: 'external_load',
        label: load.label || `P_${load.id}`,
        subLabel: 'Applied External Load',
        magnitudeKN: load.magnitudeKN,
        angleDeg: load.angleDeg,
        fxKN,
        fyKN,
        colorHex: '#F59E0B',
      });
    }

    // 7c. Collect support reaction components (Rx, Ry) acting at this joint
    if (nRes && nRes.reactionMagnitudeKN > 0.05) {
      if (Math.abs(nRes.reactionRxKN) > 0.05) {
        vectors.push({
          id: `fbd_rx_${node.id}`,
          sourceType: 'support_reaction',
          label: `R_${node.id}x`,
          subLabel: `${node.support.toUpperCase()} Horizontal Reaction`,
          magnitudeKN: Math.abs(nRes.reactionRxKN),
          angleDeg: nRes.reactionRxKN >= 0 ? 0 : 180,
          fxKN: nRes.reactionRxKN,
          fyKN: 0,
          colorHex: '#06B6D4',
        });
      }
      if (Math.abs(nRes.reactionRyKN) > 0.05) {
        vectors.push({
          id: `fbd_ry_${node.id}`,
          sourceType: 'support_reaction',
          label: `R_${node.id}y`,
          subLabel: `${node.support.toUpperCase()} Vertical Reaction`,
          magnitudeKN: Math.abs(nRes.reactionRyKN),
          angleDeg: nRes.reactionRyKN >= 0 ? 90 : -90,
          fxKN: 0,
          fyKN: nRes.reactionRyKN,
          colorHex: '#10B981',
        });
      }
    }

    // 7d. Sum horizontal and vertical force components and format step-by-step equations
    const sumFxKN = vectors.reduce((acc, v) => acc + v.fxKN, 0);
    const sumFyKN = vectors.reduce((acc, v) => acc + v.fyKN, 0);

    const fxSymbolicParts: string[] = [];
    const fxNumericParts: string[] = [];
    const fySymbolicParts: string[] = [];
    const fyNumericParts: string[] = [];

    for (const v of vectors) {
      if (v.magnitudeKN < 0.05) continue;
      if (Math.abs(v.fxKN) >= 0.05) {
        const sign = v.fxKN >= 0 ? '+' : '-';
        const angleAbs = Math.abs(v.angleDeg).toFixed(1);
        fxSymbolicParts.push(`${sign} ${v.label}·cos(${angleAbs}°)`);
        fxNumericParts.push(`${sign} ${Math.abs(v.fxKN).toFixed(2)}`);
      }
      if (Math.abs(v.fyKN) >= 0.05) {
        const sign = v.fyKN >= 0 ? '+' : '-';
        const angleAbs = Math.abs(v.angleDeg).toFixed(1);
        fySymbolicParts.push(`${sign} ${v.label}·sin(${angleAbs}°)`);
        fyNumericParts.push(`${sign} ${Math.abs(v.fyKN).toFixed(2)}`);
      }
    }

    const cleanFirstSign = (parts: string[]) => {
      if (parts.length === 0) return '0';
      const joined = parts.join(' ');
      return joined.startsWith('+ ') ? joined.slice(2) : joined;
    };

    jointFBDs[node.id] = {
      nodeId: node.id,
      x: node.x,
      y: node.y,
      support: node.support,
      vectors,
      sumFxKN,
      sumFyKN,
      isInEquilibrium: Math.hypot(sumFxKN, sumFyKN) < 1.0,
      symbolicSumFx: `∑Fx = ${cleanFirstSign(fxSymbolicParts)} = 0`,
      numericSumFx: `∑Fx = ${cleanFirstSign(fxNumericParts)} = ${sumFxKN.toFixed(2)} kN`,
      symbolicSumFy: `∑Fy = ${cleanFirstSign(fySymbolicParts)} = 0`,
      numericSumFy: `∑Fy = ${cleanFirstSign(fyNumericParts)} = ${sumFyKN.toFixed(2)} kN`,
    };
  }

  const totalAppliedLoadKN = loads.reduce((acc, l) => acc + l.magnitudeKN, 0);

  return {
    nodes: nodeResults,
    beams: beamResults,
    jointFBDs,
    maxUtilizationRatio,
    criticalBeamId,
    maxDisplacementMm,
    maxDeflectionNodeId,
    totalBridgeMassKg,
    totalAppliedLoadKN,
    overstressedBeamCount,
    criticalBeamCount,
    isStable: maxDisplacementMm < 5000,
    solverNotes,
  };
}
