/**
 * ============================================================================
 * FILE: src/App.tsx
 * DESCRIPTION:
 * Root Application Shell and State Coordinator for SpanCraft 3D.
 * Orchestrates:
 * 1. Top Navigation Bar & Worksheet Photo Upload / Gemini Vision Scanner.
 * 2. Real-Time Direct Stiffness Method (DSM) structural solver state.
 * 3. 3D Bridge Simulation Viewport with stylized scenic hills backdrop and
 *    centered, non-overflowing Collapsible Bottom Control Dock.
 * 4. Right-hand Contextual Inspector Drawer featuring three dedicated tabs:
 *    - Beam Material & Stress Customizer (change individual beam materials)
 *    - External Forces Customizer (change force strength kN & target joint)
 *    - Joint Free Body Diagram (FBD) & Equilibrium Equations
 * 5. Interactive 2D Worksheet Editor and Exportable Stress Schedule.
 * ============================================================================
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  StructuralNode,
  StructuralBeam,
  ExternalLoad,
  SupportType,
  BeamRole,
  Bridge3DPresumption,
} from './types/structural';
import {
  WORKSHEET_PRESETS,
  generateWorksheetSvgDataUrl,
} from './data/materialsAndPresets';
import { solveStructure } from './solver/directStiffnessSolver';
import { Bridge3DViewport } from './components/Bridge3DViewport';
import { JointFBDInspector } from './components/JointFBDInspector';
import { BeamMaterialInspector } from './components/BeamMaterialInspector';
import { ExternalLoadsInspector } from './components/ExternalLoadsInspector';
import { Worksheet2DEditor } from './components/Worksheet2DEditor';
import { StressScheduleAndReport } from './components/StressScheduleAndReport';
import {
  Upload,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  Mountain,
  Grid,
  Compass,
  Sliders,
  AlertCircle,
  Sparkles,
  PanelRightClose,
  PanelRightOpen,
  ArrowDown,
  Eye,
  Edit3,
} from 'lucide-react';

/**
 * Primary workspace view tabs available in the top navigation bar.
 */
type ActiveWorkspaceTab = '3d_sim' | '2d_editor' | 'joint_fbd' | 'schedule';

/**
 * Tabs inside the right-hand contextual inspector drawer in the 3D simulation view.
 */
type InspectorTab = 'beam_material' | 'external_loads' | 'joint_fbd';

/**
 * Helper that downscales large camera photos on an HTML5 canvas before sending
 * to the server so mobile/high-DPI worksheet uploads transfer rapidly and reliably.
 */
async function normalizeImageFileToDataUrl(file: File): Promise<{
  dataUrl: string;
  mimeType: string;
}> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1600;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', 0.88),
          mimeType: 'image/jpeg',
        });
      } else {
        resolve({ dataUrl: rawDataUrl, mimeType: file.type || 'image/png' });
      }
    };
    img.onerror = () => {
      resolve({ dataUrl: rawDataUrl, mimeType: file.type || 'image/png' });
    };
    img.src = rawDataUrl;
  });
}

/**
 * Main Application Component.
 */
