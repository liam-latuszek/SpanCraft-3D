/**
 * ============================================================================
 * FILE: src/types/structural.ts
 * DESCRIPTION:
 * Core TypeScript data structures and domain interfaces for SpanCraft 3D.
 * Defines the schema for 2D/3D structural topology (nodes, supports, beams,
 * external point loads), engineering material properties, Direct Stiffness
 * Method (DSM) finite-element analysis outputs, Joint Free Body Diagram (FBD)
 * equilibrium vectors, and 2D-to-3D worksheet extrapolation assumptions.
 * ============================================================================
 */

/**
 * Defines the boundary restraint condition at a structural joint (node).
 * - 'none': Free internal truss/frame pin joint (0 reaction constraints, free to displace in X and Y).
 * - 'pin': Hinged pin support (constrains horizontal Rx and vertical Ry translations).
 * - 'roller_y': Horizontal ground roller support (constrains vertical Ry translation, free to roll along X).
 * - 'roller_x': Vertical wall roller support (constrains horizontal Rx translation, free to roll along Y).
 * - 'fixed': Cantilever built-in support (constrains translations in X and Y).
 */
export type SupportType = 'none' | 'pin' | 'roller_y' | 'roller_x' | 'fixed';

/**
 * Classifies the architectural/structural role of a beam within a bridge or frame.
 * Used for intelligent 3D cross-section presumption and batch material assignment.
 */
export type BeamRole =
  | 'top_chord'
  | 'bottom_chord'
  | 'web_diagonal'
  | 'web_vertical'
  | 'frame_column';

/**
 * Specifies the 3D cross-sectional geometry profile rendered in the Three.js simulation.
 * - 'i_beam': Wide-flange I-beam with top/bottom flanges and central web plate.
 * - 'box_girder': Hollow rectangular structural box section with reinforcing ribs.
 * - 'tubular': Cylindrical hollow structural section (HSS pipe) with end collars.
 */
export type BeamProfileType = 'i_beam' | 'box_girder' | 'tubular';

/**
 * Semantic engineering stress state based on utilization ratio (|sigma| / sigma_yield).
 * - 'nominal': 0% to 28% of yield strength (Emerald)
 * - 'moderate': 28% to 55% of yield strength (Cyan/Sky)
 * - 'elevated': 55% to 80% of yield strength (Amber)
 * - 'critical': 80% to 100% of yield strength (Orange-Red)
 * - 'overstressed': >= 100% of yield strength (Crimson Red + Yield Wireframe Warning)
 */
export type StressStatus =
  | 'nominal'
  | 'moderate'
  | 'elevated'
  | 'critical'
  | 'overstressed';

/**
 * Defines the mechanical and visual PBR properties of a structural engineering material.
 */
export interface MaterialSpec {
  /** Unique identifier for the material preset (e.g., 'steel_a36', 'alu_6061'). */
  id: string;
  /** Full engineering specification name (e.g., 'Structural Steel (ASTM A36)'). */
  name: string;
  /** Compact label for tables and badges (e.g., 'A36 Steel'). */
  shortName: string;
  /** Broad material classification family. */
  category: 'Steel' | 'Aluminum' | 'Timber' | 'Composite' | 'Iron' | 'Custom';
  /** Young's Modulus of Elasticity (E) in Gigapascals (GPa). Controls beam stiffness (EA/L). */
  youngsModulusGPa: number;
  /** Yield Strength (sigma_yield) in Megapascals (MPa). Defines 100% maximum allowable stress threshold. */
  yieldStrengthMPa: number;
  /** Ultimate Tensile Strength (sigma_ult) in Megapascals (MPa). */
  ultimateStrengthMPa: number;
  /** Mass density (rho) in kg/m^3. Used for bridge mass and self-weight dead load calculation. */
  densityKgM3: number;
  /** Base hexadecimal color used when viewing the bridge in 'Material Finish' mode. */
  colorHex: string;
  /** Physically Based Rendering (PBR) surface roughness (0 = mirror, 1 = matte). */
  roughness: number;
  /** Physically Based Rendering (PBR) metalness factor (0 = dielectric/wood, 1 = pure metal). */
  metalness: number;
  /** Educational description of the material's mechanical behavior. */
  description: string;
}

