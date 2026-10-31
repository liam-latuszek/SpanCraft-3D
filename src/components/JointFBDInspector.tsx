/**
 * ============================================================================
 * FILE: src/components/JointFBDInspector.tsx
 * DESCRIPTION:
 * Interactive Joint Free Body Diagram (FBD) & Static Equilibrium Inspector.
 * When a user clicks any structural joint (Node A, B, C, ...), this component
 * isolates the pin joint and renders a polar SVG Free Body Diagram displaying
 * all concurrent internal member forces (Tension pulling away, Compression
 * pushing into the pin), external loads, and support reactions, followed by
 * step-by-step symbolic and numeric equilibrium equations (∑Fx = 0, ∑Fy = 0).
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  StructuralNode,
  StructuralAnalysisSummary,
  JointEquilibriumAnalysis,
} from '../types/structural';
import {
  CheckCircle2,
  AlertTriangle,
  Compass,
  ArrowUpRight,
  Layers,
} from 'lucide-react';

/**
 * Props accepted by the JointFBDInspector component.
 */
interface JointFBDInspectorProps {
  /** Array of all structural joints in the bridge. */
  nodes: StructuralNode[];
  /** Computed Direct Stiffness analysis summary containing `jointFBDs`. */
  analysis: StructuralAnalysisSummary;
  /** Currently selected joint ID. */
  selectedNodeId: string | null;
  /** Callback to switch the active joint being inspected. */
  onSelectNode: (nodeId: string) => void;
  /** Callback to jump to a connected beam's material customizer. */
  onSelectBeam: (beamId: string) => void;
}

/**
 * Renders the Joint Free Body Diagram polar vector canvas, equilibrium
 * equations, and concurrent force table.
 */
