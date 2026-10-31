/**
 * ============================================================================
 * FILE: src/components/BeamMaterialInspector.tsx
 * DESCRIPTION:
 * Per-Beam Material & Cross-Section Customizer Panel.
 * Allows users to select any individual beam on the bridge, inspect its live
 * axial stress vs. yield threshold, swap its material (Steel, Aluminum, Timber,
 * Carbon Fiber, Wrought Iron), override custom yield/modulus limits, or adjust
 * its cross-sectional area and 3D profile shape.
 * ============================================================================
 */

import React from 'react';
import {
  StructuralBeam,
  StructuralAnalysisSummary,
  BeamProfileType,
} from '../types/structural';
import { MATERIAL_LIBRARY } from '../data/materialsAndPresets';
import {
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Layers,
  RotateCcw,
} from 'lucide-react';

/**
 * Props accepted by the BeamMaterialInspector component.
 */
interface BeamMaterialInspectorProps {
  /** Array of all structural beams in the bridge. */
  beams: StructuralBeam[];
  /** Computed Direct Stiffness analysis summary. */
  analysis: StructuralAnalysisSummary;
  /** Currently selected beam ID. */
  selectedBeamId: string | null;
  /** Callback to select a different beam. */
  onSelectBeam: (beamId: string) => void;
  /** Callback to jump to one of the beam's endpoint Joint FBDs. */
  onSelectNode: (nodeId: string) => void;
  /** Callback to update an individual beam's material or geometry properties. */
  onUpdateBeam: (beamId: string, patch: Partial<StructuralBeam>) => void;
  /** Callback to batch-assign a material across a structural role or all beams. */
  onBatchAssignMaterial: (
    materialId: string,
    scope: 'role' | 'all',
    targetRole?: string
  ) => void;
}

/**
 * Human-readable status descriptions for each semantic stress utilization band.
 */
const STATUS_LABELS: Record<string, { label: string; desc: string }> = {
  nominal: { label: 'NOMINAL', desc: 'Safe elastic operating stress' },
  moderate: { label: 'MODERATE', desc: 'Moderate working stress level' },
  elevated: { label: 'ELEVATED', desc: 'Approaching upper design threshold' },
  critical: { label: 'CRITICAL', desc: 'Close to material yield limit (>80%)' },
  overstressed: {
    label: 'OVERSTRESSED',
    desc: 'Exceeds yield strength — upgrade material or section!',
  },
};

/**
 * Renders the Per-Beam Material & Cross-Section Customizer panel.
 */