/**
 * Represents a 2D/3D structural joint (node) where beams connect and supports/loads attach.
 */
export interface StructuralNode {
  /** Alphanumeric identifier for the joint (e.g., 'A', 'B', 'C'). */
  id: string;
  /** Horizontal position in meters (m) from the leftmost origin. */
  x: number;
  /** Vertical elevation in meters (m) from the baseline support level. */
  y: number;
  /** Boundary support restraint applied at this joint. */
  support: SupportType;
}

/**
 * Represents a straight structural beam/member connecting two joints.
 */
export interface StructuralBeam {
  /** Unique identifier for the beam (e.g., 'AB', 'FG'). */
  id: string;
  /** ID of the starting StructuralNode. */
  startNodeId: string;
  /** ID of the ending StructuralNode. */
  endNodeId: string;
  /** ID referencing the assigned MaterialSpec from the material library. */
  materialId: string;
  /** Cross-sectional area (A) in square centimeters (cm^2). Directly scales axial stress sigma = F / A. */
  crossSectionAreaCm2: number;
  /** 3D cross-sectional geometry profile rendered for this member. */
  profile: BeamProfileType;
  /** Structural role within the truss (top chord, bottom chord, web vertical/diagonal). */
  role?: BeamRole;
  /** Optional per-beam custom override for Yield Strength in MPa. */
  customYieldMPa?: number;
  /** Optional per-beam custom override for Young's Modulus in GPa. */
  customYoungsGPa?: number;
}

/**
 * Represents an external point force vector applied to a specific structural joint.
 */
export interface ExternalLoad {
  /** Unique identifier for the load vector (e.g., 'L1', 'L2'). */
  id: string;
  /** ID of the joint (StructuralNode) where this external force acts. */
  nodeId: string;
  /** Magnitude of the applied force in kilonewtons (kN), always non-negative. */
  magnitudeKN: number;
  /** Direction angle in degrees: -90 = downward gravity, 0 = rightward (+X), 90 = upward (+Y), 180 = leftward (-X). */
  angleDeg: number;
  /** Human-readable label displayed in schematics and tables. */
  label?: string;
}

/**
 * Describes how a 2D worksheet diagram is extrapolated into a complete 3D bridge structure.
 */
export interface Bridge3DPresumption {
  /** Architectural bridge archetype inferred from the 2D truss geometry. */
  archetype: 'Through-Truss Bridge' | 'Deck-Truss Bridge' | 'Arch Span Bridge' | 'Cantilever Structure';
  /** Presumed transverse width (in meters) between the front and rear parallel 3D truss planes. */
  transverseWidthM: number;
  /** Whether the roadway deck is carried along the bottom chord or top chord joints. */
  deckPlacement: 'bottom_chord' | 'top_chord';
  /** Explanation of the 2D-to-3D structural extrapolation assumptions. */
  summary: string;
}

/**
 * Computed finite-element displacement and support reaction results for a single joint.
 */
export interface NodeAnalysisResult {
  /** ID of the evaluated joint. */
  nodeId: string;
  /** Original undeformed X coordinate in meters. */
  x: number;
  /** Original undeformed Y coordinate in meters. */
  y: number;
  /** Boundary support type at this joint. */
  support: SupportType;
  /** Computed horizontal elastic displacement (delta X) in millimeters (mm). */
  dxMm: number;
  /** Computed vertical elastic displacement (delta Y) in millimeters (mm). */
  dyMm: number;
  /** Computed horizontal support reaction force (Rx) in kilonewtons (kN). */
  reactionRxKN: number;
  /** Computed vertical support reaction force (Ry) in kilonewtons (kN). */
  reactionRyKN: number;
  /** Resultant support reaction magnitude sqrt(Rx^2 + Ry^2) in kilonewtons (kN). */
  reactionMagnitudeKN: number;
  /** Direction angle of the resultant support reaction vector in degrees. */
  reactionAngleDeg: number;
}

