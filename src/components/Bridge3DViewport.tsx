/**
 * ============================================================================
 * FILE: src/components/Bridge3DViewport.tsx
 * DESCRIPTION:
 * Interactive Three.js WebGL 3D Bridge Simulation Viewport.
 * Extrudes the 2D structural worksheet graph into a 3D twin-plane bridge
 * complete with composite wide-flange I-beams, box girders, tubular struts,
 * gusset pin joints, support pedestals (Pin/Roller), roadway deck, 3D force
 * and reaction arrows, and a stylized low-poly scenic valley (hills, river,
 * canyon piers, trees, and clouds).
 * ============================================================================
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  StructuralNode,
  StructuralBeam,
  ExternalLoad,
  StructuralAnalysisSummary,
  Bridge3DPresumption,
} from '../types/structural';

/**
 * Props accepted by the Bridge3DViewport component.
 */
interface Bridge3DViewportProps {
  /** Structural joints (nodes) with 2D coordinates and support types. */
  nodes: StructuralNode[];
  /** Structural beams connecting pairs of joints. */
  beams: StructuralBeam[];
  /** Applied external point forces acting on joints. */
  loads: ExternalLoad[];
  /** Real-time Direct Stiffness Solver output summary. */
  analysis: StructuralAnalysisSummary;
  /** 3D bridge extrapolation assumptions (width, archetype, deck placement). */
  presumption3D?: Bridge3DPresumption;
  /** Currently selected joint ID. */
  selectedNodeId: string | null;
  /** Currently selected beam ID. */
  selectedBeamId: string | null;
  /** Callback invoked when a 3D joint is clicked. */
  onSelectNode: (nodeId: string) => void;
  /** Callback invoked when a 3D beam is clicked. */
  onSelectBeam: (beamId: string) => void;
  /** Optional callback invoked when a 3D external force arrow is clicked. */
  onSelectLoad?: (loadId: string) => void;
  /** Visual magnification multiplier for elastic nodal displacements. */
  deformScale: number;
  /** Whether to overlay a ghost wireframe of the undeformed bridge geometry. */
  showUndeformedGhost: boolean;
  /** Color mode: 'stress' (heatmap based on yield %) or 'material' (natural finish). */
  colorMode: 'stress' | 'material';
  /** True to render the stylized scenic hills valley; false for CAD technical grid. */
  scenicBackdrop: boolean;
  /** True when the application is in Dark Twilight CAD theme. */
  isDark: boolean;
  /** Trigger object for smooth animated camera preset transitions. */
  cameraPresetTrigger: { preset: 'iso' | 'front' | 'top' | 'side'; seq: number };
}

/**
 * Data structure for the floating 3D hover telemetry tooltip.
 */
interface HoverTooltip {
  x: number;
  y: number;
  kind: 'node' | 'beam' | 'load';
  id: string;
  title: string;
  subtitle: string;
  metric1: string;
  metric2: string;
  statusColor: string;
}

/**
 * ============================================================================
 * SECTION 1: SOFTWARE WEBGL DETECTION & REUSABLE MATH VECTORS
 * Detects CPU-bound software WebGL (SwiftShader/llvmpipe) to pace frames and
 * pre-allocates module-scope Three.js math objects to avoid GC pauses.
 * ============================================================================
 */
const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return false;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
})();

const _tempVec3A = new THREE.Vector3();
const _tempDir = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);
const _tempQuat = new THREE.Quaternion();

/**
 * ============================================================================
 * SECTION 2: 3D FORCE & REACTION ARROW GENERATOR
 * Builds a composite 3D vector arrow (cylindrical shaft, metallic collar ring,
 * and conical arrowhead) oriented at `angleDeg` and pointing either into or
 * away from a joint. Also attaches an invisible raycast proxy cylinder when
 * `loadId` is provided so users can click 3D load arrows to customize them.
 * ============================================================================
 */
function createForceArrowGroup(
  targetPoint: THREE.Vector3,
  angleDeg: number,
  length: number,
  colorHex: string,
  pointsIntoNode: boolean,
  loadId?: string
): THREE.Group {
  const group = new THREE.Group();
  const rad = (angleDeg * Math.PI) / 180;
  const dir = new THREE.Vector3(Math.cos(rad), Math.sin(rad), 0).normalize();

  const headLength = Math.min(0.65, length * 0.32);
  const headRadius = 0.22;
  const shaftLength = Math.max(0.2, length - headLength);
  const shaftRadius = 0.085;

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: 0.25,
    metalness: 0.35,
    emissive: new THREE.Color(colorHex),
    emissiveIntensity: 0.18,
  });

  const collarMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.6,
  });

  const localArrow = new THREE.Group();

  // Arrow cylindrical shaft
  const shaftGeo = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 14);
  const shaftMesh = new THREE.Mesh(shaftGeo, mat);
  shaftMesh.position.y = shaftLength * 0.5;
  localArrow.add(shaftMesh);

  // Accent collar ring between shaft and cone
  const collarGeo = new THREE.CylinderGeometry(
    shaftRadius * 1.45,
    shaftRadius * 1.45,
    0.08,
    14
  );
  const collarMesh = new THREE.Mesh(collarGeo, collarMat);
  collarMesh.position.y = shaftLength;
  localArrow.add(collarMesh);

  // Conical arrowhead
  const headGeo = new THREE.ConeGeometry(headRadius, headLength, 16);
  const headMesh = new THREE.Mesh(headGeo, mat);
  headMesh.position.y = shaftLength + headLength * 0.5;
  localArrow.add(headMesh);

  // Optional clickable raycast proxy cylinder for external loads
  if (loadId) {
    const proxyGeo = new THREE.CylinderGeometry(0.32, 0.32, length, 8);
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    const proxyMesh = new THREE.Mesh(proxyGeo, proxyMat);
    proxyMesh.position.y = length * 0.5;
    proxyMesh.layers.set(1);
    proxyMesh.userData = { kind: 'load', id: loadId };
    localArrow.add(proxyMesh);
  }

  // Rotate local +Y axis to align with the force vector direction
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  localArrow.quaternion.copy(q);

  const standoff = 0.42;
  if (pointsIntoNode) {
    const tailPos = targetPoint.clone().sub(dir.clone().multiplyScalar(length + standoff));
    localArrow.position.copy(tailPos);
  } else {
    const tailPos = targetPoint.clone().add(dir.clone().multiplyScalar(standoff));
    localArrow.position.copy(tailPos);
  }

  group.add(localArrow);
  return group;
}

