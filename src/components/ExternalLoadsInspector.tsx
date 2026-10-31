/**
 * ============================================================================
 * FILE: src/components/ExternalLoadsInspector.tsx
 * DESCRIPTION:
 * Interactive External Force & Point Load Customizer Panel.
 * Allows users to:
 * 1. Customize the strength (magnitude in kN) of each external force acting on the bridge.
 * 2. Reassign the exact structural joint (Node A, B, C, ...) where each force acts.
 * 3. Adjust the force vector angle (e.g. -90° downward gravity, angled wind/cable loads, or horizontal thrust).
 * 4. Add new external point loads or remove existing loads.
 * 5. Observe in real time how changing external force strength or joint location
 *    alters the internal axial stress and utilization % across every beam of the bridge.
 * ============================================================================
 */

import React from 'react';
import {
  StructuralNode,
  StructuralBeam,
  ExternalLoad,
  StructuralAnalysisSummary,
} from '../types/structural';
import {
  Plus,
  Trash2,
  ArrowDown,
  Compass,
  Activity,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

/**
 * Props for the ExternalLoadsInspector component.
 */
interface ExternalLoadsInspectorProps {
  /** All structural joints available as load attachment points. */
  nodes: StructuralNode[];
  /** All structural beams for the live stress response monitor. */
  beams: StructuralBeam[];
  /** Current array of external point loads acting on the bridge. */
  loads: ExternalLoad[];
  /** Real-time Direct Stiffness Solver output summary. */
  analysis: StructuralAnalysisSummary;
  /** Currently selected load ID (if clicked in 3D or editor). */
  selectedLoadId: string | null;
  /** Callback to update the array of external loads. */
  onUpdateLoads: (loads: ExternalLoad[]) => void;
  /** Callback to focus a specific joint in the 3D viewport. */
  onSelectNode: (nodeId: string) => void;
  /** Callback to inspect a specific beam's material properties. */
  onSelectBeam: (beamId: string) => void;
}

/**
 * Quick-select angle presets for common engineering load directions.
 */
const ANGLE_PRESETS = [
  { label: '↓ Down (-90°)', deg: -90 },
  { label: '↙ Left-Down (-120°)', deg: -120 },
  { label: '↘ Right-Down (-60°)', deg: -60 },
  { label: '→ Right (0°)', deg: 0 },
  { label: '← Left (180°)', deg: 180 },
  { label: '↑ Up (+90°)', deg: 90 },
];

/**
 * Renders the interactive External Forces Customizer and real-time beam stress
 * impact monitor.
 */
export const ExternalLoadsInspector: React.FC<ExternalLoadsInspectorProps> = ({
  nodes,
  beams,
  loads,
  analysis,
  selectedLoadId,
  onUpdateLoads,
  onSelectNode,
  onSelectBeam,
}) => {
  /**
   * Updates a single ExternalLoad item by ID and automatically refreshes its label
   * so schematics and 3D tooltips stay synchronized.
   */
  const handlePatchLoad = (loadId: string, patch: Partial<ExternalLoad>) => {
    onUpdateLoads(
      loads.map((item) => {
        if (item.id !== loadId) return item;
        const updated = { ...item, ...patch };
        updated.label = `P_${updated.nodeId} = ${updated.magnitudeKN} kN`;
        return updated;
      })
    );
  };

  /**
   * Appends a new external point load onto a default free joint (or the first available joint).
   */
  const handleAddExternalForce = () => {
    const preferredNode =
      nodes.find((n) => n.support === 'none') || nodes[0];
    if (!preferredNode) return;

    const nextIdx = loads.length + 1;
    const newLoad: ExternalLoad = {
      id: `L${Date.now().toString().slice(-4)}`,
      nodeId: preferredNode.id,
      magnitudeKN: 80,
      angleDeg: -90,
      label: `P${nextIdx} = 80 kN`,
    };
    onUpdateLoads([...loads, newLoad]);
  };

  /**
   * Deletes an external force vector by ID.
   */
  const handleDeleteLoad = (loadId: string) => {
    onUpdateLoads(loads.filter((l) => l.id !== loadId));
  };

  /**
   * Scales all external forces proportionally (e.g., 0.5x, 1.25x) for rapid overload testing.
   */
  const handleScaleAllLoads = (multiplier: number) => {
    onUpdateLoads(
      loads.map((l) => {
        const nextMag = Math.max(5, Math.min(500, Math.round(l.magnitudeKN * multiplier)));
        return {
          ...l,
          magnitudeKN: nextMag,
          label: `P_${l.nodeId} = ${nextMag} kN`,
        };
      })
    );
  };

  // Sort beams by highest stress utilization so the user immediately sees which beams are most affected
  const sortedBeams = [...beams].sort((a, b) => {
    const urA = analysis.beams[a.id]?.utilizationRatio || 0;
    const urB = analysis.beams[b.id]?.utilizationRatio || 0;
    return urB - urA;
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
      {/* ====================================================================
          SECTION 1: HEADER & GLOBAL LOAD SUMMARY
          Displays total applied force (kN) and quick buttons to add or scale forces.
          ==================================================================== */}
      <div className="p-4 bg-slate-50/70 dark:bg-slate-900/50 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              External Force &amp; Joint Load Customizer
            </span>
            <h3 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
              Applied Bridge Forces ({loads.length})
            </h3>
          </div>
          <div className="text-right font-mono">
            <div className="text-sm font-bold text-amber-600 dark:text-amber-400">
              ∑|P| = {analysis.totalAppliedLoadKN.toFixed(0)} kN
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Peak Stress: {(analysis.maxUtilizationRatio * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            onClick={handleAddExternalForce}
            className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add External Force Vector
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleScaleAllLoads(0.8)}
              className="px-2.5 py-2 text-xs font-mono font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              title="Decrease all external forces by 20%"
            >
              -20%
            </button>
            <button
              onClick={() => handleScaleAllLoads(1.25)}
              className="px-2.5 py-2 text-xs font-mono font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              title="Increase all external forces by 25%"
            >
              +25%
            </button>
          </div>
        </div>
      </div>

      {/* ====================================================================
          SECTION 2: INDIVIDUAL EXTERNAL FORCE CARDS
          Lets the user choose which Joint (A, B, C...) each force acts on,
          customize its strength in kN via slider or number box, and set its angle.
          ==================================================================== */}
      <div className="p-4 space-y-3 bg-white dark:bg-[#0B1120]">
        {loads.length === 0 ? (
          <div className="p-6 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 space-y-2">
            <p>No external forces are currently acting on the bridge.</p>
            <button
              onClick={handleAddExternalForce}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold hover:bg-amber-500/30"
            >
              + Add First Point Load
            </button>
          </div>
        ) : (
          loads.map((load, idx) => {
            const isHighlighted = selectedLoadId === load.id;
            const rad = (load.angleDeg * Math.PI) / 180;
            const fx = load.magnitudeKN * Math.cos(rad);
            const fy = load.magnitudeKN * Math.sin(rad);

            return (
              <div
                key={load.id}
                className={`p-3.5 rounded-xl border transition-all space-y-3 ${
                  isHighlighted
                    ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-500 shadow-xs'
                    : 'bg-slate-50/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Card Top Row: Force Identifier + Target Joint Selector + Delete */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      P{idx + 1}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        Force Acting on Joint {load.nodeId}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                        Fx = {fx >= 0 ? `+${fx.toFixed(1)}` : fx.toFixed(1)} kN · Fy ={' '}
                        {fy >= 0 ? `+${fy.toFixed(1)}` : fy.toFixed(1)} kN
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteLoad(load.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                    title="Remove this external force"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Target Joint Selector Pills: Choose where the force acts */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
                    <span>Application Joint (Where Force Acts):</span>
                    <button
                      onClick={() => onSelectNode(load.nodeId)}
                      className="text-sky-600 dark:text-sky-400 hover:underline font-mono"
                    >
                      Inspect Joint {load.nodeId} FBD →
                    </button>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {nodes.map((node) => {
                      const active = node.id === load.nodeId;
                      return (
                        <button
                          key={node.id}
                          onClick={() =>
                            handlePatchLoad(load.id, { nodeId: node.id })
                          }
                          className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            active
                              ? 'bg-amber-500 text-slate-950 shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-400'
                          }`}
                        >
                          Joint {node.id}
                          {node.support !== 'none' ? ` (${node.support})` : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Force Strength (Magnitude in kN) Slider + Direct Number Input */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <ArrowDown className="w-3.5 h-3.5 text-amber-500" />
                      Force Strength (Magnitude):
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={600}
                        step={5}
                        value={load.magnitudeKN}
                        onChange={(e) =>
                          handlePatchLoad(load.id, {
                            magnitudeKN: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-20 px-2 py-0.5 text-right font-mono text-xs font-bold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                      <span className="font-mono text-xs font-semibold text-slate-500">
                        kN
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={400}
                    step={5}
                    value={load.magnitudeKN}
                    onChange={(e) =>
                      handlePatchLoad(load.id, {
                        magnitudeKN: Number(e.target.value),
                      })
                    }
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* Direction Angle Control & Quick Direction Presets */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5 text-sky-500" />
                      Force Vector Angle:
                    </span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {load.angleDeg}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={5}
                    value={load.angleDeg}
                    onChange={(e) =>
                      handlePatchLoad(load.id, {
                        angleDeg: Number(e.target.value),
                      })
                    }
                    className="w-full accent-sky-500 cursor-pointer mb-1.5"
                  />
                  <div className="flex items-center gap-1 flex-wrap">
                    {ANGLE_PRESETS.map((ap) => (
                      <button
                        key={ap.deg}
                        onClick={() =>
                          handlePatchLoad(load.id, { angleDeg: ap.deg })
                        }
                        className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          load.angleDeg === ap.deg
                            ? 'bg-sky-500/20 border-sky-500 text-sky-700 dark:text-sky-300 font-semibold'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {ap.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ====================================================================
          SECTION 3: REAL-TIME BEAM STRESS RESPONSE MONITOR
          Shows how the current external forces affect stress across all beams.
          ==================================================================== */}
      <div className="p-4 space-y-3 bg-slate-50/40 dark:bg-slate-900/30">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-sky-500" />
            Live Beam Stress Impact Across Bridge
          </h4>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Sorted by Peak Stress
          </span>
        </div>

        <div className="space-y-2">
          {sortedBeams.map((beam) => {
            const bRes = analysis.beams[beam.id];
            if (!bRes) return null;
            const urPct = Math.min(999, bRes.utilizationRatio * 100);

            return (
              <div
                key={beam.id}
                onClick={() => onSelectBeam(beam.id)}
                className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500/60 transition-colors cursor-pointer space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: bRes.stressColorHex }}
                    />
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      Beam {beam.id}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      ({bRes.material.shortName})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-slate-600 dark:text-slate-400">
                      {Math.abs(bRes.axialForceKN).toFixed(1)} kN (
                      {bRes.forceState === 'Tension'
                        ? 'T'
                        : bRes.forceState === 'Compression'
                        ? 'C'
                        : '0'}
                      )
                    </span>
                    <span
                      className="font-bold flex items-center gap-1"
                      style={{ color: bRes.stressColorHex }}
                    >
                      {bRes.utilizationRatio >= 0.8 ? (
                        <ShieldAlert className="w-3 h-3" />
                      ) : (
                        <ShieldCheck className="w-3 h-3" />
                      )}
                      {urPct.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Live Stress Bar */}
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${Math.min(100, urPct)}%`,
                      backgroundColor: bRes.stressColorHex,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