/**
 * Computed internal axial force, normal stress, buckling threshold, and safety metrics for a single beam.
 */
export interface BeamAnalysisResult {
  /** ID of the evaluated beam. */
  beamId: string;
  /** Start joint ID. */
  startNodeId: string;
  /** End joint ID. */
  endNodeId: string;
  /** Resolved MaterialSpec object for this beam. */
  material: MaterialSpec;
  /** Active Yield Strength (sigma_yield) in MPa (incorporating any custom override). */
  effectiveYieldMPa: number;
  /** Active Young's Modulus (E) in GPa (incorporating any custom override). */
  effectiveYoungsGPa: number;
  /** Cross-sectional area in cm^2. */
  crossSectionAreaCm2: number;
  /** Undeformed geometric length (L) in meters. */
  lengthM: number;
  /** Inclination angle of the beam in degrees from startNode to endNode. */
  angleDeg: number;
  /** Signed internal axial force (N) in kN: Positive (+) = Tension, Negative (-) = Compression. */
  axialForceKN: number;
  /** Qualitative axial force state ('Tension', 'Compression', or 'Zero-Force'). */
  forceState: 'Tension' | 'Compression' | 'Zero-Force';
  /** Signed normal axial stress (sigma = N / A) in Megapascals (MPa). */
  normalStressMPa: number;
  /** Absolute normal stress magnitude |sigma| in Megapascals (MPa). */
  absStressMPa: number;
  /** Euler elastic buckling critical stress threshold in MPa for slender compression members. */
  bucklingCriticalStressMPa: number;
  /** Stress Utilization Ratio = |sigma| / sigma_yield (e.g., 0.85 means 85% of max material stress). */
  utilizationRatio: number;
  /** Factor of Safety (FoS) = sigma_yield / |sigma| (capped at 99.9 for near-zero stress). */
  safetyFactor: number;
  /** Axial normal strain in millistrain (mm/m). */
  strainMilli: number;
  /** Total axial elongation or shortening (delta L) in millimeters (mm). */
  elongationMm: number;
  /** Total mass of the single beam in kilograms (kg). */
  massKg: number;
  /** Semantic stress classification ('nominal' through 'overstressed'). */
  status: StressStatus;
  /** Computed hex color for the 3D heatmap and UI status badges. */
  stressColorHex: string;
}

/**
 * Represents a single concurrent force vector acting on an isolated joint in a Free Body Diagram (FBD).
 */
export interface JointFBDForceVector {
  /** Unique vector ID for SVG rendering. */
  id: string;
  /** Origin category of the force acting on the pin joint. */
  sourceType: 'member' | 'external_load' | 'support_reaction';
  /** Symbolic vector label (e.g., 'F_AB', 'P_1', 'R_Ay'). */
  label: string;
  /** Descriptive subtitle (e.g., 'Tension (A36 Steel)', 'Pin Vertical Reaction'). */
  subLabel: string;
  /** Non-negative force magnitude in kilonewtons (kN). */
  magnitudeKN: number;
  /** Geometric ray angle (in degrees) of the member or force relative to the joint center. */
  angleDeg: number;
  /** Signed horizontal force component (Fx) acting ON the joint in kN. */
  fxKN: number;
  /** Signed vertical force component (Fy) acting ON the joint in kN. */
  fyKN: number;
  /** Whether a connected member is pulling away ('Tension') or pushing into ('Compression') the joint. */
  memberState?: 'Tension' | 'Compression' | 'Zero-Force';
  /** Connected beam ID if sourceType === 'member', enabling click-through to beam material settings. */
  beamId?: string;
  /** Utilization ratio of the connected beam. */
  stressRatio?: number;
  /** Display color for the vector arrow in the FBD schematic. */
  colorHex: string;
}

/**
 * Encapsulates the complete static equilibrium analysis (sum Fx = 0, sum Fy = 0) for a single joint.
 */