/**
 * ============================================================================
 * SECTION 3: 3D COMPOSITE STRUCTURAL BEAM GENERATOR
 * Constructs a multi-part 3D structural member between points `p1` and `p2`
 * using the selected profile ('i_beam', 'box_girder', or 'tubular'), scaled
 * by cross-sectional area and colored according to real-time stress or material.
 * ============================================================================
 */
function createCompositeBeamGroup(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  profile: 'i_beam' | 'box_girder' | 'tubular',
  areaCm2: number,
  colorHex: string,
  roughness: number,
  metalness: number,
  isSelected: boolean,
  isOverstressed: boolean,
  beamId: string
): THREE.Group {
  const group = new THREE.Group();
  const diff = _tempDir.subVectors(p2, p1);
  const len = diff.length();
  if (len < 1e-4) return group;

  // Position group at midpoint and orient local +Y along the beam vector
  const mid = _tempVec3A.addVectors(p1, p2).multiplyScalar(0.5);
  group.position.copy(mid);

  const dirNorm = diff.clone().normalize();
  _tempQuat.setFromUnitVectors(_upVec, dirNorm);
  group.quaternion.copy(_tempQuat);

  // Scale member cross-section dimensions proportionally to areaCm2
  const scaleFactor = Math.max(0.75, Math.min(1.55, Math.sqrt(areaCm2 / 14)));
  const depth = 0.24 * scaleFactor;
  const width = 0.2 * scaleFactor;
  const flangeThick = 0.045 * scaleFactor;
  const webThick = 0.04 * scaleFactor;

  const mainColor = new THREE.Color(colorHex);
  const webMat = new THREE.MeshStandardMaterial({
    color: mainColor,
    roughness: Math.min(1, roughness + 0.12),
    metalness: Math.max(0, metalness - 0.1),
    emissive: isSelected
      ? new THREE.Color('#38BDF8')
      : isOverstressed
      ? new THREE.Color('#EF4444')
      : new THREE.Color(0x000000),
    emissiveIntensity: isSelected ? 0.35 : isOverstressed ? 0.25 : 0,
  });

  const flangeMat = new THREE.MeshStandardMaterial({
    color: mainColor.clone().offsetHSL(0, 0, 0.06),
    roughness: Math.max(0.1, roughness - 0.1),
    metalness,
    emissive: isSelected
      ? new THREE.Color('#38BDF8')
      : isOverstressed
      ? new THREE.Color('#EF4444')
      : new THREE.Color(0x000000),
    emissiveIntensity: isSelected ? 0.35 : isOverstressed ? 0.25 : 0,
  });

  const effectiveLen = Math.max(0.1, len - 0.28);

  if (profile === 'i_beam') {
    // Wide-flange I-beam: Central web + 2 outer flanges
    const webGeo = new THREE.BoxGeometry(
      webThick,
      effectiveLen,
      depth - flangeThick * 2
    );
    const webMesh = new THREE.Mesh(webGeo, webMat);
    webMesh.castShadow = !isSoftwareGl;
    webMesh.receiveShadow = !isSoftwareGl;
    group.add(webMesh);

    const flangeGeo = new THREE.BoxGeometry(width, effectiveLen, flangeThick);
    const f1 = new THREE.Mesh(flangeGeo, flangeMat);
    f1.position.z = (depth - flangeThick) * 0.5;
    f1.castShadow = !isSoftwareGl;
    group.add(f1);

    const f2 = new THREE.Mesh(flangeGeo, flangeMat);
    f2.position.z = -(depth - flangeThick) * 0.5;
    f2.castShadow = !isSoftwareGl;
    group.add(f2);
  } else if (profile === 'box_girder') {
    // Hollow box girder with side stiffening ribs
    const coreGeo = new THREE.BoxGeometry(width, effectiveLen, depth);
    const coreMesh = new THREE.Mesh(coreGeo, flangeMat);
    coreMesh.castShadow = !isSoftwareGl;
    coreMesh.receiveShadow = !isSoftwareGl;
    group.add(coreMesh);

    const ribGeo = new THREE.BoxGeometry(
      width * 1.06,
      effectiveLen * 0.92,
      depth * 0.45
    );
    const ribMesh = new THREE.Mesh(ribGeo, webMat);
    group.add(ribMesh);
  } else {
    // Hollow structural tube with end collar rings
    const tubeGeo = new THREE.CylinderGeometry(
      width * 0.52,
      width * 0.52,
      effectiveLen,
      16
    );
    const tubeMesh = new THREE.Mesh(tubeGeo, flangeMat);
    tubeMesh.castShadow = !isSoftwareGl;
    group.add(tubeMesh);

    const ringGeo = new THREE.CylinderGeometry(
      width * 0.64,
      width * 0.64,
      0.12,
      16
    );
    const r1 = new THREE.Mesh(ringGeo, webMat);
    r1.position.y = effectiveLen * 0.42;
    group.add(r1);

    const r2 = new THREE.Mesh(ringGeo, webMat);
    r2.position.y = -effectiveLen * 0.42;
    group.add(r2);
  }

  // Add wireframe warning sleeve when beam is selected or overstressed (>= 100% yield)
  if (isSelected || isOverstressed) {
    const haloGeo = new THREE.BoxGeometry(
      width * 1.35,
      effectiveLen * 0.98,
      depth * 1.35
    );
    const haloMat = new THREE.MeshBasicMaterial({
      color: isSelected ? 0x38bdf8 : 0xef4444,
      wireframe: true,
      transparent: true,
      opacity: isSelected ? 0.65 : 0.45,
    });
    group.add(new THREE.Mesh(haloGeo, haloMat));
  }

  // Invisible collision proxy cylinder on Layer 1 for responsive pointer picking
  const proxyGeo = new THREE.CylinderGeometry(0.32, 0.32, len, 8);
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  const proxyMesh = new THREE.Mesh(proxyGeo, proxyMat);
  proxyMesh.layers.set(1);
  proxyMesh.userData = { kind: 'beam', id: beamId };
  group.add(proxyMesh);

  return group;
}