export const BeamMaterialInspector: React.FC<BeamMaterialInspectorProps> = ({
  beams,
  analysis,
  selectedBeamId,
  onSelectBeam,
  onSelectNode,
  onUpdateBeam,
  onBatchAssignMaterial,
}) => {
  // Default to the selected beam, or the highest-stressed critical beam
  const activeBeamId = selectedBeamId || analysis.criticalBeamId || beams[0]?.id;
  const activeBeam = beams.find((b) => b.id === activeBeamId);
  const beamRes = activeBeamId ? analysis.beams[activeBeamId] : undefined;

  if (!activeBeam || !beamRes) {
    return (
      <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
        Click any beam on the 3D bridge to inspect its stress and customize its material.
      </div>
    );
  }

  const utilizationPct = Math.min(999, beamRes.utilizationRatio * 100);
  const statusInfo = STATUS_LABELS[beamRes.status] || STATUS_LABELS.nominal;

  return (
    <div className="flex flex-col h-full overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
      {/* ====================================================================
          SECTION 1: BEAM HEADER & QUICK BEAM SWITCHER STRIP
          Shows active beam ID, connected joints, and color-coded beam pills.
          ==================================================================== */}
      <div className="p-4 bg-slate-50/70 dark:bg-slate-900/50">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Individual Beam Material &amp; Stress Inspector
            </span>
            <h3 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Beam {activeBeam.id}</span>
              <span className="text-xs font-mono font-normal text-slate-500 dark:text-slate-400">
                (Joint {activeBeam.startNodeId} → Joint {activeBeam.endNodeId})
              </span>
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onSelectNode(activeBeam.startNodeId)}
              className="px-2 py-1 text-[11px] font-mono rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-sky-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              FBD {activeBeam.startNodeId}
            </button>
            <button
              onClick={() => onSelectNode(activeBeam.endNodeId)}
              className="px-2 py-1 text-[11px] font-mono rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-sky-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              FBD {activeBeam.endNodeId}
            </button>
          </div>
        </div>

        {/* Color-Coded Quick Beam Switcher */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          {beams.map((b) => {
            const bAnalysis = analysis.beams[b.id];
            const isSelected = b.id === activeBeam.id;
            return (
              <button
                key={b.id}
                onClick={() => onSelectBeam(b.id)}
                className={`px-2 py-1 text-xs font-mono font-semibold rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-xs shrink-0"
                  style={{
                    backgroundColor: bAnalysis?.stressColorHex || '#10B981',
                  }}
                />
                <span>{b.id}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ====================================================================
          SECTION 2: REAL-TIME STRESS UTILIZATION GAUGE & TELEMETRY CARDS
          Displays normal stress |sigma|, axial force N, modulus E, and FoS.
          ==================================================================== */}
      <div className="p-4 space-y-3 bg-white dark:bg-[#0B1120]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {beamRes.utilizationRatio >= 0.8 ? (
              <ShieldAlert
                className="w-4 h-4 shrink-0"
                style={{ color: beamRes.stressColorHex }}
              />
            ) : (
              <ShieldCheck
                className="w-4 h-4 shrink-0"
                style={{ color: beamRes.stressColorHex }}
              />
            )}
            <span
              className="font-mono text-xs font-bold tracking-wide"
              style={{ color: beamRes.stressColorHex }}
            >
              {statusInfo.label} · {utilizationPct.toFixed(1)}% OF YIELD
            </span>
          </div>
          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
            FoS ={' '}
            {beamRes.safetyFactor >= 99 ? '∞' : beamRes.safetyFactor.toFixed(2)}
          </span>
        </div>

        {/* Utilization Progress Bar */}
        <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{
              width: `${Math.min(100, utilizationPct)}%`,
              backgroundColor: beamRes.stressColorHex,
            }}
          />
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          {statusInfo.desc}
        </p>

        {/* 2x2 Key Engineering Metrics Grid */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Applied Normal Stress |σ|
            </div>
            <div className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {beamRes.absStressMPa.toFixed(1)} MPa
              <span className="text-xs font-normal text-slate-500 ml-1">
                / {beamRes.effectiveYieldMPa} MPa
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Internal Axial Force (N)
            </div>
            <div className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {Math.abs(beamRes.axialForceKN).toFixed(1)} kN
              <span className="text-xs font-normal text-slate-500 ml-1">
                ({beamRes.forceState})
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Young&apos;s Modulus &amp; Length
            </div>
            <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              E = {beamRes.effectiveYoungsGPa} GPa · L ={' '}
              {beamRes.lengthM.toFixed(2)}m
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Elongation ΔL &amp; Mass
            </div>
            <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              {beamRes.elongationMm >= 0 ? '+' : ''}
              {beamRes.elongationMm.toFixed(2)} mm · {beamRes.massKg.toFixed(1)}{' '}
              kg
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          SECTION 3: PER-BEAM MATERIAL LIBRARY SELECTOR
          Lets the user swap this individual beam's material and previews how
          the new yield strength affects stress utilization.
          ==================================================================== */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-500" />
            Select Material for Beam {activeBeam.id}
          </h4>
          {(activeBeam.customYieldMPa !== undefined ||
            activeBeam.customYoungsGPa !== undefined) && (
            <button
              onClick={() =>
                onUpdateBeam(activeBeam.id, {
                  customYieldMPa: undefined,
                  customYoungsGPa: undefined,
                })
              }
              className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Custom Specs
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2">
          {MATERIAL_LIBRARY.map((mat) => {
            const isSelected = activeBeam.materialId === mat.id;
            const previewUR =
              (beamRes.absStressMPa / mat.yieldStrengthMPa) * 100;

            return (
              <button
                key={mat.id}
                onClick={() =>
                  onUpdateBeam(activeBeam.id, {
                    materialId: mat.id,
                    customYieldMPa: undefined,
                    customYoungsGPa: undefined,
                  })
                }
                className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                  isSelected
                    ? 'bg-sky-50/90 dark:bg-sky-950/40 border-sky-500 shadow-2xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-xs shrink-0 border border-black/15"
                      style={{ backgroundColor: mat.colorHex }}
                    />
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {mat.name}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                    Yield σy = {mat.yieldStrengthMPa} MPa · E ={' '}
                    {mat.youngsModulusGPa} GPa · ρ = {mat.densityKgM3} kg/m³
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div
                    className={`font-mono text-xs font-bold ${
                      previewUR >= 100
                        ? 'text-red-600 dark:text-red-400'
                        : previewUR >= 80
                        ? 'text-orange-500'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {previewUR.toFixed(0)}% Yield
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {isSelected ? 'Active' : 'Click to Apply'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Batch Material Assignment Buttons */}
        <div className="flex items-center gap-2 pt-1">
          {activeBeam.role && (
            <button
              onClick={() =>
                onBatchAssignMaterial(
                  activeBeam.materialId,
                  'role',
                  activeBeam.role
                )
              }
              className="flex-1 py-1.5 px-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors whitespace-nowrap truncate cursor-pointer"
            >
              Apply {beamRes.material.shortName} to All{' '}
              {activeBeam.role.replace('_', ' ')}s
            </button>
          )}
          <button
            onClick={() => onBatchAssignMaterial(activeBeam.materialId, 'all')}
            className="py-1.5 px-3 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Apply to All Beams
          </button>
        </div>
      </div>

      {/* ====================================================================
          SECTION 4: CROSS-SECTION AREA & CUSTOM YIELD OVERRIDE SLIDERS
          ==================================================================== */}
      <div className="p-4 space-y-3.5 bg-slate-50/40 dark:bg-slate-900/30">
        <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-sky-500" />
          Cross-Section &amp; Custom Material Overrides
        </h4>

        {/* Cross-Section Area Slider */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-600 dark:text-slate-400">
              Cross-Sectional Area (A)
            </span>
            <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {activeBeam.crossSectionAreaCm2} cm²
            </span>
          </div>
          <input
            type="range"
            min={4}
            max={60}
            step={1}
            value={activeBeam.crossSectionAreaCm2}
            onChange={(e) =>
              onUpdateBeam(activeBeam.id, {
                crossSectionAreaCm2: Number(e.target.value),
              })
            }
            className="w-full accent-sky-600 cursor-pointer"
          />
        </div>

        {/* Custom Yield Strength Override Slider */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-600 dark:text-slate-400">
              Max Allowable Yield Stress (σ_yield)
            </span>
            <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {beamRes.effectiveYieldMPa} MPa
            </span>
          </div>
          <input
            type="range"
            min={25}
            max={700}
            step={5}
            value={beamRes.effectiveYieldMPa}
            onChange={(e) =>
              onUpdateBeam(activeBeam.id, {
                customYieldMPa: Number(e.target.value),
              })
            }
            className="w-full accent-sky-600 cursor-pointer"
          />
        </div>

        {/* 3D Cross-Section Profile Selector */}
        <div>
          <div className="text-xs text-slate-600 dark:text-slate-400 mb-1.5">
            3D Structural Profile Geometry
          </div>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(
              [
                { id: 'i_beam', label: 'Wide-Flange I' },
                { id: 'box_girder', label: 'Box Girder' },
                { id: 'tubular', label: 'Hollow Tube' },
              ] as { id: BeamProfileType; label: string }[]
            ).map((prof) => (
              <button
                key={prof.id}
                onClick={() =>
                  onUpdateBeam(activeBeam.id, { profile: prof.id })
                }
                className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeBeam.profile === prof.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {prof.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