export interface JointEquilibriumAnalysis {
  /** Joint ID (e.g., 'A', 'B'). */
  nodeId: string;
  /** Joint X coordinate in meters. */
  x: number;
  /** Joint Y coordinate in meters. */
  y: number;
  /** Boundary support type at this joint. */
  support: SupportType;
  /** List of all concurrent forces (members, external loads, support reactions) acting on this joint. */
  vectors: JointFBDForceVector[];
  /** Net residual horizontal force sum in kN (0.00 kN when in static equilibrium). */
  sumFxKN: number;
  /** Net residual vertical force sum in kN (0.00 kN when in static equilibrium). */
  sumFyKN: number;
  /** True when the net unbalanced force residual is negligible (< 1.0 kN). */
  isInEquilibrium: boolean;
  /** Formatted symbolic equation string for horizontal equilibrium (e.g., '∑Fx = F_AB·cos(0°) + ... = 0'). */
  symbolicSumFx: string;
  /** Formatted numeric substitution string for horizontal equilibrium. */
  numericSumFx: string;
  /** Formatted symbolic equation string for vertical equilibrium (e.g., '∑Fy = F_AF·sin(45°) + ... = 0'). */
  symbolicSumFy: string;
  /** Formatted numeric substitution string for vertical equilibrium. */
  numericSumFy: string;
}

/**
 * Master output container returned by the Direct Stiffness Solver for the entire structure.
 */
export interface StructuralAnalysisSummary {
  /** Map of nodeId -> NodeAnalysisResult. */
  nodes: Record<string, NodeAnalysisResult>;
  /** Map of beamId -> BeamAnalysisResult. */
  beams: Record<string, BeamAnalysisResult>;
  /** Map of nodeId -> JointEquilibriumAnalysis for interactive Free Body Diagrams. */
  jointFBDs: Record<string, JointEquilibriumAnalysis>;
  /** Highest utilization ratio (|sigma| / sigma_yield) across all beams in the bridge. */
  maxUtilizationRatio: number;
  /** ID of the beam experiencing peak stress utilization. */
  criticalBeamId: string | null;
  /** Maximum nodal deflection magnitude (in mm) across all joints. */
  maxDisplacementMm: number;
  /** ID of the joint experiencing maximum elastic deflection. */
  maxDeflectionNodeId: string | null;
  /** Total mass of a single truss plane in kilograms (kg). */
  totalBridgeMassKg: number;
  /** Sum of all external point load magnitudes applied to the bridge in kN. */
  totalAppliedLoadKN: number;
  /** Count of beams exceeding 100% of their material's yield strength. */
  overstressedBeamCount: number;
  /** Count of beams between 80% and 100% of their material's yield strength. */
  criticalBeamCount: number;
  /** Indicates whether the structural stiffness matrix solved cleanly without mechanism collapse. */
  isStable: boolean;
  /** Diagnostic notes emitted by the solver. */
  solverNotes: string[];
}

/**
 * Defines a built-in or scanned mechanical engineering worksheet problem preset.
 */
export interface WorksheetPreset {
  /** Unique preset ID. */
  id: string;
  /** Problem title. */
  title: string;
  /** Descriptive engineering subtitle. */
  subtitle: string;
  /** University course code badge for worksheet authenticity. */
  courseCode: string;
  /** Detailed problem statement. */
  description: string;
  /** Short span and member count summary. */
  spanSummary: string;
  /** Initial 2D joint coordinates and supports. */
  nodes: StructuralNode[];
  /** Initial structural beams and material assignments. */
  beams: StructuralBeam[];
  /** Initial external point loads. */
  loads: ExternalLoad[];
  /** Engineering notes explaining detected features and assumptions. */
  extractionNotes: string[];
  /** 3D bridge extrapolation assumptions for the 3D simulation viewport. */
  presumption3D: Bridge3DPresumption;
  /** Data URL of the 2D engineering worksheet schematic underlay. */
  worksheetSvgDataUrl: string;
}
