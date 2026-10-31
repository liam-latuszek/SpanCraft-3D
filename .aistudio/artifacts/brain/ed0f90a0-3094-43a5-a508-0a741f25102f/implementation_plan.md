# SpanCraft 3D — Structural Worksheet Vision & 3D Stress Simulator

SpanCraft 3D transforms static 2D mechanical and civil engineering worksheet photos into an interactive 3D structural simulation set in a clean, stylized valley landscape. It combines multimodal diagram extraction, an interactive 2D topology editor, a real-time Direct Stiffness Method (DSM) physics solver, per-beam material customization, and interactive Joint Free Body Diagrams (FBDs) with step-by-step equilibrium equations.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and UX decisions incorporate your confirmed preferences from our planning Q&A:

- **Confirmed Physics Engine — Direct Stiffness Solver (2D/3D Trusses & Frames)**: Computes exact nodal displacements, support reactions, internal axial/bending forces, normal stresses ($\sigma$), and yield utilization ratios ($\text{UR} = |\sigma| / \sigma_{\text{yield}}$) in real time whenever loads, geometry, or beam materials change.
- **Confirmed Companion Tools — 2D Graph Editor, Step-by-Step Joint FBD Equations & Report Export**: Includes an interactive 2D node/beam/load editor to refine scanned worksheets, symbolic and numeric $\sum F_x = 0$ and $\sum F_y = 0$ derivations on joint click, and one-click CSV and printable PDF engineering report exports.
- **Confirmed Visual Direction — Dual-Theme UI + Stylized Scenic Hills 3D Backdrop**: Features a light/dark theme toggle paired with a clean, stylized low-poly scenic environment (rolling green hills, river canyon, stone bridge abutments, and atmospheric sky fog) that shifts between crisp daylight and dusk CAD lighting—with a toggle to switch between the scenic valley and a pure technical grid whenever desired.

---

## 1. Overview & Core Concept

- **What It Does**: Engineers and students upload a photo of a 2D bridge or truss worksheet (or pick from curated engineering problem presets). The app extracts every joint, beam, support condition (pin, roller, fixed), and external load vector, renders an interactive 2D schematic for verification, and extrudes the structure into a 3D bridge spanning a stylized valley. Beams dynamically change color as their internal stress approaches the selected material's yield strength, and clicking any joint opens a dedicated Free Body Diagram with vector decomposition and equilibrium math.
- **Target Audience / Persona**: Mechanical and civil engineering students, educators, and structural hobbyists who want intuitive visual feedback bridging textbook 2D statics/mechanics of materials problems and 3D finite-element behavior.
- **Key Value**: Eliminates the disconnect between static paper diagrams and physical intuition by letting users see real-time force paths, test "what-if" material swaps on individual beams, and inspect exact joint equilibrium equations on demand.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Worksheet Capture & Extraction Flow**:
   - User uploads or drags in a photo/screenshot of a 2D engineering worksheet (or selects a built-in textbook problem such as a *Pratt River Bridge*, *Warren Canyon Truss*, *Howe Arch Truss*, or *Cantilever Crane Frame*).
   - Server-side multimodal vision analysis extracts normalized joint coordinates, member connectivity, pin/roller supports, and external point loads.
   - The **Interactive 2D Graph Editor** overlays the extracted topology on the worksheet image so the user can drag nodes, add/remove members, adjust load magnitudes/angles, or toggle support types with immediate solver feedback.

2. **3D Scenic Simulation & Per-Beam Material Customization Flow**:
   - The 2D truss/frame is extruded into a 3D structural bridge complete with gusset plates, pin joints, cross-bracing, and bridge deck resting on stylized hillside abutments.
   - 3D arrow vectors display applied external loads (amber/orange) and computed support reactions (cyan/emerald) with live floating force readouts in $\text{kN}$.
   - Clicking any **Beam** in the 3D scene highlights the member and opens the **Beam Material & Section Inspector**, allowing the user to assign individual materials (*Structural Steel A36*, *High-Strength Steel A572*, *6061-T6 Aluminum*, *Douglas Fir Timber*, *Reinforced Concrete*, *Carbon Fiber Composite*, or custom $E$ and $\sigma_{\text{yield}}$) and cross-sectional area ($A$).
   - The solver immediately recomputes the global stiffness matrix and updates beam stress colors across the structure, showing how stiffness changes redistribute loads and alter safety factors.

