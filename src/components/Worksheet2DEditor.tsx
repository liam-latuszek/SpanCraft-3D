/**
 * ============================================================================
 * FILE: src/components/Worksheet2DEditor.tsx
 * DESCRIPTION:
 * Interactive 2D Engineering Worksheet & Structural Graph Editor.
 * Takes an uploaded mechanical/civil engineering worksheet photo (or built-in
 * problem sheet) and overlays an interactive 2D structural vector graph
 * displaying all extracted Pin joints, Roller joints, beams, and external
 * force arrows. Users can drag joints, add/remove joints and beams, change
 * support types, customize external force strengths and target joints, and
 * configure the 3D Bridge Presumption (archetype, transverse width, and deck
 * placement) used by the 3D Simulation viewport.
 * ============================================================================
 */

import React, { useRef, useState } from 'react';
import {
  StructuralNode,
  StructuralBeam,
  ExternalLoad,
  StructuralAnalysisSummary,
  SupportType,
  Bridge3DPresumption,
} from '../types/structural';
import {
  Plus,
  Trash2,
  Move,
  Link2,
  Eye,
  Upload,
  Sparkles,
  CheckCircle2,
  Box,
  ArrowRight,
} from 'lucide-react';

/**
 * Props accepted by the Worksheet2DEditor component.
 */
interface Worksheet2DEditorProps {
  /** Array of 2D structural joints (nodes) and their support conditions. */
  nodes: StructuralNode[];
  /** Array of structural beams connecting joints. */
  beams: StructuralBeam[];
  /** Array of external point loads acting on joints. */
  loads: ExternalLoad[];
  /** Real-time Direct Stiffness Solver output summary. */
  analysis: StructuralAnalysisSummary;
  /** Data URL of the uploaded worksheet photo or generated problem sheet SVG. */
  worksheetImageUrl: string;
  /** Engineering notes describing extracted pin/roller supports and dimensions. */
  extractionNotes: string[];
  /** 3D extrapolation presumption parameters for the 3D bridge simulation. */
  presumption3D: Bridge3DPresumption;
  /** Callback to update the 3D bridge presumption parameters. */
  onUpdatePresumption3D: (presumption: Bridge3DPresumption) => void;
  /** Currently selected joint ID. */
  selectedNodeId: string | null;
  /** Currently selected beam ID. */
  selectedBeamId: string | null;
  /** Callback to select a joint. */
  onSelectNode: (nodeId: string) => void;
  /** Callback to select a beam. */
  onSelectBeam: (beamId: string) => void;
  /** Callback to update the array of joints. */
  onUpdateNodes: (nodes: StructuralNode[]) => void;
  /** Callback to update the array of beams. */
  onUpdateBeams: (beams: StructuralBeam[]) => void;
  /** Callback to update the array of external loads. */
  onUpdateLoads: (loads: ExternalLoad[]) => void;
  /** Callback to upload and scan a new worksheet photo via Gemini Vision. */
  onUploadWorksheetFile: (file: File) => void;
  /** True while the server is analyzing an uploaded worksheet image. */
  isAnalyzingWorksheet: boolean;
  /** Callback to switch directly to the 3D Simulation tab. */
  onSwitchTo3DSim: () => void;
}

/**
 * Renders the 2D Worksheet Editor with interactive SVG topology overlay,
 * photo dropzone/underlay, 3D bridge presumption customizer, and node/load editors.
 */