/**
 * ============================================================================
 * SECTION 4: STYLIZED LOW-POLY SCENIC VALLEY ENVIRONMENT BUILDER
 * Generates a clean, cartoonish/low-poly landscape featuring rolling green
 * hills, canyon embankments, a river beneath the bridge, stone support piers,
 * pine trees, and stylized clouds.
 * ============================================================================
 */
function buildScenicValleyEnvironment(
  minX: number,
  maxX: number,
  minY: number,
  supportNodes: StructuralNode[],
  centerX: number,
  centerY: number,
  transverseWidthM: number,
  isDark: boolean
): THREE.Group {
  const envGroup = new THREE.Group();
  const span = Math.max(12, maxX - minX);
  const groundRefY = minY - centerY;

  const hillColorPrimary = isDark ? 0x064e3b : 0x34d399;
  const hillColorSecondary = isDark ? 0x0f392b : 0x10b981;
  const hillColorDistant = isDark ? 0x1e293b : 0x6ee7b7;
  const rockColor = isDark ? 0x334155 : 0x94a3b8;
  const waterColor = isDark ? 0x0284c7 : 0x38bdf8;

  const hillMat1 = new THREE.MeshStandardMaterial({
    color: hillColorPrimary,
    roughness: 0.88,
    metalness: 0.04,
    flatShading: true,
  });
  const hillMat2 = new THREE.MeshStandardMaterial({
    color: hillColorSecondary,
    roughness: 0.92,
    metalness: 0.02,
    flatShading: true,
  });
  const distantHillMat = new THREE.MeshStandardMaterial({
    color: hillColorDistant,
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true,
  });
  const cliffMat = new THREE.MeshStandardMaterial({
    color: rockColor,
    roughness: 0.85,
    metalness: 0.08,
    flatShading: true,
  });

  // 1. River Valley Water Plane & Canyon Floor
  const canyonDepth = 5.2;
  const riverWidth = span * 0.72;
  const waterGeo = new THREE.BoxGeometry(riverWidth, 0.4, 70);
  const waterMat = new THREE.MeshStandardMaterial({
    color: waterColor,
    roughness: 0.18,
    metalness: 0.25,
    transparent: true,
    opacity: 0.88,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(0, groundRefY - canyonDepth, 0);
  waterMesh.receiveShadow = !isSoftwareGl;
  envGroup.add(waterMesh);

  const bedGeo = new THREE.BoxGeometry(span * 4, 1.0, 90);
  const bedMesh = new THREE.Mesh(bedGeo, cliffMat);
  bedMesh.position.set(0, groundRefY - canyonDepth - 0.6, 0);
  envGroup.add(bedMesh);

  // 2. Left & Right Canyon Embankments
  const leftBankX = minX - centerX - span * 0.55;
  const rightBankX = maxX - centerX + span * 0.55;
  const bankWidth = span * 1.15;

  const leftBankGeo = new THREE.BoxGeometry(bankWidth, canyonDepth, 70);
  const leftBank = new THREE.Mesh(leftBankGeo, hillMat1);
  leftBank.position.set(leftBankX, groundRefY - canyonDepth * 0.5 - 0.25, 0);
  leftBank.receiveShadow = !isSoftwareGl;
  envGroup.add(leftBank);

  const rightBankGeo = new THREE.BoxGeometry(bankWidth, canyonDepth, 70);
  const rightBank = new THREE.Mesh(rightBankGeo, hillMat1);
  rightBank.position.set(rightBankX, groundRefY - canyonDepth * 0.5 - 0.25, 0);
  rightBank.receiveShadow = !isSoftwareGl;
  envGroup.add(rightBank);

  // 3. Stylized Rolling Hills in Background & Flanks
  const hillConfigs = [
    { x: -span * 1.1, z: -18, r: 9, h: 11, mat: hillMat2 },
    { x: -span * 0.5, z: -24, r: 12, h: 15, mat: distantHillMat },
    { x: span * 0.15, z: -28, r: 14, h: 17, mat: distantHillMat },
    { x: span * 0.85, z: -22, r: 11, h: 13, mat: hillMat2 },
    { x: span * 1.35, z: -15, r: 8.5, h: 9.5, mat: hillMat1 },
    { x: -span * 1.3, z: 12, r: 7.5, h: 7.5, mat: hillMat1 },
    { x: span * 1.3, z: 14, r: 8, h: 8, mat: hillMat2 },
  ];

  for (const hc of hillConfigs) {
    const hillGeo = new THREE.ConeGeometry(hc.r, hc.h, 7);
    const hillMesh = new THREE.Mesh(hillGeo, hc.mat);
    hillMesh.position.set(hc.x, groundRefY - canyonDepth + hc.h * 0.5, hc.z);
    hillMesh.rotation.y = (hc.x * 0.3) % Math.PI;
    envGroup.add(hillMesh);
  }

  // 4. Stylized Low-Poly Trees on Canyon Banks
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
  const foliageMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x047857 : 0x059669,
    roughness: 0.8,
    flatShading: true,
  });

  const treePositions = [
    { x: minX - centerX - 3.2, z: -4.5, s: 1.0 },
    { x: minX - centerX - 5.5, z: -7.0, s: 1.25 },
    { x: minX - centerX - 4.0, z: 4.8, s: 0.9 },
    { x: maxX - centerX + 3.4, z: -5.2, s: 1.1 },
    { x: maxX - centerX + 6.0, z: -3.0, s: 1.3 },
    { x: maxX - centerX + 4.2, z: 5.0, s: 0.95 },
  ];

  for (const tp of treePositions) {
    const treeGroup = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.2, 0.9, 6),
      trunkMat
    );
    trunk.position.y = 0.45;
    treeGroup.add(trunk);

    const cone1 = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.5, 6), foliageMat);
    cone1.position.y = 1.4;
    treeGroup.add(cone1);

    const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 6), foliageMat);
    cone2.position.y = 2.15;
    treeGroup.add(cone2);

    treeGroup.scale.setScalar(tp.s);
    treeGroup.position.set(tp.x, groundRefY - 0.25, tp.z);
    envGroup.add(treeGroup);
  }

  // 5. Stylized Low-Poly Clouds
  const cloudMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x334155 : 0xffffff,
    roughness: 0.9,
    metalness: 0.0,
    flatShading: true,
  });
  const cloudClusters = [
    { x: -span * 0.6, y: groundRefY + 11.5, z: -16, s: 1.1 },
    { x: span * 0.45, y: groundRefY + 12.8, z: -19, s: 1.35 },
  ];
  for (const cc of cloudClusters) {
    const cg = new THREE.Group();
    const p1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 0), cloudMat);
    const p2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.0, 0), cloudMat);
    p2.position.set(1.3, -0.2, 0.2);
    const p3 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), cloudMat);
    p3.position.set(-1.2, -0.15, -0.1);
    cg.add(p1, p2, p3);
    cg.scale.setScalar(cc.s);
    cg.position.set(cc.x, cc.y, cc.z);
    envGroup.add(cg);
  }

  // 6. Concrete/Stone Bridge Piers under Support Joints
  const pierMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x475569 : 0xcbd5e1,
    roughness: 0.75,
    metalness: 0.1,
  });
  for (const sn of supportNodes) {
    const sx = sn.x - centerX;
    const sy = sn.y - centerY;
    const pierHeight = Math.max(1.5, sy - (groundRefY - canyonDepth));
    const pierGeo = new THREE.BoxGeometry(1.35, pierHeight, transverseWidthM + 1.5);
    const pierMesh = new THREE.Mesh(pierGeo, pierMat);
    pierMesh.position.set(sx, sy - pierHeight * 0.5 - 0.38, 0);
    pierMesh.receiveShadow = !isSoftwareGl;
    pierMesh.castShadow = !isSoftwareGl;
    envGroup.add(pierMesh);
  }

  return envGroup;
}