3. **Joint Click & Free Body Diagram (FBD) Inspection Flow**:
   - Clicking any **Joint / Node** in the 3D bridge (or 2D editor) smoothly glides the camera toward that joint and opens the **Interactive Joint FBD Inspector**.
   - Renders a high-precision vector diagram centered on the selected joint $(x, y)$, plotting all concurrent forces: external loads, support reactions, and each connected member's tension (pulling away from the joint) or compression (pushing into the joint) vector with angle arcs.
   - Displays the complete **Step-by-Step Equilibrium Breakdown** ($\sum F_x = 0$, $\sum F_y = 0$, and resultant verification) alongside a member force table.

4. **Structural Report Export Flow**:
   - Clicking **Export Report** generates either a clean **CSV dataset** of all nodes, beams, materials, internal forces, stresses, and safety factors, or opens a formatted **Engineering Analysis Report (Print / PDF)** containing the project summary, material schedule, nodal displacements, member stress table, and active Joint FBD diagram.

### Visual Identity & Theme

- **Aesthetic Direction**: Precision Engineering Studio meets Stylized Scenic Diorama—clean, uninhibited technical typography and tabular telemetry paired with an inviting, distraction-free 3D valley illustration.
- **Dual-Theme Color Palette & Atmospheric Tokens**:
  - **Light Mode (Daylight Engineering Lab)**:
    - *60% Canvas & 3D Sky*: Crisp laboratory alabaster (`#F8FAFC`) UI surfaces; warm sunlit sky gradient (`#E0F2FE` to `#F0F9FF`) with stylized sage-emerald rolling hills (`#6EE7B7` / `#34D399`) and river water (`#38BDF8`).
    - *30% Structural Surfaces*: Pure white panels (`#FFFFFF`), slate hairline borders (`#E2E8F0`), deep slate ink (`#0F172A`), and muted technical labels (`#475569`).
  - **Dark Mode (Twilight CAD Studio)**:
    - *60% Canvas & 3D Sky*: Deep obsidian slate (`#0B1120`) UI surfaces; twilight horizon sky (`#0F172A` to `#1E293B`) with muted low-poly midnight hills (`#1E293B` / `#064E3B`) so glowing stress heatmaps pop with maximum contrast.
    - *30% Structural Surfaces*: Elevated slate panels (`#111827`), subtle borders (`#1E293B`), crisp off-white typography (`#F8FAFC`), and cool silver metadata (`#94A3B8`).
  - **10% Semantic Stress & Force Accents (Dual-Coded with Labels & Icons)**:
    - *Safe / Low Stress ($0\text{--}50\%$ Yield)*: Emerald (`#10B981`) paired with `NOMINAL` badge.
    - *Moderate Stress ($50\text{--}80\%$ Yield)*: Sky / Cyan (`#0EA5E9`) to Amber (`#F59E0B`) paired with `MODERATE` / `ELEVATED` indicator.
    - *Critical / Near Maximum Stress ($80\text{--}100\%$ Yield)*: High-visibility Orange-Red (`#F97316` to `#EF4444`) paired with `CRITICAL` warning icon.
    - *Yielded / Buckled ($>100\%$ Yield)*: Deep Crimson (`#DC2626`) with wireframe yield indicator and `OVERSTRESSED` alert.
- **Typography & Hierarchy**:
  - *Display & UI Headings*: `Space Grotesk` or `Outfit` (SemiBold 600, tight tracking) for structural titles and section headers.
  - *Body & Controls*: `Plus Jakarta Sans` (Regular 400 / Medium 500) for clean, legible control labels.
  - *Engineering Telemetry & Equations*: `JetBrains Mono` with `tabular-nums` for force magnitudes ($\text{kN}$), stresses ($\text{MPa}$), safety factors ($\text{FoS}$), nodal coordinates, and equilibrium equations.
