/**
 * ============================================================================
 * FILE: src/components/StressScheduleAndReport.tsx
 * DESCRIPTION:
 * Structural Finite-Element Stress Schedule & Exportable Report View.
 * Renders a comprehensive engineering schedule of all beams (with inline
 * material and cross-section editors, axial forces, stresses, utilization %,
 * and safety factors) and all joints (coordinates, displacements, and support
 * reactions), plus one-click CSV download and printable PDF report generation.
 * ============================================================================
 */

import React from 'react';
import {
  StructuralNode,
  StructuralBeam,
  ExternalLoad,
  StructuralAnalysisSummary,
} from '../types/structural';
import { MATERIAL_LIBRARY } from '../data/materialsAndPresets';
import {
  Download,
  Printer,
  ShieldAlert,
  ShieldCheck,
  ArrowUpRight,
} from 'lucide-react';

/**
 * Props accepted by the StressScheduleAndReport component.
 */
interface StressScheduleAndReportProps {
  /** Active engineering problem title. */
  problemTitle: string;
  /** Active engineering problem description. */
  problemDescription: string;
  /** Array of structural joints. */
  nodes: StructuralNode[];
  /** Array of structural beams. */
  beams: StructuralBeam[];
  /** Array of external point loads. */
  loads: ExternalLoad[];
  /** Computed Direct Stiffness analysis summary. */
  analysis: StructuralAnalysisSummary;
  /** Callback to update a beam's material or cross-section directly in the table. */
  onUpdateBeam: (beamId: string, patch: Partial<StructuralBeam>) => void;
  /** Callback to jump to the 3D simulation focused on a specific beam. */
  onSelectBeamIn3D: (beamId: string) => void;
  /** Callback to open a specific joint's Free Body Diagram. */
  onSelectNodeFBD: (nodeId: string) => void;
}

/**
 * Renders the full structural schedule tables and report export actions.
 */
export const StressScheduleAndReport: React.FC<
  StressScheduleAndReportProps