export const JointFBDInspector: React.FC<JointFBDInspectorProps> = ({
  nodes,
  analysis,
  selectedNodeId,
  onSelectNode,
  onSelectBeam,
}) => {
  // Local UI toggles for dashed Fx/Fy right-triangle projections and angle labels
  const [showProjections, setShowProjections] = useState(true);
  const [showAngles, setShowAngles] = useState(true);

  // Resolve the active joint's equilibrium data
  const activeNodeId = selectedNodeId || nodes[0]?.id || 'A';
  const fbd: JointEquilibriumAnalysis | undefined =
    analysis.jointFBDs[activeNodeId];
  const nodeRes = analysis.nodes[activeNodeId];

  if (!fbd || !nodeRes) {
    return (
      <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
        Select any joint on the 3D bridge to inspect its Free Body Diagram.
      </div>
    );
  }

  // Compute maximum force magnitude at this joint to normalize SVG vector arrow lengths
  const maxForce = Math.max(...fbd.vectors.map((v) => v.magnitudeKN), 10);

  const svgSize = 360;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const minArrowRadius = 56;
  const maxArrowRadius = 128;

  return (
    <div className="flex flex-col h-full overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
      {/* ====================================================================
          SECTION 1: JOINT SELECTOR HEADER STRIP
          Displays active joint coordinates, support condition, and quick-switch buttons.
          ==================================================================== */}
      <div className="p-4 bg-slate-50/70 dark:bg-slate-900/50">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Active Joint Equilibrium Inspector
            </span>
            <h3 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
              Joint {fbd.nodeId} · Free Body Diagram
            </h3>
          </div>
          <div className="text-right font-mono text-xs text-slate-600 dark:text-slate-400">
            <div>
              ({fbd.x.toFixed(1)}m, {fbd.y.toFixed(1)}m)
            </div>
            <div className="text-[11px] text-sky-600 dark:text-sky-400">
              Support: {fbd.support.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Quick Joint Switcher Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          {nodes.map((n) => {
            const active = n.id === activeNodeId;
            return (
              <button
                key={n.id}
                onClick={() => onSelectNode(n.id)}
                className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-sky-500'
                }`}
              >
                Joint {n.id}
              </button>
            );
          })}
        </div>
      </div>

      {/* ====================================================================
          SECTION 2: INTERACTIVE POLAR SVG FREE BODY DIAGRAM
          Draws coordinate axes, reference circles, and all concurrent force vectors.
          ==================================================================== */}
      <div className="p-4 flex flex-col items-center bg-white dark:bg-[#0B1120]">
        <div className="w-full flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-sky-500" />
            Isolated Pin Equilibrium Schematic
          </span>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md">
            <button
              onClick={() => setShowProjections((v) => !v)}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showProjections
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Fx/Fy Components
            </button>
            <button
              onClick={() => setShowAngles((v) => !v)}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showAngles
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Angles θ
            </button>
          </div>
        </div>

        <div className="relative w-full max-w-[360px] aspect-square rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 overflow-hidden">
          <svg viewBox={`0 0 ${svgSize} ${svgSize}`} className="w-full h-full">
            <defs>
              {fbd.vectors.map((v) => (
                <marker
                  key={`marker-${v.id}`}
                  id={`arrow-${v.id}`}
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.2 L 10 5 L 0 8.8 z" fill={v.colorHex} />
                </marker>
              ))}
            </defs>

            {/* Polar Reference Circles */}
            <circle
              cx={cx}
              cy={cy}
              r={55}
              fill="none"
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-800"
              strokeDasharray="3 3"
            />
            <circle
              cx={cx}
              cy={cy}
              r={110}
              fill="none"
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-800"
              strokeDasharray="3 3"
            />

            {/* Orthogonal Coordinate Axes (+X, +Y) */}
            <line
              x1={20}
              y1={cy}
              x2={svgSize - 20}
              y2={cy}
              stroke="currentColor"
              className="text-slate-300 dark:text-slate-700"
              strokeWidth="1.2"
            />
            <line
              x1={cx}
              y1={20}
              x2={cx}
              y2={svgSize - 20}
              stroke="currentColor"
              className="text-slate-300 dark:text-slate-700"
              strokeWidth="1.2"
            />
            <text
              x={svgSize - 26}
              y={cy - 6}
              className="fill-slate-400 dark:fill-slate-500 font-mono text-[10px]"
            >
              +X
            </text>
            <text
              x={cx + 6}
              y={28}
              className="fill-slate-400 dark:fill-slate-500 font-mono text-[10px]"
            >
              +Y
            </text>

            {/* Concurrent Force Vector Arrows */}
            {fbd.vectors.map((v) => {
              if (v.magnitudeKN < 0.02) return null;
              const rad = (v.angleDeg * Math.PI) / 180;
              const ux = Math.cos(rad);
              const uy = -Math.sin(rad); // SVG Y axis points downward

              const len =
                minArrowRadius +
                (v.magnitudeKN / maxForce) * (maxArrowRadius - minArrowRadius);

              const endX = cx + ux * len;
              const endY = cy + uy * len;
              const startX = cx + ux * 16;
              const startY = cy + uy * 16;

              // Compression members push INTO the joint pin; Tension pulls AWAY
              const pushesIntoJoint =
                v.sourceType === 'member' && v.memberState === 'Compression';

              const lineX1 = pushesIntoJoint ? endX : startX;
              const lineY1 = pushesIntoJoint ? endY : startY;
              const lineX2 = pushesIntoJoint ? startX : endX;
              const lineY2 = pushesIntoJoint ? startY : endY;

              const labelX = cx + ux * (len + 22);
              const labelY = cy + uy * (len + 22);

              return (
                <g
                  key={v.id}
                  className={v.beamId ? 'cursor-pointer hover:opacity-85' : ''}
                  onClick={() => {
                    if (v.beamId) onSelectBeam(v.beamId);
                  }}
                >
                  {/* Optional Right-Triangle Component Projections */}
                  {showProjections &&
                    Math.abs(v.fxKN) > 0.5 &&
                    Math.abs(v.fyKN) > 0.5 && (
                      <>
                        <line
                          x1={cx}
                          y1={cy}
                          x2={endX}
                          y2={cy}
                          stroke={v.colorHex}
                          strokeWidth="1.2"
                          strokeDasharray="3 3"
                          strokeOpacity="0.55"
                        />
                        <line
                          x1={endX}
                          y1={cy}
                          x2={endX}
                          y2={endY}
                          stroke={v.colorHex}
                          strokeWidth="1.2"
                          strokeDasharray="3 3"
                          strokeOpacity="0.55"
                        />
                      </>
                    )}

                  {/* Angle Label */}
                  {showAngles && (
                    <text
                      x={cx + ux * 42}
                      y={cy + uy * 42}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="font-mono text-[9px] fill-slate-500 dark:fill-slate-400"
                    >
                      {v.angleDeg.toFixed(0)}°
                    </text>
                  )}

                  {/* Vector Shaft & Arrowhead */}
                  <line
                    x1={lineX1}
                    y1={lineY1}
                    x2={lineX2}
                    y2={lineY2}
                    stroke={v.colorHex}
                    strokeWidth="3"
                    markerEnd={`url(#arrow-${v.id})`}
                  />

                  {/* Vector Force Label & Magnitude */}
                  <text
                    x={labelX}
                    y={labelY - 5}
                    textAnchor="middle"
                    className="font-mono text-[11px] font-bold"
                    fill={v.colorHex}
                  >
                    {v.label}
                  </text>
                  <text
                    x={labelX}
                    y={labelY + 7}
                    textAnchor="middle"
                    className="font-mono text-[10px] fill-slate-700 dark:fill-slate-300"
                  >
                    {v.magnitudeKN.toFixed(1)} kN
                  </text>
                </g>
              );
            })}

            {/* Central Isolated Joint Pin Circle */}
            <circle
              cx={cx}
              cy={cy}
              r={14}
              className="fill-slate-900 dark:fill-slate-100 stroke-sky-500"
              strokeWidth="3"
            />
            <text
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              className="font-display font-bold text-xs fill-white dark:fill-slate-900"
            >
              {fbd.nodeId}
            </text>
          </svg>
        </div>

        <div className="w-full flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2 px-1">
          <span>Arrows away = Tension (T)</span>
          <span>·</span>
          <span>Arrows into pin = Compression (C)</span>
        </div>
      </div>

      {/* ====================================================================
          SECTION 3: STEP-BY-STEP STATIC EQUILIBRIUM EQUATIONS (∑Fx=0, ∑Fy=0)
          Displays both symbolic trigonometric terms and evaluated kN values.
          ==================================================================== */}
      <div className="p-4 space-y-3 bg-slate-50/40 dark:bg-slate-900/30">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold tracking-wide text-slate-700 dark:text-slate-300">
            Step-by-Step Static Equilibrium Equations
          </h4>
          {fbd.isInEquilibrium ? (
            <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              ∑F = 0 Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-mono text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              Unbalanced
            </span>
          )}
        </div>

        {/* Horizontal Equilibrium ∑Fx = 0 */}
        <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Horizontal Force Summation (→ +)
          </div>
          <div className="font-mono text-xs text-slate-800 dark:text-slate-200 break-words leading-relaxed">
            {fbd.symbolicSumFx}
          </div>
          <div className="font-mono text-xs text-sky-600 dark:text-sky-400 break-words">
            {fbd.numericSumFx}
          </div>
        </div>

        {/* Vertical Equilibrium ∑Fy = 0 */}
        <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Vertical Force Summation (↑ +)
          </div>
          <div className="font-mono text-xs text-slate-800 dark:text-slate-200 break-words leading-relaxed">
            {fbd.symbolicSumFy}
          </div>
          <div className="font-mono text-xs text-emerald-600 dark:text-emerald-400 break-words">
            {fbd.numericSumFy}
          </div>
        </div>
      </div>

      {/* ====================================================================
          SECTION 4: CONCURRENT FORCE VECTOR BREAKDOWN TABLE
          Lists every force acting at this joint with clickable member links.
          ==================================================================== */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            Concurrent Forces at Joint {fbd.nodeId}
          </h4>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Click a member to change material
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 font-medium">
                <th className="py-2 px-2.5">Vector</th>
                <th className="py-2 px-2">State / Type</th>
                <th className="py-2 px-2 text-right">Mag (kN)</th>
                <th className="py-2 px-2 text-right">Fx (kN)</th>
                <th className="py-2 px-2.5 text-right">Fy (kN)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px]">
              {fbd.vectors.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => v.beamId && onSelectBeam(v.beamId)}
                  className={`${
                    v.beamId
                      ? 'cursor-pointer hover:bg-sky-50/70 dark:hover:bg-sky-950/30'
                      : ''
                  } transition-colors`}
                >
                  <td className="py-2 px-2.5 font-semibold flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: v.colorHex }}
                    />
                    <span>{v.label}</span>
                    {v.beamId && (
                      <ArrowUpRight className="w-3 h-3 text-slate-400 inline" />
                    )}
                  </td>
                  <td className="py-2 px-2 font-sans text-slate-600 dark:text-slate-400">
                    {v.subLabel}
                  </td>
                  <td className="py-2 px-2 text-right font-semibold text-slate-900 dark:text-slate-100">
                    {v.magnitudeKN.toFixed(1)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">
                    {v.fxKN >= 0 ? `+${v.fxKN.toFixed(1)}` : v.fxKN.toFixed(1)}
                  </td>
                  <td className="py-2 px-2.5 text-right text-slate-600 dark:text-slate-400">
                    {v.fyKN >= 0 ? `+${v.fyKN.toFixed(1)}` : v.fyKN.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