/**
 * ============================================================================
 * SECTION 5: MAIN 3D VIEWPORT REACT COMPONENT
 * Manages WebGLRenderer lifecycle, OrbitControls, Layer-1 raycasting, and
 * reactive 3D scene reconstruction when structural state changes.
 * ============================================================================
 */
export const Bridge3DViewport: React.FC<Bridge3DViewportProps> = ({
  nodes,
  beams,
  loads,
  analysis,
  presumption3D,
  selectedNodeId,
  selectedBeamId,
  onSelectNode,
  onSelectBeam,
  onSelectLoad,
  deformScale,
  showUndeformedGhost,
  colorMode,
  scenicBackdrop,
  isDark,
  cameraPresetTrigger,
}) => {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltip | null>(null);

  // Store latest React props in a mutable ref so WebGL event listeners always read fresh state
  const stateRef = useRef({
    nodes,
    beams,
    loads,
    analysis,
    presumption3D,
    selectedNodeId,
    selectedBeamId,
    onSelectNode,
    onSelectBeam,
    onSelectLoad,
    deformScale,
    showUndeformedGhost,
    colorMode,
    scenicBackdrop,
    isDark,
  });

  useEffect(() => {
    stateRef.current = {
      nodes,
      beams,
      loads,
      analysis,
      presumption3D,
      selectedNodeId,
      selectedBeamId,
      onSelectNode,
      onSelectBeam,
      onSelectLoad,
      deformScale,
      showUndeformedGhost,
      colorMode,
      scenicBackdrop,
      isDark,
    };
  });

  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    bridgeRoot: THREE.Group;
    environmentRoot: THREE.Group;
    requestRender: () => void;
    cameraTargetGoal: THREE.Vector3 | null;
    cameraPosGoal: THREE.Vector3 | null;
  } | null>(null);

  /**
   * Initialize Three.js WebGLRenderer, Studio RoomEnvironment, Lighting,
   * OrbitControls, and Raycasting once on mount.
   */
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 960;
    const height = mount.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 300);
    camera.position.set(0, 4.5, 22);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.maxDistance = 95;
    controls.minDistance = 4;
    controls.maxPolarAngle = Math.PI * 0.58;

    // 3-Point Studio & Sun Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x064e3b, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.65);
    keyLight.position.set(14, 24, 18);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 70;
    const d = 18;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.55);
    rimLight.position.set(-16, 10, -14);
    scene.add(rimLight);

    const bridgeRoot = new THREE.Group();
    const environmentRoot = new THREE.Group();
    scene.add(environmentRoot);
    scene.add(bridgeRoot);

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;

    /**
     * Paces frames on software WebGL contexts so CPU rendering never starves UI events.
     */
    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    /**
     * Coalesces scene renders on demand and smoothly interpolates camera transitions.
     */
    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        const tRef = threeRef.current;
        let stillMoving = false;

        if (tRef && tRef.cameraPosGoal && tRef.cameraTargetGoal) {
          camera.position.lerp(tRef.cameraPosGoal, 0.16);
          controls.target.lerp(tRef.cameraTargetGoal, 0.16);
          if (
            camera.position.distanceTo(tRef.cameraPosGoal) < 0.05 &&
            controls.target.distanceTo(tRef.cameraTargetGoal) < 0.05
          ) {
            tRef.cameraPosGoal = null;
            tRef.cameraTargetGoal = null;
          } else {
            stillMoving = true;
          }
        }

        if (controls.enableDamping) {
          if (controls.update()) stillMoving = true;
        } else {
          controls.update();
        }

        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty || stillMoving) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    controls.addEventListener('start', () => {
      if (threeRef.current) {
        threeRef.current.cameraPosGoal = null;
        threeRef.current.cameraTargetGoal = null;
      }
    });
    controls.addEventListener('change', requestRender);

    // Layer-1 Raycaster for Joint, Beam, and External Force Arrow picking
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const mouse = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverTime = 0;

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(
        e.clientX - pointerDownPos.x,
        e.clientY - pointerDownPos.y
      );
      if (dist > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(bridgeRoot.children, true);
      if (hits.length > 0) {
        const nodeHit = hits.find((h) => h.object.userData?.kind === 'node');
        const loadHit = hits.find((h) => h.object.userData?.kind === 'load');
        const picked = nodeHit || loadHit || hits[0];
        const { kind, id } = picked.object.userData || {};
        if (kind === 'node' && id) {
          stateRef.current.onSelectNode(id);
        } else if (kind === 'load' && id && stateRef.current.onSelectLoad) {
          stateRef.current.onSelectLoad(id);
        } else if (kind === 'beam' && id) {
          stateRef.current.onSelectBeam(id);
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 40) return;
      lastHoverTime = now;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(bridgeRoot.children, true);

      if (hits.length > 0) {
        const nodeHit = hits.find((h) => h.object.userData?.kind === 'node');
        const loadHit = hits.find((h) => h.object.userData?.kind === 'load');
        const picked = nodeHit || loadHit || hits[0];
        const { kind, id } = picked.object.userData || {};
        renderer.domElement.style.cursor = 'pointer';

        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        const st = stateRef.current;

        if (kind === 'node' && id) {
          const nRes = st.analysis.nodes[id];
          const fbd = st.analysis.jointFBDs[id];
          if (nRes) {
            setHoverTooltip({
              x: localX,
              y: localY,
              kind: 'node',
              id,
              title: `Joint ${id} (${nRes.x.toFixed(1)}m, ${nRes.y.toFixed(1)}m)`,
              subtitle:
                nRes.support === 'none'
                  ? 'Internal Pinned Gusset Joint · Click for Joint FBD'
                  : `Support: ${nRes.support.toUpperCase()} · Click for Joint FBD`,
              metric1: `Deflection: Δx=${nRes.dxMm.toFixed(2)}mm, Δy=${nRes.dyMm.toFixed(2)}mm`,
              metric2:
                nRes.reactionMagnitudeKN > 0.05
                  ? `Reaction R = ${nRes.reactionMagnitudeKN.toFixed(1)} kN`
                  : `${fbd?.vectors.length || 0} Concurrent Forces in Equilibrium`,
              statusColor: '#38BDF8',
            });
          }
        } else if (kind === 'load' && id) {
          const loadObj = st.loads.find((l) => l.id === id);
          if (loadObj) {
            setHoverTooltip({
              x: localX,
              y: localY,
              kind: 'load',
              id,
              title: `External Force @ Joint ${loadObj.nodeId}`,
              subtitle: 'Click to customize force strength (kN) or move joint',
              metric1: `Magnitude: ${loadObj.magnitudeKN} kN`,
              metric2: `Direction Angle: ${loadObj.angleDeg}°`,
              statusColor: '#F59E0B',
            });
          }
        } else if (kind === 'beam' && id) {
          const bRes = st.analysis.beams[id];
          if (bRes) {
            setHoverTooltip({
              x: localX,
              y: localY,
              kind: 'beam',
              id,
              title: `Beam ${id} (${bRes.startNodeId} → ${bRes.endNodeId})`,
              subtitle: `${bRes.material.name} · Click to Change Material`,
              metric1: `Force: ${Math.abs(bRes.axialForceKN).toFixed(1)} kN (${bRes.forceState})`,
              metric2: `Stress: ${bRes.absStressMPa.toFixed(1)} / ${bRes.effectiveYieldMPa} MPa (${(
                bRes.utilizationRatio * 100
              ).toFixed(0)}%)`,
              statusColor: bRes.stressColorHex,
            });
          }
        }
      } else {
        renderer.domElement.style.cursor = 'grab';
        setHoverTooltip(null);
      }
    };

    const handlePointerLeave = () => {
      setHoverTooltip(null);
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', handlePointerDown);
    domElem.addEventListener('pointerup', handlePointerUp);
    domElem.addEventListener('pointermove', handlePointerMove);
    domElem.addEventListener('pointerleave', handlePointerLeave);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
          requestRender();
        }
      }
    });
    resizeObserver.observe(mount);

    threeRef.current = {
      renderer,
      scene,
      camera,
      controls,
      bridgeRoot,
      environmentRoot,
      requestRender,
      cameraTargetGoal: null,
      cameraPosGoal: null,
    };

    requestRender();

    return () => {
      resizeObserver.disconnect();
      domElem.removeEventListener('pointerdown', handlePointerDown);
      domElem.removeEventListener('pointerup', handlePointerUp);
      domElem.removeEventListener('pointermove', handlePointerMove);
      domElem.removeEventListener('pointerleave', handlePointerLeave);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  /**
   * Smoothly animate camera position when user clicks a Camera Preset button.
   */
  useEffect(() => {
    const tRef = threeRef.current;
    if (!tRef) return;
    const { preset } = cameraPresetTrigger;
    tRef.cameraTargetGoal = new THREE.Vector3(0, 0.5, 0);
    if (preset === 'front') {
      tRef.cameraPosGoal = new THREE.Vector3(0, 1.2, 23);
    } else if (preset === 'top') {
      tRef.cameraPosGoal = new THREE.Vector3(0, 24, 0.01);
    } else if (preset === 'side') {
      tRef.cameraPosGoal = new THREE.Vector3(22, 2.5, 0);
    } else {
      tRef.cameraPosGoal = new THREE.Vector3(6, 5.5, 20);
    }
    tRef.requestRender();
  }, [cameraPresetTrigger]);

  /**
   * Reconstruct the 3D Bridge and Scenic Valley whenever nodes, beams, loads,
   * materials, deformation magnification, or theme change.
   */
  useEffect(() => {
    const tRef = threeRef.current;
    if (!tRef) return;
    const { scene, bridgeRoot, environmentRoot, requestRender } = tRef;

    const clearGroup = (g: THREE.Group) => {
      while (g.children.length > 0) {
        const child = g.children[0];
        g.remove(child);
      }
    };
    clearGroup(bridgeRoot);
    clearGroup(environmentRoot);

    // Configure sky background and distance fog
    if (scenicBackdrop) {
      const skyHex = isDark ? 0x0b1120 : 0xdbeafe;
      scene.background = new THREE.Color(skyHex);
      scene.fog = new THREE.FogExp2(skyHex, 0.012);
    } else {
      const cadHex = isDark ? 0x090d16 : 0xf1f5f9;
      scene.background = new THREE.Color(cadHex);
      scene.fog = new THREE.FogExp2(cadHex, 0.01);
    }

    if (nodes.length === 0) {
      requestRender();
      return;
    }

    // Compute bounding box center of the 2D truss
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const centerX = (minX + maxX) * 0.5;
    const centerY = (minY + maxY) * 0.5;

    const transverseWidthM = presumption3D?.transverseWidthM || 2.7;
    const halfWidthZ = transverseWidthM * 0.5;

    const supportNodes = nodes.filter((n) => n.support !== 'none');

    // 1. Build Scenic Hills Valley OR CAD Blueprint Grid
    if (scenicBackdrop) {
      const valley = buildScenicValleyEnvironment(
        minX,
        maxX,
        minY,
        supportNodes,
        centerX,
        centerY,
        transverseWidthM,
        isDark
      );
      environmentRoot.add(valley);
    } else {
      const gridY = minY - centerY - 0.55;
      const gridHelper = new THREE.GridHelper(
        60,
        60,
        isDark ? 0x38bdf8 : 0x0284c7,
        isDark ? 0x1e293b : 0xcbd5e1
      );
      gridHelper.position.y = gridY;
      environmentRoot.add(gridHelper);
    }

    // 2. Calculate deformed 3D joint positions for Front (+Z) and Rear (-Z) truss planes
    const nodePosFront = new Map<string, THREE.Vector3>();
    const nodePosBack = new Map<string, THREE.Vector3>();
    const nodePosUndef = new Map<string, THREE.Vector3>();

    for (const node of nodes) {
      const nRes = analysis.nodes[node.id];
      const dxM = ((nRes?.dxMm || 0) / 1000) * deformScale;
      const dyM = ((nRes?.dyMm || 0) / 1000) * deformScale;

      const ux = node.x - centerX;
      const uy = node.y - centerY;

      nodePosUndef.set(node.id, new THREE.Vector3(ux, uy, halfWidthZ));
      nodePosFront.set(
        node.id,
        new THREE.Vector3(ux + dxM, uy + dyM, halfWidthZ)
      );
      nodePosBack.set(
        node.id,
        new THREE.Vector3(ux + dxM, uy + dyM, -halfWidthZ)
      );
    }

    // 3. Optional Undeformed Ghost Reference Wireframe
    if (showUndeformedGhost && deformScale > 0) {
      const ghostMat = new THREE.LineBasicMaterial({
        color: isDark ? 0x64748b : 0x94a3b8,
        transparent: true,
        opacity: 0.45,
      });
      for (const beam of beams) {
        const p1 = nodePosUndef.get(beam.startNodeId);
        const p2 = nodePosUndef.get(beam.endNodeId);
        if (!p1 || !p2) continue;
        const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        bridgeRoot.add(new THREE.Line(lineGeo, ghostMat));
      }
    }

    // 4. Construct 3D Beams on Front and Rear Truss Planes
    const crossStrutMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x475569 : 0x64748b,
      roughness: 0.4,
      metalness: 0.8,
    });

    for (const beam of beams) {
      const bRes = analysis.beams[beam.id];
      if (!bRes) continue;

      const p1F = nodePosFront.get(beam.startNodeId);
      const p2F = nodePosFront.get(beam.endNodeId);
      const p1B = nodePosBack.get(beam.startNodeId);
      const p2B = nodePosBack.get(beam.endNodeId);
      if (!p1F || !p2F || !p1B || !p2B) continue;

      const isSelected = selectedBeamId === beam.id;
      const isOverstressed = bRes.utilizationRatio >= 1.0;
      const displayColor =
        colorMode === 'stress' ? bRes.stressColorHex : bRes.material.colorHex;

      bridgeRoot.add(
        createCompositeBeamGroup(
          p1F,
          p2F,
          beam.profile || 'i_beam',
          beam.crossSectionAreaCm2,
          displayColor,
          bRes.material.roughness,
          bRes.material.metalness,
          isSelected,
          isOverstressed,
          beam.id
        )
      );

      bridgeRoot.add(
        createCompositeBeamGroup(
          p1B,
          p2B,
          beam.profile || 'i_beam',
          beam.crossSectionAreaCm2,
          displayColor,
          bRes.material.roughness,
          bRes.material.metalness,
          isSelected,
          isOverstressed,
          beam.id
        )
      );
    }

    // 5. Construct Gusset Pin Joints, Transverse Cross-Beams, and Roadway Deck
    const deckNodes: THREE.Vector3[] = [];
    const deckOnTop = presumption3D?.deckPlacement === 'top_chord';

    for (const node of nodes) {
      const pF = nodePosFront.get(node.id)!;
      const pB = nodePosBack.get(node.id)!;
      const isSelected = selectedNodeId === node.id;

      // Transverse cross-girder connecting front and rear truss joints
      const strutLen = halfWidthZ * 2;
      const strutGeo = new THREE.CylinderGeometry(0.075, 0.075, strutLen, 12);
      strutGeo.rotateX(Math.PI * 0.5);
      const strutMesh = new THREE.Mesh(strutGeo, crossStrutMat);
      strutMesh.position.set(pF.x, pF.y, 0);
      bridgeRoot.add(strutMesh);

      if (deckOnTop ? Math.abs(node.y - maxY) < 1.5 : Math.abs(node.y - minY) < 1.25) {
        deckNodes.push(new THREE.Vector3(pF.x, pF.y, 0));
      }

      for (const pos of [pF, pB]) {
        const jointGroup = new THREE.Group();
        jointGroup.position.copy(pos);

        const gussetMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0x38bdf8 : isDark ? 0x334155 : 0x475569,
          roughness: 0.3,
          metalness: 0.85,
          emissive: isSelected
            ? new THREE.Color('#0284C7')
            : new THREE.Color(0x000000),
          emissiveIntensity: isSelected ? 0.5 : 0,
        });

        const pinMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0xfef08a : 0xe2e8f0,
          roughness: 0.2,
          metalness: 0.92,
        });

        const hubGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.28, 20);
        hubGeo.rotateX(Math.PI * 0.5);
        jointGroup.add(new THREE.Mesh(hubGeo, gussetMat));

        const boltGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.36, 16);
        boltGeo.rotateX(Math.PI * 0.5);
        jointGroup.add(new THREE.Mesh(boltGeo, pinMat));

        if (isSelected) {
          const ringGeo = new THREE.TorusGeometry(0.38, 0.035, 12, 28);
          const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
          jointGroup.add(new THREE.Mesh(ringGeo, ringMat));
        }

        // Layer-1 collision sphere for clicking joints
        const hitGeo = new THREE.SphereGeometry(0.44, 12, 12);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitMesh = new THREE.Mesh(hitGeo, hitMat);
        hitMesh.layers.set(1);
        hitMesh.userData = { kind: 'node', id: node.id };
        jointGroup.add(hitMesh);

        bridgeRoot.add(jointGroup);

        // Pin and Roller support pedestals
        if (node.support === 'pin') {
          const supMat = new THREE.MeshStandardMaterial({
            color: 0x0ea5e9,
            roughness: 0.35,
            metalness: 0.6,
          });
          const cone = new THREE.Mesh(
            new THREE.ConeGeometry(0.34, 0.42, 4),
            supMat
          );
          cone.rotation.y = Math.PI * 0.25;
          cone.position.set(pos.x, pos.y - 0.3, pos.z);
          bridgeRoot.add(cone);
        } else if (node.support === 'roller_y') {
          const supMat = new THREE.MeshStandardMaterial({
            color: 0x10b981,
            roughness: 0.35,
            metalness: 0.6,
          });
          const cone = new THREE.Mesh(
            new THREE.ConeGeometry(0.3, 0.32, 4),
            supMat
          );
          cone.rotation.y = Math.PI * 0.25;
          cone.position.set(pos.x, pos.y - 0.25, pos.z);
          bridgeRoot.add(cone);

          const r1 = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 12, 12),
            supMat
          );
          r1.position.set(pos.x - 0.12, pos.y - 0.45, pos.z);
          const r2 = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 12, 12),
            supMat
          );
          r2.position.set(pos.x + 0.12, pos.y - 0.45, pos.z);
          bridgeRoot.add(r1, r2);
        }
      }
    }

    // Semi-transparent roadway deck along chord joints
    if (deckNodes.length >= 2) {
      deckNodes.sort((a, b) => a.x - b.x);
      const deckMat = new THREE.MeshStandardMaterial({
        color: isDark ? 0x1e293b : 0x94a3b8,
        roughness: 0.65,
        metalness: 0.2,
        transparent: true,
        opacity: 0.55,
      });
      for (let i = 0; i < deckNodes.length - 1; i++) {
        const d1 = deckNodes[i];
        const d2 = deckNodes[i + 1];
        const segLen = d1.distanceTo(d2);
        if (segLen < 0.1) continue;
        const deckGeo = new THREE.BoxGeometry(segLen, 0.08, halfWidthZ * 1.82);
        const deckMesh = new THREE.Mesh(deckGeo, deckMat);
        deckMesh.position.addVectors(d1, d2).multiplyScalar(0.5);
        deckMesh.position.y -= 0.12;
        deckMesh.rotation.z = Math.atan2(d2.y - d1.y, d2.x - d1.x);
        bridgeRoot.add(deckMesh);
      }
    }

    // 6. Render 3D External Load Arrows (Amber) & Support Reaction Arrows (Cyan)
    for (const load of loads) {
      const targetPos = nodePosFront.get(load.nodeId);
      if (!targetPos || load.magnitudeKN <= 0) continue;
      const arrowLen = Math.max(
        1.3,
        Math.min(3.2, 0.9 + load.magnitudeKN / 70)
      );
      const arrowGroup = createForceArrowGroup(
        targetPos,
        load.angleDeg,
        arrowLen,
        '#F59E0B',
        true,
        load.id
      );
      bridgeRoot.add(arrowGroup);
    }

    for (const node of nodes) {
      const nRes = analysis.nodes[node.id];
      const targetPos = nodePosFront.get(node.id);
      if (!nRes || !targetPos || nRes.reactionMagnitudeKN < 0.5) continue;
      const arrowLen = Math.max(
        1.2,
        Math.min(2.6, 0.8 + nRes.reactionMagnitudeKN / 85)
      );
      const reactionArrow = createForceArrowGroup(
        targetPos,
        nRes.reactionAngleDeg,
        arrowLen,
        '#06B6D4',
        true
      );
      bridgeRoot.add(reactionArrow);
    }

    requestRender();
  }, [
    nodes,
    beams,
    loads,
    analysis,
    presumption3D,
    selectedNodeId,
    selectedBeamId,
    deformScale,
    showUndeformedGhost,
    colorMode,
    scenicBackdrop,
    isDark,
  ]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Dedicated WebGL Mount Container */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {/* Floating 3D Hover Telemetry Tooltip */}
      {hoverTooltip && (
        <div
          className="pointer-events-none absolute z-20 px-3.5 py-2.5 rounded-lg border shadow-lg text-xs transition-opacity duration-75 bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 max-w-xs"
          style={{
            left: Math.min(
              hoverTooltip.x + 16,
              (canvasMountRef.current?.clientWidth || 800) - 270
            ),
            top: Math.max(12, hoverTooltip.y - 16),
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="font-display font-semibold text-sm tracking-tight">
              {hoverTooltip.title}
            </span>
            <span
              className="px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase rounded"
              style={{
                backgroundColor: `${hoverTooltip.statusColor}22`,
                color: hoverTooltip.statusColor,
              }}
            >
              {hoverTooltip.kind === 'node'
                ? 'JOINT'
                : hoverTooltip.kind === 'load'
                ? 'FORCE'
                : 'BEAM'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
            {hoverTooltip.subtitle}
          </p>
          <div className="font-mono text-[11px] space-y-0.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <div>{hoverTooltip.metric1}</div>
            <div
              className="font-semibold"
              style={{ color: hoverTooltip.statusColor }}
            >
              {hoverTooltip.metric2}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