export default function App() {
  const initialPreset = WORKSHEET_PRESETS[0];

  /**
   * ==========================================================================
   * SECTION 1: THEME & WORKSPACE STATE HOOKS
   * ==========================================================================
   */
  const [isDark, setIsDark] = useState<boolean>(true);
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Active Structural Problem State (Nodes, Beams, Loads, 2D Worksheet Image, 3D Presumption)
  const [activePresetId, setActivePresetId] = useState<string>(initialPreset.id);
  const [problemTitle, setProblemTitle] = useState<string>(initialPreset.title);
  const [problemDescription, setProblemDescription] = useState<string>(
    initialPreset.description
  );
  const [nodes, setNodes] = useState<StructuralNode[]>(initialPreset.nodes);
  const [beams, setBeams] = useState<StructuralBeam[]>(initialPreset.beams);
  const [loads, setLoads] = useState<ExternalLoad[]>(initialPreset.loads);
  const [presumption3D, setPresumption3D] = useState<Bridge3DPresumption>(
    initialPreset.presumption3D
  );
  const [worksheetImageUrl, setWorksheetImageUrl] = useState<string>(
    initialPreset.worksheetSvgDataUrl
  );
  const [extractionNotes, setExtractionNotes] = useState<string[]>(
    initialPreset.extractionNotes
  );

  // Navigation, Selection & Inspector Drawer State
  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('3d_sim');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('beam_material');
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('C');
  const [selectedBeamId, setSelectedBeamId] = useState<string | null>('FG');
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>('L2');
  const [showWorksheetPiP, setShowWorksheetPiP] = useState<boolean>(true);

  // 3D Simulation Controls State
  const [deformScale, setDeformScale] = useState<number>(35);
  const [showUndeformedGhost, setShowUndeformedGhost] = useState<boolean>(true);
  const [colorMode, setColorMode] = useState<'stress' | 'material'>('stress');
  const [scenicBackdrop, setScenicBackdrop] = useState<boolean>(true);
  const [includeSelfWeight, setIncludeSelfWeight] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [cameraPresetTrigger, setCameraPresetTrigger] = useState<{
    preset: 'iso' | 'front' | 'top' | 'side';
    seq: number;
  }>({ preset: 'iso', seq: 0 });

  // Worksheet AI Vision Upload State
  const [isAnalyzingWorksheet, setIsAnalyzingWorksheet] =
    useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Keyboard shortcut ('H') to collapse or expand the bottom 3D control dock.
   */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'h' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        setDockCollapsed((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /**
   * ==========================================================================
   * SECTION 2: REAL-TIME DIRECT STIFFNESS SOLVER MEMO
   * Recomputes nodal deflections, support reactions, beam stresses, and Joint
   * FBDs whenever nodes, beams, external forces, or self-weight change.
   * ==========================================================================
   */
  const analysis = useMemo(() => {
    return solveStructure(nodes, beams, loads, includeSelfWeight);
  }, [nodes, beams, loads, includeSelfWeight]);

  /**
   * ==========================================================================
   * SECTION 3: INTERACTION & STATE MUTATION HANDLERS
   * ==========================================================================
   */

  /**
   * Loads one of the built-in mechanical/civil engineering worksheet presets.
   */
  const handleSelectPreset = (presetId: string) => {
    const preset = WORKSHEET_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setActivePresetId(preset.id);
    setProblemTitle(preset.title);
    setProblemDescription(preset.description);
    setNodes(preset.nodes);
    setBeams(preset.beams);
    setLoads(preset.loads);
    setPresumption3D(preset.presumption3D);
    setWorksheetImageUrl(preset.worksheetSvgDataUrl);
    setExtractionNotes(preset.extractionNotes);
    setSelectedNodeId(preset.nodes[2]?.id || preset.nodes[0]?.id || null);
    setSelectedBeamId(preset.beams[5]?.id || preset.beams[0]?.id || null);
    setSelectedLoadId(preset.loads[0]?.id || null);
    setAnalysisError(null);
  };

  /**
   * Updates an individual beam's material or cross-section properties.
   */
  const handleUpdateBeam = (beamId: string, patch: Partial<StructuralBeam>) => {
    setBeams((prev) =>
      prev.map((b) => (b.id === beamId ? { ...b, ...patch } : b))
    );
  };

  /**
   * Batch-assigns a material across all beams sharing a structural role or the entire bridge.
   */
  const handleBatchAssignMaterial = (
    materialId: string,
    scope: 'role' | 'all',
    targetRole?: string
  ) => {
    setBeams((prev) =>
      prev.map((b) => {
        if (scope === 'all' || (scope === 'role' && b.role === targetRole)) {
          return {
            ...b,
            materialId,
            customYieldMPa: undefined,
            customYoungsGPa: undefined,
          };
        }
        return b;
      })
    );
  };

  /**
   * Selects a Joint and opens the Joint Free Body Diagram (FBD) inspector tab.
   */
  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setInspectorTab('joint_fbd');
    setInspectorOpen(true);
  };

  /**
   * Selects a Beam and opens the Beam Material & Stress customizer tab.
   */
  const handleSelectBeam = (beamId: string) => {
    setSelectedBeamId(beamId);
    setInspectorTab('beam_material');
    setInspectorOpen(true);
  };

  /**
   * Selects an External Force arrow in 3D and opens the External Forces customizer tab.
   */
  const handleSelectLoad = (loadId: string) => {
    setSelectedLoadId(loadId);
    setInspectorTab('external_loads');
    setInspectorOpen(true);
  };

  /**
   * ==========================================================================
   * SECTION 4: WORKSHEET PHOTO UPLOAD & GEMINI MULTIMODAL EXTRACTION
   * Sends the uploaded engineering worksheet photo to `POST /api/worksheet/analyze`,
   * populates the 2D Worksheet Editor with extracted Pin/Roller joints, beams,
   * and external loads, and configures the 3D Bridge Presumption for the 3D view.
   * ==========================================================================
   */
  const handleUploadWorksheetFile = async (file: File) => {
    setAnalysisError(null);
    setIsAnalyzingWorksheet(true);

    try {
      const { dataUrl, mimeType } = await normalizeImageFileToDataUrl(file);
      setWorksheetImageUrl(dataUrl);

      const response = await fetch('/api/worksheet/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract worksheet topology.');
      }

      if (
        Array.isArray(data.nodes) &&
        data.nodes.length >= 2 &&
        Array.isArray(data.beams) &&
        data.beams.length >= 1
      ) {
        const validSupports: SupportType[] = [
          'none',
          'pin',
          'roller_y',
          'roller_x',
          'fixed',
        ];
        const extractedNodes: StructuralNode[] = data.nodes.map(
          (n: { id: string; x: number; y: number; support: string }) => ({
            id: String(n.id).trim(),
            x: Number(n.x) || 0,
            y: Number(n.y) || 0,
            support: validSupports.includes(n.support as SupportType)
              ? (n.support as SupportType)
              : 'none',
          })
        );

        const nodeIds = new Set(extractedNodes.map((n) => n.id));
        const extractedBeams: StructuralBeam[] = data.beams
          .filter(
            (b: { startNodeId: string; endNodeId: string }) =>
              nodeIds.has(String(b.startNodeId).trim()) &&
              nodeIds.has(String(b.endNodeId).trim()) &&
              String(b.startNodeId).trim() !== String(b.endNodeId).trim()
          )
          .map(
            (
              b: {
                id: string;
                startNodeId: string;
                endNodeId: string;
                role?: string;
              },
              idx: number
            ) => ({
              id:
                String(b.id || '').trim() ||
                `${b.startNodeId}${b.endNodeId}_${idx}`,
              startNodeId: String(b.startNodeId).trim(),
              endNodeId: String(b.endNodeId).trim(),
              materialId: b.role === 'top_chord' ? 'alu_6063' : 'steel_a36',
              crossSectionAreaCm2: 14,
              profile:
                b.role === 'top_chord'
                  ? 'box_girder'
                  : b.role === 'bottom_chord'
                  ? 'i_beam'
                  : 'tubular',
              role: (b.role as BeamRole) || 'web_diagonal',
            })
          );

        const extractedLoads: ExternalLoad[] = Array.isArray(data.loads)
          ? data.loads
              .filter((l: { nodeId: string }) =>
                nodeIds.has(String(l.nodeId).trim())
              )
              .map(
                (
                  l: {
                    id?: string;
                    nodeId: string;
                    magnitudeKN: number;
                    angleDeg: number;
                    label?: string;
                  },
                  idx: number
                ) => ({
                  id: l.id || `L${idx + 1}`,
                  nodeId: String(l.nodeId).trim(),
                  magnitudeKN: Math.max(5, Number(l.magnitudeKN) || 60),
                  angleDeg:
                    l.angleDeg !== undefined ? Number(l.angleDeg) : -90,
                  label: l.label || `${Number(l.magnitudeKN) || 60} kN`,
                })
              )
          : [];

        // Extract or synthesize the 3D Bridge Presumption
        const extractedPresumption: Bridge3DPresumption = data.presumption3D
          ? {
              archetype:
                data.presumption3D.archetype || 'Through-Truss Bridge',
              transverseWidthM:
                Number(data.presumption3D.transverseWidthM) || 3.0,
              deckPlacement:
                data.presumption3D.deckPlacement === 'top_chord'
                  ? 'top_chord'
                  : 'bottom_chord',
              summary:
                data.presumption3D.summary ||
                'Extrapolated 2D worksheet into a 3D twin-plane bridge with lateral cross-girders and support piers.',
            }
          : {
              archetype: 'Through-Truss Bridge',
              transverseWidthM: 3.0,
              deckPlacement: 'bottom_chord',
              summary:
                'Extrapolated 2D worksheet into a 3D twin-plane bridge with lateral cross-girders and support piers.',
            };

        setActivePresetId('custom_uploaded');
        setProblemTitle(data.title || 'Scanned Engineering Worksheet');
        setProblemDescription(
          data.description ||
            'Extracted 2D structural topology converted to 3D Direct Stiffness model.'
        );
        setNodes(extractedNodes);
        setBeams(extractedBeams);
        setLoads(
          extractedLoads.length > 0
            ? extractedLoads
            : [
                {
                  id: 'L1',
                  nodeId:
                    extractedNodes[Math.floor(extractedNodes.length / 2)].id,
                  magnitudeKN: 90,
                  angleDeg: -90,
                  label: 'P1 = 90 kN',
                },
              ]
        );
        setPresumption3D(extractedPresumption);
        setExtractionNotes(
          Array.isArray(data.extractionNotes) && data.extractionNotes.length > 0
            ? data.extractionNotes
            : [
                'Successfully extracted pin/roller joints, beams, and loads from worksheet photo.',
              ]
        );
        setSelectedNodeId(extractedNodes[0]?.id || null);
        setSelectedBeamId(extractedBeams[0]?.id || null);
        setShowWorksheetPiP(true);
      } else {
        throw new Error(
          'Could not detect a valid multi-joint truss or frame in that image. You can still trace and edit joints over your photo in the 2D Worksheet Editor.'
        );
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Worksheet analysis failed. Please try again.';
      setAnalysisError(msg);
    } finally {
      setIsAnalyzingWorksheet(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100">
      {/* Hidden File Input for Worksheet Photo Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUploadWorksheetFile(file);
        }}
      />

      {/* ====================================================================
          SECTION 5: TOP NAVIGATION BAR (3-Zone Contract)
          ==================================================================== */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0 no-print">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('3d_sim');
          }}
          className="text-lg font-display font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          SpanCraft 3D
        </a>

        {/* Zone 2: 4 Workspace Navigation Links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400 overflow-x-auto">
          <a
            href="#3d-simulation"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('3d_sim');
            }}
            className={`py-0.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === '3d_sim'
                ? 'text-slate-900 dark:text-white underline underline-offset-8 decoration-2 decoration-sky-500 font-semibold'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            3D Simulation
          </a>
          <a
            href="#2d-editor"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('2d_editor');
            }}
            className={`py-0.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === '2d_editor'
                ? 'text-slate-900 dark:text-white underline underline-offset-8 decoration-2 decoration-sky-500 font-semibold'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            2D Worksheet Editor
          </a>
          <a
            href="#joint-fbd"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('joint_fbd');
            }}
            className={`py-0.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'joint_fbd'
                ? 'text-slate-900 dark:text-white underline underline-offset-8 decoration-2 decoration-sky-500 font-semibold'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Joint FBD
          </a>
          <a
            href="#stress-schedule"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('schedule');
            }}
            className={`py-0.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'schedule'
                ? 'text-slate-900 dark:text-white underline underline-offset-8 decoration-2 decoration-sky-500 font-semibold'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Stress Schedule
          </a>
        </nav>

        {/* Zone 3: Primary CTA — Upload Engineering Worksheet Photo */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzingWorksheet}
            className="px-4 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            {isAnalyzingWorksheet ? 'Scanning Photo...' : 'Upload Worksheet'}
          </button>
        </div>
      </header>

      {/* ====================================================================
          SECTION 6: SECONDARY WORKSPACE TOOLBAR
          Preset switcher, live structural telemetry readouts, and theme toggle.
          ==================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/90 text-xs shrink-0 no-print">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Worksheet Problem:
          </label>
          <select
            value={activePresetId}
            onChange={(e) => handleSelectPreset(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium cursor-pointer"
          >
            {WORKSHEET_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.spanSummary})
              </option>
            ))}
            {activePresetId === 'custom_uploaded' && (
              <option value="custom_uploaded">
                Scanned Worksheet: {problemTitle}
              </option>
            )}
          </select>

          {/* Clean unboxed telemetry metadata with typographic separators */}
          <div className="hidden xl:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-mono pl-2">
            <span>
              Peak Stress:{' '}
              <strong
                style={{
                  color:
                    analysis.criticalBeamId &&
                    analysis.beams[analysis.criticalBeamId]
                      ? analysis.beams[analysis.criticalBeamId].stressColorHex
                      : undefined,
                }}
              >
                {(analysis.maxUtilizationRatio * 100).toFixed(0)}% Yield
              </strong>{' '}
              (Beam {analysis.criticalBeamId || '—'})
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Max Deflection:{' '}
              <strong className="text-slate-900 dark:text-slate-200">
                {analysis.maxDisplacementMm.toFixed(2)} mm
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Total Force:{' '}
              <strong className="text-amber-600 dark:text-amber-400">
                {analysis.totalAppliedLoadKN.toFixed(0)} kN
              </strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {isAnalyzingWorksheet && (
            <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-medium">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>
                Extracting 2D pin/roller joints &amp; 3D presumption via Gemini...
              </span>
            </div>
          )}

          {analysisError && (
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{analysisError}</span>
            </div>
          )}

          {/* Quick Button to Open External Force Customizer */}
          <button
            onClick={() => {
              setActiveTab('3d_sim');
              setInspectorTab('external_loads');
              setInspectorOpen(true);
            }}
            className="px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>Customize External Forces ({loads.length})</span>
          </button>

          {/* Theme Switcher Button */}
          <button
            onClick={() => setIsDark((v) => !v)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Toggle Daylight Lab / Twilight CAD Theme"
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Daylight Hills</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-sky-600" />
                <span>Twilight CAD</span>
              </>
            )}
          </button>

          {activeTab === '3d_sim' && (
            <button
              onClick={() => setInspectorOpen((v) => !v)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {inspectorOpen ? (
                <>
                  <PanelRightClose className="w-3.5 h-3.5" />
                  <span>Hide Inspector</span>
                </>
              ) : (
                <>
                  <PanelRightOpen className="w-3.5 h-3.5" />
                  <span>Show Inspector</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ====================================================================
          SECTION 7: MAIN WORKSPACE AREA
          ==================================================================== */}
      <main className="flex-1 flex overflow-hidden relative">
        {activeTab === '3d_sim' && (
          <>
            {/* Central 3D Bridge Viewport Container */}
            <div className="relative flex-1 h-full overflow-hidden">
              <Bridge3DViewport
                nodes={nodes}
                beams={beams}
                loads={loads}
                analysis={analysis}
                presumption3D={presumption3D}
                selectedNodeId={selectedNodeId}
                selectedBeamId={selectedBeamId}
                onSelectNode={handleSelectNode}
                onSelectBeam={handleSelectBeam}
                onSelectLoad={handleSelectLoad}
                deformScale={deformScale}
                showUndeformedGhost={showUndeformedGhost}
                colorMode={colorMode}
                scenicBackdrop={scenicBackdrop}
                isDark={isDark}
                cameraPresetTrigger={cameraPresetTrigger}
              />

              {/* Top-Left 2D Worksheet Reference & 3D Bridge Presumption Card */}
              <div className="absolute top-3 left-3 z-10 w-80 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono text-sky-600 dark:text-sky-400 uppercase truncate">
                      {presumption3D.archetype} · {presumption3D.transverseWidthM}m Width
                    </div>
                    <div className="text-xs font-display font-bold text-slate-900 dark:text-white truncate">
                      {problemTitle}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowWorksheetPiP((v) => !v)}
                    className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    title="Toggle 2D Worksheet Preview"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>

                {showWorksheetPiP && (
                  <div className="p-3 space-y-2.5">
                    {/* Thumbnail of 2D Worksheet */}
                    {worksheetImageUrl && (
                      <div
                        onClick={() => setActiveTab('2d_editor')}
                        className="relative h-28 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 overflow-hidden cursor-pointer group"
                        title="Click to open in 2D Worksheet Editor"
                      >
                        <img
                          src={worksheetImageUrl}
                          alt="2D Worksheet Thumbnail"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="px-2.5 py-1 rounded bg-white text-slate-900 text-[11px] font-semibold flex items-center gap-1 shadow-xs">
                            <Edit3 className="w-3 h-3" />
                            Edit 2D Worksheet
                          </span>
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                      {presumption3D.summary}
                    </p>

                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        onClick={() => setActiveTab('2d_editor')}
                        className="flex-1 py-1.5 px-2.5 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        2D Editor
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-1.5 px-2.5 text-[11px] font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Upload className="w-3 h-3" />
                        Scan Photo
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ============================================================
                  CENTERED BOTTOM CONTROL DOCK (No double-translate shift!)
                  Uses clean flexbox centering (`inset-x-0 bottom-3 flex justify-center`)
                  so it stays 100% inside the 3D viewport on all screen sizes.
                  ============================================================ */}
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-4">
                <div className="pointer-events-auto w-full max-w-4xl flex flex-col items-center">
                  {/* Collapse / Expand Toggle Handle */}
                  <button
                    onClick={() => setDockCollapsed((v) => !v)}
                    className="px-3.5 py-1 text-xs font-medium rounded-t-lg bg-white/95 dark:bg-slate-900/95 border border-b-0 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {dockCollapsed ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span>Show 3D Controls &amp; Stress Scale (H)</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        <span>Hide Controls (H)</span>
                      </>
                    )}
                  </button>

                  {/* Dock Main Panel */}
                  {!dockCollapsed && (
                    <div className="w-full p-3 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-xl space-y-2.5">
                      {/* Row 1: Stress Heatmap Color Scale & Mode Switcher */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            Beam Stress (|σ| / σ_yield):
                          </span>
                          <div className="flex items-center gap-2.5 text-[11px] font-mono flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <span className="w-2.5 h-2.5 rounded-xs bg-[#10B981]" />
                              0–28% Nominal
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="w-2.5 h-2.5 rounded-xs bg-[#0EA5E9]" />
                              28–55% Moderate
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="w-2.5 h-2.5 rounded-xs bg-[#F59E0B]" />
                              55–80% Elevated
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="w-2.5 h-2.5 rounded-xs bg-[#F97316]" />
                              80–100% Critical
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="w-2.5 h-2.5 rounded-xs bg-[#DC2626]" />
                              &gt;100% Yielded
                            </span>
                          </div>
                        </div>

                        {/* Color Mode Toggle */}
                        <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                          <button
                            onClick={() => setColorMode('stress')}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              colorMode === 'stress'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            Stress Heatmap
                          </button>
                          <button
                            onClick={() => setColorMode('material')}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              colorMode === 'material'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            Material Finish
                          </button>
                        </div>
                      </div>

                      {/* Row 2: Deflection Slider, Backdrop Toggle & Camera View Presets */}
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                            Deflection Scale:{' '}
                            <strong className="font-mono text-slate-900 dark:text-white">
                              {deformScale}×
                            </strong>
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={150}
                            step={5}
                            value={deformScale}
                            onChange={(e) =>
                              setDeformScale(Number(e.target.value))
                            }
                            className="w-24 accent-sky-600 cursor-pointer"
                          />
                          <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 cursor-pointer whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={showUndeformedGhost}
                              onChange={(e) =>
                                setShowUndeformedGhost(e.target.checked)
                              }
                              className="rounded accent-sky-600"
                            />
                            <span>Ghost Ref</span>
                          </label>
                          <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 cursor-pointer whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={includeSelfWeight}
                              onChange={(e) =>
                                setIncludeSelfWeight(e.target.checked)
                              }
                              className="rounded accent-sky-600"
                            />
                            <span>Self-Weight</span>
                          </label>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => setScenicBackdrop((v) => !v)}
                            className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              scenicBackdrop
                                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {scenicBackdrop ? (
                              <>
                                <Mountain className="w-3.5 h-3.5" />
                                <span>Scenic Hills</span>
                              </>
                            ) : (
                              <>
                                <Grid className="w-3.5 h-3.5" />
                                <span>CAD Grid</span>
                              </>
                            )}
                          </button>

                          {/* Camera View Presets */}
                          <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                            {(
                              [
                                { id: 'iso', label: '3D Orbit' },
                                { id: 'front', label: 'Front' },
                                { id: 'top', label: 'Top' },
                                { id: 'side', label: 'Side' },
                              ] as const
                            ).map((cam) => (
                              <button
                                key={cam.id}
                                onClick={() =>
                                  setCameraPresetTrigger((prev) => ({
                                    preset: cam.id,
                                    seq: prev.seq + 1,
                                  }))
                                }
                                className="px-2 py-1 text-xs font-medium rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                {cam.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ==============================================================
                RIGHT CONTEXTUAL INSPECTOR DRAWER
                Provides 3 tabs:
                1. Beam Material & Stress
                2. External Forces (Loads)
                3. Joint FBD & Equations
                ============================================================== */}
            {inspectorOpen && (
              <aside className="w-full sm:w-[420px] xl:w-[450px] h-full border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col shrink-0 z-20">
                {/* 3-Tab Mode Switcher */}
                <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900 grid grid-cols-3 gap-1">
                  <button
                    onClick={() => setInspectorTab('beam_material')}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      inspectorTab === 'beam_material'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span>Beam Material</span>
                  </button>

                  <button
                    onClick={() => setInspectorTab('external_loads')}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      inspectorTab === 'external_loads'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <ArrowDown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>External Forces</span>
                  </button>

                  <button
                    onClick={() => setInspectorTab('joint_fbd')}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      inspectorTab === 'joint_fbd'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Joint FBD</span>
                  </button>
                </div>

                {/* Active Inspector Tab Body */}
                <div className="flex-1 overflow-hidden">
                  {inspectorTab === 'beam_material' && (
                    <BeamMaterialInspector
                      beams={beams}
                      analysis={analysis}
                      selectedBeamId={selectedBeamId}
                      onSelectBeam={(id) => setSelectedBeamId(id)}
                      onSelectNode={(nodeId) => handleSelectNode(nodeId)}
                      onUpdateBeam={handleUpdateBeam}
                      onBatchAssignMaterial={handleBatchAssignMaterial}
                    />
                  )}

                  {inspectorTab === 'external_loads' && (
                    <ExternalLoadsInspector
                      nodes={nodes}
                      beams={beams}
                      loads={loads}
                      analysis={analysis}
                      selectedLoadId={selectedLoadId}
                      onUpdateLoads={setLoads}
                      onSelectNode={(nodeId) => handleSelectNode(nodeId)}
                      onSelectBeam={(beamId) => handleSelectBeam(beamId)}
                    />
                  )}

                  {inspectorTab === 'joint_fbd' && (
                    <JointFBDInspector
                      nodes={nodes}
                      analysis={analysis}
                      selectedNodeId={selectedNodeId}
                      onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
                      onSelectBeam={(beamId) => handleSelectBeam(beamId)}
                    />
                  )}
                </div>
              </aside>
            )}
          </>
        )}

        {activeTab === '2d_editor' && (
          <Worksheet2DEditor
            nodes={nodes}
            beams={beams}
            loads={loads}
            analysis={analysis}
            worksheetImageUrl={worksheetImageUrl}
            extractionNotes={extractionNotes}
            presumption3D={presumption3D}
            onUpdatePresumption3D={setPresumption3D}
            selectedNodeId={selectedNodeId}
            selectedBeamId={selectedBeamId}
            onSelectNode={(id) => setSelectedNodeId(id)}
            onSelectBeam={(id) => setSelectedBeamId(id)}
            onUpdateNodes={(updatedNodes) => {
              setNodes(updatedNodes);
              if (activePresetId !== 'custom_uploaded') {
                setWorksheetImageUrl(
                  generateWorksheetSvgDataUrl(
                    problemTitle,
                    'CUSTOM',
                    updatedNodes,
                    beams,
                    loads
                  )
                );
              }
            }}
            onUpdateBeams={setBeams}
            onUpdateLoads={setLoads}
            onUploadWorksheetFile={handleUploadWorksheetFile}
            isAnalyzingWorksheet={isAnalyzingWorksheet}
            onSwitchTo3DSim={() => setActiveTab('3d_sim')}
          />
        )}

        {activeTab === 'joint_fbd' && (
          <div className="w-full h-full flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 h-full border-r border-slate-200 dark:border-slate-800">
              <JointFBDInspector
                nodes={nodes}
                analysis={analysis}
                selectedNodeId={selectedNodeId}
                onSelectNode={(id) => setSelectedNodeId(id)}
                onSelectBeam={(beamId) => {
                  setSelectedBeamId(beamId);
                  setActiveTab('3d_sim');
                  setInspectorTab('beam_material');
                }}
              />
            </div>
            <div className="hidden lg:block lg:w-1/2 h-full relative">
              <Bridge3DViewport
                nodes={nodes}
                beams={beams}
                loads={loads}
                analysis={analysis}
                presumption3D={presumption3D}
                selectedNodeId={selectedNodeId}
                selectedBeamId={selectedBeamId}
                onSelectNode={(id) => setSelectedNodeId(id)}
                onSelectBeam={(id) => setSelectedBeamId(id)}
                onSelectLoad={handleSelectLoad}
                deformScale={deformScale}
                showUndeformedGhost={showUndeformedGhost}
                colorMode={colorMode}
                scenicBackdrop={scenicBackdrop}
                isDark={isDark}
                cameraPresetTrigger={cameraPresetTrigger}
              />
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <StressScheduleAndReport
            problemTitle={problemTitle}
            problemDescription={problemDescription}
            nodes={nodes}
            beams={beams}
            loads={loads}
            analysis={analysis}
            onUpdateBeam={handleUpdateBeam}
            onSelectBeamIn3D={(beamId) => {
              setSelectedBeamId(beamId);
              setInspectorTab('beam_material');
              setActiveTab('3d_sim');
            }}
            onSelectNodeFBD={(nodeId) => {
              setSelectedNodeId(nodeId);
              setInspectorTab('joint_fbd');
              setActiveTab('joint_fbd');
            }}
          />
        )}
      </main>
    </div>
  );
}