- **Component Styling & Spatial Layout**:
  - **Top Bar Contract**: Single-row header with Brand Wordmark on the left, concise workspace view links (*3D Simulation*, *2D Worksheet Editor*, *Joint FBD*, *Stress Schedule*) in the center, and primary actions (*Upload Worksheet*, *Export Report*, and *Theme Toggle*) on the right.
  - **Unobstructed 3D Viewport + Collapsible Bottom Dock**: The central 3D bridge scene fills the workspace. Camera presets, deformation exaggeration slider ($1\times\text{--}200\times$), scenic hills vs. technical grid toggle, and batch material controls live in a sleek, collapsible bottom dock so the 3D bridge is never crowded.
  - **Contextual Inspector Drawer**: Selecting a beam or joint opens a clean right-hand inspector panel for material customization or the interactive Joint Free Body Diagram.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct Stiffness Method (DSM) vs. Simplified Static Method of Joints**
  - *Chosen Approach*: Full 2D/3D Direct Stiffness Matrix solver supporting both axial truss elements and flexural frame elements.
  - *Why*: Unlike simple static determinacy solvers that fail when a bridge has redundant bracing or when materials are changed, the Direct Stiffness Method uses each beam's Young's Modulus ($E$) and cross-sectional area ($A$) in the element stiffness matrix ($k = \frac{EA}{L}$). Changing a single beam's material from Steel to Aluminum or Timber physically alters both its yield stress limit and how forces redistribute across indeterminate trusses.
  - *Alternatives Considered*: Pure static equilibrium ($2J = M + R$), which cannot solve indeterminate bridges or reflect stiffness-driven load redistribution.

- **Decision 2: Stylized Low-Poly Scenic Environment in Three.js**
  - *Chosen Approach*: Procedurally generated low-poly terraced hills, canyon river, clouds, and stone bridge abutments built with flat-shaded `THREE.MeshStandardMaterial` and `RoomEnvironment` lighting, plus an instant toggle to switch between "Scenic Valley" and "CAD Blueprint Grid".
  - *Why*: Gives the bridge immediate physical scale, context, and visual charm (similar to *Poly Bridge* meets professional FEA software) while keeping rendering 100% self-contained, fast, and crystal-clear behind the stress-colored beams.
  - *Alternatives Considered*: Static 2D background wallpaper, which breaks parallax when orbiting the 3D bridge in 360 degrees.

- **Decision 3: Two-Stage Vision-to-Simulation Pipeline (AI Extraction + 2D Graph Editor)**
  - *Chosen Approach*: Multimodal Gemini extraction populates a live, editable 2D structural graph rather than locking the user into an uneditable black-box 3D mesh.
  - *Why*: Handwritten or photographed engineering worksheets often have varied notation or missing scale assumptions. Allowing users to inspect and tweak extracted nodes, supports, and load vectors in a synchronized 2D overlay guarantees 100% accuracy in the 3D simulation.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Top Navigation & Action Bar                           │
│  [SpanCraft 3D]     [3D Sim · 2D Editor · Joint FBD · Schedule]   [Upload]   │
└───────────────────┬──────────────────────────────────────┬───────────────────┘
                    │                                      │
                    ▼                                      ▼
┌─────────────────────────────────────────┐  ┌─────────────────────────────────┐
│     Client Structural State Store       │  │   Express Server Proxy (/api)   │
│  • Nodes (id, x, y, z, supportType)     │◄─┤  POST /api/worksheet/analyze    │
│  • Beams (id, n1, n2, materialId, area) │  │  • @google/genai (gemini-3.8-   │
│  • Loads (id, nodeId, fx, fy, magnitude)│  │    flash + responseSchema)      │
│  • Materials Library & Custom Specs     │  │  • Extracts nodes, beams,       │
└─────────┬───────────────────┬───────────┘  │    supports & force vectors     │
          │                   │              └─────────────────────────────────┘
          ▼                   ▼
┌─────────────────────┐ ┌──────────────────────────────────────────────────────┐
│ Direct Stiffness    │ │           Main Interactive Workspace                 │
│ Physics Engine      │ │                                                      │
│ • Global K Matrix   │ │  ┌────────────────────────────────────────────────┐  │
│ • Gaussian Solver   │ │  │ 3D Scenic Bridge Viewport (Three.js / WebGL)   │  │
│ • Displacements (u) │─┼─►│ • Stylized Low-Poly Hills, River & Abutments   │  │
│ • Member Forces (N) │ │  │ • 3D Extruded I-Beams / Trusses + Stress Color │  │
│ • Stress & FoS      │ │  │ • 3D Force & Reaction Arrows + Raycast Picker  │  │
│ • Joint FBD Vectors │ │  └────────────────────────────────────────────────┘  │
└─────────────────────┘ │  ┌───────────────────────┐ ┌──────────────────────┐  │
                        │  │ 2D Worksheet & Graph  │ │ Contextual Inspector │  │
                        │  │ Editor (Split/Tab)    │ │ • Beam Material Pick │  │
                        │  │ • Photo Underlay      │ │ • Interactive Joint  │  │
                        │  │ • Drag Nodes & Loads  │ │   FBD + ∑Fx/∑Fy Math │  │
                        │  └───────────────────────┘ └──────────────────────┘  │
                        │  ┌────────────────────────────────────────────────┐  │
                        │  │ Collapsible Bottom Control Dock                │  │
                        │  │ • Stress Legend | Deform Scale | Scenic/CAD    │  │
                        │  └────────────────────────────────────────────────┘  │
                        └──────────────────────────────────────────────────────┘