> = ({
  problemTitle,
  problemDescription,
  nodes,
  beams,
  loads,
  analysis,
  onUpdateBeam,
  onSelectBeamIn3D,
  onSelectNodeFBD,
}) => {
  /**
   * Generates and triggers a browser download of a complete CSV spreadsheet
   * containing all beam materials, forces, stresses, and safety factors.
   */
  const handleDownloadCSV = () => {
    const headers = [
      'Beam_ID',
      'Start_Joint',
      'End_Joint',
      'Material_Name',
      'Youngs_Modulus_GPa',
      'Yield_Strength_MPa',
      'Area_cm2',
      'Length_m',
      'Axial_Force_kN',
      'State',
      'Normal_Stress_MPa',
      'Utilization_Pct',
      'Factor_of_Safety',
      'Status',
    ];

    const rows = beams.map((b) => {
      const r = analysis.beams[b.id];
      if (!r) return [];
      return [
        b.id,
        b.startNodeId,
        b.endNodeId,
        `"${r.material.name}"`,
        r.effectiveYoungsGPa,
        r.effectiveYieldMPa,
        b.crossSectionAreaCm2,
        r.lengthM.toFixed(3),
        r.axialForceKN.toFixed(2),
        r.forceState,
        r.normalStressMPa.toFixed(2),
        (r.utilizationRatio * 100).toFixed(1),
        r.safetyFactor.toFixed(2),
        r.status.toUpperCase(),
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `${problemTitle
        .toLowerCase()
        .replace(/\s+/g, '_')}_structural_report.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Invokes the browser print dialog formatted via `@media print` rules.
   */
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="w-full h-full overflow-y-auto p-6 bg-slate-50 dark:bg-[#0B1120]">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ====================================================================
            SECTION 1: REPORT HEADER & EXPORT ACTIONS
            ==================================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-xs font-mono text-sky-600 dark:text-sky-400">
              STRUCTURAL FINITE ELEMENT &amp; MATERIAL SCHEDULE REPORT
            </div>
            <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {problemTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              {problemDescription}
            </p>
          </div>

          <div className="flex items-center gap-2.5 no-print shrink-0">
            <button
              onClick={handleDownloadCSV}
              className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </button>
            <button
              onClick={handlePrintReport}
              className="px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF Report
            </button>
          </div>
        </div>

        {/* ====================================================================
            SECTION 2: EXECUTIVE KPI SUMMARY CARDS
            ==================================================================== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Peak Stress Utilization
            </div>
            <div className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {(analysis.maxUtilizationRatio * 100).toFixed(1)}%
            </div>
            <div className="text-xs font-mono text-slate-500 mt-1">
              Critical Member: Beam {analysis.criticalBeamId || '—'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Max Nodal Deflection
            </div>
            <div className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {analysis.maxDisplacementMm.toFixed(2)} mm
            </div>
            <div className="text-xs font-mono text-slate-500 mt-1">
              At Joint {analysis.maxDeflectionNodeId || '—'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Total External Load
            </div>
            <div className="font-mono text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {analysis.totalAppliedLoadKN.toFixed(1)} kN
            </div>
            <div className="text-xs font-mono text-slate-500 mt-1">
              Across {loads.length} Applied Point Vectors
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Estimated Truss Mass
            </div>
            <div className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {analysis.totalBridgeMassKg.toFixed(0)} kg
            </div>
            <div className="text-xs font-mono text-slate-500 mt-1">
              {beams.length} Structural Members
            </div>
          </div>
        </div>

        {/* ====================================================================
            SECTION 3: BEAM STRESS & INLINE MATERIAL SCHEDULE TABLE
            ==================================================================== */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-display font-bold text-slate-900 dark:text-slate-100">
                01. Structural Beam Stress &amp; Material Schedule
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Change any beam&apos;s material or cross-section directly in the
                table to recalculate global stiffness and stress levels.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2.5 px-4">Beam</th>
                  <th className="py-2.5 px-3">
                    Material Specification (Editable)
                  </th>
                  <th className="py-2.5 px-3 text-right">Area (cm²)</th>
                  <th className="py-2.5 px-3 text-right">Length (m)</th>
                  <th className="py-2.5 px-3 text-right">Force (kN)</th>
                  <th className="py-2.5 px-3 text-right">Stress |σ| (MPa)</th>
                  <th className="py-2.5 px-3 text-right">Yield σy (MPa)</th>
                  <th className="py-2.5 px-3 text-right">Utilization</th>
                  <th className="py-2.5 px-4 text-right">Safety Factor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                {beams.map((beam) => {
                  const r = analysis.beams[beam.id];
                  if (!r) return null;
                  const urPct = r.utilizationRatio * 100;

                  return (
                    <tr
                      key={beam.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-bold">
                        <button
                          onClick={() => onSelectBeamIn3D(beam.id)}
                          className="inline-flex items-center gap-1.5 text-slate-900 dark:text-slate-100 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: r.stressColorHex }}
                          />
                          <span>{beam.id}</span>
                          <span className="text-[10px] font-normal text-slate-400">
                            ({beam.startNodeId}→{beam.endNodeId})
                          </span>
                          <ArrowUpRight className="w-3 h-3 text-slate-400 no-print" />
                        </button>
                      </td>
                      <td className="py-2 px-3 font-sans">
                        <select
                          value={beam.materialId}
                          onChange={(e) =>
                            onUpdateBeam(beam.id, {
                              materialId: e.target.value,
                              customYieldMPa: undefined,
                            })
                          }
                          className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          {MATERIAL_LIBRARY.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.shortName} (σy={m.yieldStrengthMPa} MPa, E=
                              {m.youngsModulusGPa} GPa)
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min={2}
                          max={100}
                          value={beam.crossSectionAreaCm2}
                          onChange={(e) =>
                            onUpdateBeam(beam.id, {
                              crossSectionAreaCm2: Math.max(
                                2,
                                Number(e.target.value)
                              ),
                            })
                          }
                          className="w-16 text-right px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                        {r.lengthM.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={
                            r.forceState === 'Tension'
                              ? 'text-sky-600 dark:text-sky-400 font-semibold'
                              : r.forceState === 'Compression'
                              ? 'text-amber-600 dark:text-amber-400 font-semibold'
                              : 'text-slate-400'
                          }
                        >
                          {Math.abs(r.axialForceKN).toFixed(1)}{' '}
                          {r.forceState === 'Tension'
                            ? '(T)'
                            : r.forceState === 'Compression'
                            ? '(C)'
                            : ''}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {r.absStressMPa.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        {r.effectiveYieldMPa}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className="inline-flex items-center gap-1 font-bold"
                          style={{ color: r.stressColorHex }}
                        >
                          {r.utilizationRatio >= 0.8 ? (
                            <ShieldAlert className="w-3.5 h-3.5" />
                          ) : (
                            <ShieldCheck className="w-3.5 h-3.5" />
                          )}
                          {urPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-slate-800 dark:text-slate-200">
                        {r.safetyFactor >= 99 ? '∞' : r.safetyFactor.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ====================================================================
            SECTION 4: JOINT DISPLACEMENTS & SUPPORT REACTIONS TABLE
            ==================================================================== */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-display font-bold text-slate-900 dark:text-slate-100">
              02. Joint Coordinates, Displacements &amp; Support Reactions
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2.5 px-4">Joint</th>
                  <th className="py-2.5 px-3">Coordinates (X, Y)</th>
                  <th className="py-2.5 px-3">Boundary Support</th>
                  <th className="py-2.5 px-3 text-right">Δx (mm)</th>
                  <th className="py-2.5 px-3 text-right">Δy (mm)</th>
                  <th className="py-2.5 px-3 text-right">Reaction Rx (kN)</th>
                  <th className="py-2.5 px-3 text-right">Reaction Ry (kN)</th>
                  <th className="py-2.5 px-4 text-right">Inspect FBD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                {nodes.map((n) => {
                  const nr = analysis.nodes[n.id];
                  if (!nr) return null;
                  return (
                    <tr
                      key={n.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                        Joint {n.id}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        ({n.x.toFixed(2)}m, {n.y.toFixed(2)}m)
                      </td>
                      <td className="py-2.5 px-3 uppercase text-sky-600 dark:text-sky-400">
                        {n.support}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {nr.dxMm.toFixed(3)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {nr.dyMm.toFixed(3)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                        {Math.abs(nr.reactionRxKN) > 0.01
                          ? `${nr.reactionRxKN.toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {Math.abs(nr.reactionRyKN) > 0.01
                          ? `${nr.reactionRyKN.toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right no-print">
                        <button
                          onClick={() => onSelectNodeFBD(n.id)}
                          className="text-sky-600 dark:text-sky-400 hover:underline font-sans font-medium cursor-pointer"
                        >
                          Open Joint {n.id} FBD →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