export const Worksheet2DEditor: React.FC<Worksheet2DEditorProps> = ({
  nodes,
  beams,
  loads,
  analysis,
  worksheetImageUrl,
  extractionNotes,
  presumption3D,
  onUpdatePresumption3D,
  selectedNodeId,
  selectedBeamId,
  onSelectNode,
  onSelectBeam,
  onUpdateNodes,
  onUpdateBeams,
  onUpdateLoads,
  onUploadWorksheetFile,
  isAnalyzingWorksheet,
  onSwitchTo3DSim,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active 2D canvas tool mode: select/drag joints, add a new joint, or connect two joints with a beam
  const [editorTool, setEditorTool] = useState<
    'select_move' | 'add_node' | 'connect_beam'
  >('select_move');
  const [connectStartNodeId, setConnectStartNodeId] = useState<string | null>(
    null
  );
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [underlayOpacity, setUnderlayOpacity] = useState<number>(0.38);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);

  // SVG internal coordinate dimensions and padding
  const canvasW = 900;
  const canvasH = 520;
  const padX = 130;
  const padY = 120;

  // Compute bounding box in meters to map between world (m) and SVG screen (px)
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 16);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 4);

  const spanX = Math.max(maxX - minX, 4);
  const spanY = Math.max(maxY - minY, 3);
  const scale = Math.min(
    (canvasW - padX * 2) / spanX,
    (canvasH - padY * 2) / spanY
  );

  /**
   * Converts horizontal meter coordinate `x` into SVG pixel X.
   */
  const toScreenX = (x: number) => padX + (x - minX) * scale;

  /**
   * Converts vertical meter coordinate `y` into SVG pixel Y (inverted Y axis).
   */
  const toScreenY = (y: number) => canvasH - padY - (y - minY) * scale;

  /**
   * Converts client pointer coordinates (px) back into world coordinates (meters),
   * applying 0.5m grid snapping when enabled.
   */
  const toWorldCoords = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * canvasW;
    const sy = ((clientY - rect.top) / rect.height) * canvasH;
    let wx = minX + (sx - padX) / scale;
    let wy = minY + (canvasH - padY - sy) / scale;
    if (snapToGrid) {
      wx = Math.round(wx * 2) / 2;
      wy = Math.round(wy * 2) / 2;
    } else {
      wx = Number(wx.toFixed(2));
      wy = Number(wy.toFixed(2));
    }
    return { x: wx, y: wy };
  };

  /**
   * Updates the dragged joint's 2D coordinates in real time as the pointer moves.
   */
  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingNodeId) return;
    const { x, y } = toWorldCoords(e.clientX, e.clientY);
    onUpdateNodes(
      nodes.map((n) => (n.id === draggingNodeId ? { ...n, x, y } : n))
    );
  };

  /**
   * Releases any active joint drag on pointer up.
   */
  const handleSvgPointerUp = () => {
    setDraggingNodeId(null);
  };

  /**
   * Adds a new structural joint at the clicked canvas location when in 'add_node' mode.
   */
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (editorTool !== 'add_node') return;
    if (
      (e.target as HTMLElement).tagName !== 'svg' &&
      (e.target as HTMLElement).tagName !== 'rect'
    ) {
      return;
    }
    const { x, y } = toWorldCoords(e.clientX, e.clientY);
    const usedIds = new Set(nodes.map((n) => n.id));
    let nextId = 'A';
    for (let code = 65; code <= 90; code++) {
      const candidate = String.fromCharCode(code);
      if (!usedIds.has(candidate)) {
        nextId = candidate;
        break;
      }
    }
    const newNode: StructuralNode = { id: nextId, x, y, support: 'none' };
    onUpdateNodes([...nodes, newNode]);
    onSelectNode(nextId);
    setEditorTool('select_move');
  };

  /**
   * Handles clicking a joint in the 2D canvas: either selects the joint or
   * connects two joints with a new structural beam when in 'connect_beam' mode.
   */
  const handleNodeClick = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editorTool === 'connect_beam') {
      if (!connectStartNodeId) {
        setConnectStartNodeId(nodeId);
      } else if (connectStartNodeId !== nodeId) {
        const exists = beams.some(
          (b) =>
            (b.startNodeId === connectStartNodeId && b.endNodeId === nodeId) ||
            (b.startNodeId === nodeId && b.endNodeId === connectStartNodeId)
        );
        if (!exists) {
          const newBeamId = `${connectStartNodeId}${nodeId}`;
          const newBeam: StructuralBeam = {
            id: newBeamId,
            startNodeId: connectStartNodeId,
            endNodeId: nodeId,
            materialId: 'steel_a36',
            crossSectionAreaCm2: 14,
            profile: 'i_beam',
            role: 'web_diagonal',
          };
          onUpdateBeams([...beams, newBeam]);
          onSelectBeam(newBeamId);
        }
        setConnectStartNodeId(null);
      }
    } else {
      onSelectNode(nodeId);
    }
  };

  const activeNode = nodes.find(
    (n) => n.id === (selectedNodeId || nodes[0]?.id)
  );

  return (
    <div className="flex flex-col lg:flex-row w-full h-full overflow-hidden bg-slate-100 dark:bg-[#0B1120]">
      {/* ====================================================================
          SECTION 1: INTERACTIVE 2D WORKSHEET CANVAS & TOOLBAR
          ==================================================================== */}
      <div className="flex-1 flex flex-col h-full overflow-hidden p-4">
        {/* Top Editor Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                onClick={() => {
                  setEditorTool('select_move');
                  setConnectStartNodeId(null);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  editorTool === 'select_move'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Move className="w-3.5 h-3.5" />
                Select &amp; Drag Joints
              </button>
              <button
                onClick={() => {
                  setEditorTool('add_node');
                  setConnectStartNodeId(null);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  editorTool === 'add_node'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Joint
              </button>
              <button
                onClick={() => {
                  setEditorTool('connect_beam');
                  setConnectStartNodeId(null);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  editorTool === 'connect_beam'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                {connectStartNodeId
                  ? `Click 2nd Joint (from ${connectStartNodeId})`
                  : 'Connect Beam'}
              </button>
            </div>

            <button
              onClick={() => setSnapToGrid((v) => !v)}
              className={`px-2.5 py-1.5 text-xs font-mono rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                snapToGrid
                  ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-400 text-sky-700 dark:text-sky-300'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              Snap 0.5m: {snapToGrid ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <Eye className="w-3.5 h-3.5" />
              <span>Photo Underlay:</span>
              <input
                type="range"
                min={0}
                max={0.9}
                step={0.05}
                value={underlayOpacity}
                onChange={(e) => setUnderlayOpacity(Number(e.target.value))}
                className="w-20 accent-sky-600 cursor-pointer"
              />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadWorksheetFile(file);
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzingWorksheet}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {isAnalyzingWorksheet
                ? 'Scanning Worksheet...'
                : 'Upload Worksheet Photo'}
            </button>

            <button
              onClick={onSwitchTo3DSim}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Box className="w-3.5 h-3.5" />
              <span>View 3D Presumed Bridge</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2D Interactive SVG Schematic with Uploaded Worksheet Underlay */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file && file.type.startsWith('image/')) {
              onUploadWorksheetFile(file);
            }
          }}
          className="relative flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden flex items-center justify-center"
        >
          {worksheetImageUrl && (
            <img
              src={worksheetImageUrl}
              alt="Engineering Worksheet Underlay"
              referrerPolicy="no-referrer"
              className="pointer-events-none absolute inset-0 w-full h-full object-contain transition-opacity"
              style={{ opacity: underlayOpacity }}
            />
          )}

          <svg
            ref={svgRef}
            viewBox={`0 0 ${canvasW} ${canvasH}`}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onClick={handleSvgClick}
            className="relative z-10 w-full h-full select-none"
          >
            <defs>
              <marker
                id="load-arrow-2d"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#F59E0B" />
              </marker>
            </defs>

            {/* Render Structural Beams */}
            {beams.map((b) => {
              const n1 = nodes.find((n) => n.id === b.startNodeId);
              const n2 = nodes.find((n) => n.id === b.endNodeId);
              if (!n1 || !n2) return null;
              const x1 = toScreenX(n1.x);
              const y1 = toScreenY(n1.y);
              const x2 = toScreenX(n2.x);
              const y2 = toScreenY(n2.y);
              const bRes = analysis.beams[b.id];
              const isSelected = selectedBeamId === b.id;

              return (
                <g
                  key={b.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBeam(b.id);
                  }}
                  className="cursor-pointer group"
                >
                  {isSelected && (
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#38BDF8"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeOpacity="0.35"
                    />
                  )}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={bRes?.stressColorHex || '#64748B'}
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  {/* Midpoint Force & Stress Readout */}
                  <rect
                    x={(x1 + x2) / 2 - 34}
                    y={(y1 + y2) / 2 - 11}
                    width="68"
                    height="22"
                    rx="4"
                    className="fill-white/95 dark:fill-slate-900/95 stroke-slate-300 dark:stroke-slate-700"
                    strokeWidth="1"
                  />
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 + 3}
                    textAnchor="middle"
                    className="font-mono text-[10px] font-bold fill-slate-800 dark:fill-slate-200"
                  >
                    {b.id}:{' '}
                    {bRes ? `${Math.abs(bRes.axialForceKN).toFixed(0)}kN` : ''}
                  </text>
                </g>
              );
            })}

            {/* Render External Point Loads */}
            {loads.map((l) => {
              const n = nodes.find((nd) => nd.id === l.nodeId);
              if (!n) return null;
              const sx = toScreenX(n.x);
              const sy = toScreenY(n.y);
              const rad = (l.angleDeg * Math.PI) / 180;
              const ux = Math.cos(rad);
              const uy = -Math.sin(rad);
              const len = 56;
              const startX = sx - ux * (len + 14);
              const startY = sy - uy * (len + 14);
              const endX = sx - ux * 14;
              const endY = sy - uy * 14;

              return (
                <g key={l.id}>
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke="#F59E0B"
                    strokeWidth="3.5"
                    markerEnd="url(#load-arrow-2d)"
                  />
                  <text
                    x={startX}
                    y={startY - 8}
                    textAnchor="middle"
                    className="font-mono text-xs font-bold fill-amber-600 dark:fill-amber-400"
                  >
                    {l.magnitudeKN} kN
                  </text>
                </g>
              );
            })}

            {/* Render Draggable Joints & Pin/Roller Symbols */}
            {nodes.map((n) => {
              const sx = toScreenX(n.x);
              const sy = toScreenY(n.y);
              const isSelected = selectedNodeId === n.id;
              const isConnectSource = connectStartNodeId === n.id;

              return (
                <g
                  key={n.id}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (editorTool === 'select_move') {
                      setDraggingNodeId(n.id);
                      onSelectNode(n.id);
                    }
                  }}
                  onClick={(e) => handleNodeClick(n.id, e)}
                  className="cursor-grab active:cursor-grabbing"
                >
                  {/* Pin Support Triangle Symbol */}
                  {n.support === 'pin' && (
                    <polygon
                      points={`${sx},${sy + 8} ${sx - 14},${sy + 28} ${
                        sx + 14
                      },${sy + 28}`}
                      fill="#0EA5E9"
                      fillOpacity="0.25"
                      stroke="#0284C7"
                      strokeWidth="2"
                    />
                  )}
                  {/* Roller Support Symbol */}
                  {n.support === 'roller_y' && (
                    <g>
                      <polygon
                        points={`${sx},${sy + 8} ${sx - 13},${sy + 24} ${
                          sx + 13
                        },${sy + 24}`}
                        fill="#10B981"
                        fillOpacity="0.25"
                        stroke="#059669"
                        strokeWidth="2"
                      />
                      <circle cx={sx - 6} cy={sy + 28} r="3.5" fill="#10B981" />
                      <circle cx={sx + 6} cy={sy + 28} r="3.5" fill="#10B981" />
                    </g>
                  )}

                  {(isSelected || isConnectSource) && (
                    <circle
                      cx={sx}
                      cy={sy}
                      r="17"
                      fill="none"
                      stroke={isConnectSource ? '#F59E0B' : '#0EA5E9'}
                      strokeWidth="2.5"
                      strokeDasharray="4 2"
                    />
                  )}

                  <circle
                    cx={sx}
                    cy={sy}
                    r="11"
                    className={`${
                      isSelected
                        ? 'fill-sky-600 stroke-white'
                        : 'fill-slate-900 dark:fill-slate-100 stroke-white dark:stroke-slate-900'
                    }`}
                    strokeWidth="2.5"
                  />
                  <text
                    x={sx}
                    y={sy + 4}
                    textAnchor="middle"
                    className={`font-display text-[11px] font-bold ${
                      isSelected
                        ? 'fill-white'
                        : 'fill-white dark:fill-slate-900'
                    }`}
                  >
                    {n.id}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ====================================================================
          SECTION 2: RIGHT SIDEBAR — 3D PRESUMPTION, JOINT & LOAD EDITORS
          ==================================================================== */}
      <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
        {/* 2D-to-3D Bridge Presumption Configuration Card */}
        <div className="p-4 space-y-3 bg-sky-50/50 dark:bg-sky-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-400">
              <Box className="w-3.5 h-3.5" />
              <span>2D-to-3D Bridge Presumption</span>
            </div>
            <span className="font-mono text-[11px] text-slate-500">
              {presumption3D.archetype}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {presumption3D.summary}
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">
                Presumed 3D Width (m)
              </label>
              <input
                type="number"
                min={1.5}
                max={8.0}
                step={0.2}
                value={presumption3D.transverseWidthM}
                onChange={(e) =>
                  onUpdatePresumption3D({
                    ...presumption3D,
                    transverseWidthM: Math.max(1.5, Number(e.target.value)),
                  })
                }
                className="w-full px-2.5 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-500 mb-1">
                3D Roadway Deck Level
              </label>
              <select
                value={presumption3D.deckPlacement}
                onChange={(e) =>
                  onUpdatePresumption3D({
                    ...presumption3D,
                    deckPlacement: e.target.value as 'bottom_chord' | 'top_chord',
                  })
                }
                className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="bottom_chord">Bottom Chord (Through-Truss)</option>
                <option value="top_chord">Top Chord (Deck-Truss)</option>
              </select>
            </div>
          </div>
        </div>

        {/* AI Worksheet Extraction Notes */}
        <div className="p-4 space-y-2 bg-slate-50/60 dark:bg-slate-900/50">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
            <span>Detected Worksheet Features</span>
          </div>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
            {extractionNotes.map((note, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Selected Joint Coordinate & Pin/Roller Support Editor */}
        {activeNode && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-display font-bold text-slate-900 dark:text-slate-100">
                Edit Joint {activeNode.id} Properties
              </h4>
              {nodes.length > 3 && (
                <button
                  onClick={() => {
                    onUpdateBeams(
                      beams.filter(
                        (b) =>
                          b.startNodeId !== activeNode.id &&
                          b.endNodeId !== activeNode.id
                      )
                    );
                    onUpdateLoads(
                      loads.filter((l) => l.nodeId !== activeNode.id)
                    );
                    onUpdateNodes(nodes.filter((n) => n.id !== activeNode.id));
                  }}
                  className="text-xs text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Joint
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">
                  Coordinate X (m)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={activeNode.x}
                  onChange={(e) =>
                    onUpdateNodes(
                      nodes.map((n) =>
                        n.id === activeNode.id
                          ? { ...n, x: Number(e.target.value) }
                          : n
                      )
                    )
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">
                  Coordinate Y (m)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={activeNode.y}
                  onChange={(e) =>
                    onUpdateNodes(
                      nodes.map((n) =>
                        n.id === activeNode.id
                          ? { ...n, y: Number(e.target.value) }
                          : n
                      )
                    )
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                Boundary Support Condition (Pin / Roller)
              </label>
              <select
                value={activeNode.support}
                onChange={(e) =>
                  onUpdateNodes(
                    nodes.map((n) =>
                      n.id === activeNode.id
                        ? { ...n, support: e.target.value as SupportType }
                        : n
                    )
                  )
                }
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="none">None (Free Internal Pin Joint)</option>
                <option value="pin">Pin Support (Constrains Rx &amp; Ry)</option>
                <option value="roller_y">
                  Horizontal Roller Support (Constrains Ry)
                </option>
                <option value="roller_x">
                  Vertical Wall Roller (Constrains Rx)
                </option>
                <option value="fixed">Fixed Anchor Support</option>
              </select>
            </div>
          </div>
        )}

        {/* External Forces Manager in 2D Editor */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              External Forces Acting on Joints (kN)
            </h4>
            {activeNode && (
              <button
                onClick={() => {
                  const newLoad: ExternalLoad = {
                    id: `L${Date.now().toString().slice(-3)}`,
                    nodeId: activeNode.id,
                    magnitudeKN: 60,
                    angleDeg: -90,
                    label: `P_${activeNode.id} = 60 kN`,
                  };
                  onUpdateLoads([...loads, newLoad]);
                }}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Add Force @ {activeNode.id}
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {loads.map((load) => (
              <div
                key={load.id}
                className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2"
              >
                <div className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Acts on:</span>
                    <select
                      value={load.nodeId}
                      onChange={(e) =>
                        onUpdateLoads(
                          loads.map((item) =>
                            item.id === load.id
                              ? {
                                  ...item,
                                  nodeId: e.target.value,
                                  label: `P_${e.target.value} = ${item.magnitudeKN} kN`,
                                }
                              : item
                          )
                        )
                      }
                      className="px-2 py-0.5 font-mono font-bold text-amber-600 dark:text-amber-400 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      {nodes.map((nd) => (
                        <option key={nd.id} value={nd.id}>
                          Joint {nd.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() =>
                      onUpdateLoads(loads.filter((item) => item.id !== load.id))
                    }
                    className="text-slate-400 hover:text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500">
                      Strength: {load.magnitudeKN} kN
                    </label>
                    <input
                      type="range"
                      min={5}
                      max={350}
                      step={5}
                      value={load.magnitudeKN}
                      onChange={(e) =>
                        onUpdateLoads(
                          loads.map((item) =>
                            item.id === load.id
                              ? {
                                  ...item,
                                  magnitudeKN: Number(e.target.value),
                                  label: `P_${item.nodeId} = ${e.target.value} kN`,
                                }
                              : item
                          )
                        )
                      }
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">
                      Angle: {load.angleDeg}°
                    </label>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={15}
                      value={load.angleDeg}
                      onChange={(e) =>
                        onUpdateLoads(
                          loads.map((item) =>
                            item.id === load.id
                              ? { ...item, angleDeg: Number(e.target.value) }
                              : item
                          )
                        )
                      }
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