```

### Data Model & State

- **`StructuralNode`**:
  - `id`: String identifier (e.g., `"A"`, `"B"`, `"C"`).
  - `x`, `y`, `z`: Spatial coordinates in meters ($\text{m}$).
  - `support`: `"none" | "pin" | "roller_x" | "roller_y" | "fixed"`.
  - *Computed*: `displacement: { dx, dy }`, `reaction: { rx, ry, magnitude }`.
- **`StructuralBeam`**:
  - `id`: String identifier (e.g., `"AB"`, `"BC"`).
  - `startNodeId`, `endNodeId`: Connected joint IDs.
  - `materialId`: Reference to material preset or custom material.
  - `crossSectionArea`: Area in $\text{cm}^2$ (default e.g. $25\text{ cm}^2$) and profile type (`"i-beam" | "box" | "tube"`).
  - *Computed*: `length` ($\text{m}$), `axialForce` ($\text{kN}$, positive = Tension, negative = Compression), `normalStress` ($\text{MPa}$), `utilizationRatio` ($|\sigma| / \sigma_{\text{yield}}$), `safetyFactor` ($\sigma_{\text{yield}} / |\sigma|$), `status` (`"nominal" | "moderate" | "elevated" | "critical" | "overstressed"`).
- **`MaterialSpec`**:
  - `id`, `name`, `category`: e.g., *Structural Steel (ASTM A36)*, *High-Strength Steel (A572 Gr.50)*, *Aluminum Alloy (6061-T6)*, *Structural Timber (Douglas Fir)*, *Carbon Fiber Composite (CFRP)*, *Cast Iron / Concrete*.
  - `youngsModulusGPa`: Elastic modulus $E$ ($\text{GPa}$).
  - `yieldStrengthMPa`: Maximum allowable/yield stress $\sigma_{\text{yield}}$ ($\text{MPa}$).
  - `densityKgM3`: Material density for optional self-weight dead load calculation.
  - `baseVisualFinish`: Roughness and metalness parameters for 3D rendering when in unstressed view mode.
- **`ExternalLoad`**:
  - `id`, `nodeId`, `magnitudeKN` ($\text{kN}$), `angleDeg` (degrees, e.g. $-90^\circ$ for downward gravity load), `fx`, `fy`.

### Interactive Component & State Mapping

- **Worksheet Upload & Preset Switcher**:
  - Uploading an image converts it to Base64, displays it in the 2D Worksheet Underlay, and posts to `POST /api/worksheet/analyze`.
  - While Gemini extracts the structure, a progress indicator shows extraction status; once returned, the client validates node connectivity, runs the Direct Stiffness Solver, and animates the 3D bridge construction.
  - Selecting any built-in worksheet preset immediately loads the corresponding 2D schematic and 3D bridge with zero latency.
- **3D Raycasting & Selection Synchronization**:
  - Hovering over a 3D beam or spherical pin joint shows a crisp floating HUD tooltip with its ID, force/reaction, stress ($\text{MPa}$), and material name.
  - Clicking a **Beam** selects it, opens the Beam Material Inspector, and allows one-click material swapping, custom yield strength/Young's modulus sliders, cross-section sizing, or "Apply Material to All Chord/Web Beams".
  - Clicking a **Joint** smoothly focuses the camera and opens the **Joint Free Body Diagram Inspector**, rendering an interactive SVG vector diagram of the isolated joint with toggleable angle arcs, component projections ($F \cos\theta$, $F \sin\theta$), and full $\sum F_x = 0$ and $\sum F_y = 0$ algebraic equations.
- **Interactive 2D Graph Editor**:
  - Allows dragging joints (with optional snap-to-grid), clicking to add new joints/beams, toggling pin/roller supports, and adjusting external load vectors—re-solving the 3D bridge in real time on every change.
- **Collapsible Bottom Control Dock**:
  - Houses the continuous Stress Color Scale legend ($0\%$ to $100\%+$ yield), Deformation Magnification slider ($1\times$ to $250\times$), Dead-Load (self-weight) toggle, Scenic Hills vs. Technical Grid environment toggle, and Camera Preset buttons (*Perspective*, *Front Elevation*, *Top Plan*, *Reset*).
