import * as THREE from 'three';
import { gsap } from 'gsap';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { startAudio, keyDown, keyUp } from './piano.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KEY_MAP = {
  'z': { col: 0, row: 0 }, 'x': { col: 1, row: 0 }, 'c': { col: 2, row: 0 }, 'v': { col: 3, row: 0 },
  'a': { col: 0, row: 1 }, 's': { col: 1, row: 1 }, 'd': { col: 2, row: 1 }, 'f': { col: 3, row: 1 },
  'q': { col: 0, row: 2 }, 'w': { col: 1, row: 2 }, 'e': { col: 2, row: 2 }, 'r': { col: 3, row: 2 },
  '1': { col: 0, row: 3 }, '2': { col: 1, row: 3 }, '3': { col: 2, row: 3 }, '4': { col: 3, row: 3 },
};

// Dm pentatonic ascending front→back (index = col + row * COLS)
const NOTES_GRID = [
  'D1', 'F1', 'G1', 'A1',
  'C2', 'D2', 'F2', 'G2',
  'A2', 'C3', 'D3', 'F3',
  'G3', 'A3', 'C4', 'D4',
];

const ARROW_DELTA = {
  ArrowLeft:  { dc: -1, dr:  0 },
  ArrowRight: { dc:  1, dr:  0 },
  ArrowUp:    { dc:  0, dr:  1 },
  ArrowDown:  { dc:  0, dr: -1 },
};

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Vertex-shader chunks injected into MeshPhysicalMaterial via onBeforeCompile.
const WAVE_COMMON = `#include <common>
uniform float uTime;
uniform float uWaveAmp;
uniform float uWaveFreq;
uniform float uWaveSpeed;

float waveDisplace(vec3 p) {
  return sin(p.x * uWaveFreq + uTime * uWaveSpeed) *
         cos(p.y * uWaveFreq + uTime * uWaveSpeed * 0.8) *
         sin(p.z * uWaveFreq + uTime * uWaveSpeed * 1.2) * uWaveAmp;
}

vec3 displaced(vec3 p, vec3 n) {
  return p + n * waveDisplace(p);
}
`;

const WAVE_BEGINNORMAL = `vec3 objectNormal = vec3(normal);
float eps = 0.05;
vec3 t = abs(normal.y) < 0.999 ? normalize(cross(normal, vec3(0.0, 1.0, 0.0))) : normalize(cross(normal, vec3(1.0, 0.0, 0.0)));
vec3 b = cross(normal, t);
vec3 p0 = displaced(position, normal);
vec3 p1 = displaced(position + t * eps, normal);
vec3 p2 = displaced(position + b * eps, normal);
objectNormal = normalize(cross(p1 - p0, p2 - p0));
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif
`;

const WAVE_BEGIN_VERTEX = `vec3 transformed = displaced(position, normal);`;

const mod = (a, n) => ((a % n) + n) % n;

// ---------------------------------------------------------------------------
// Top-level helpers
// ---------------------------------------------------------------------------

function createGlassMaterial(cfg, waveUniforms) {
  const material = new THREE.MeshPhysicalMaterial({
    color: cfg.color,
    transmission: cfg.transmission,
    thickness: cfg.thickness,
    roughness: cfg.roughness,
    metalness: cfg.metalness,
    ior: cfg.ior,
    reflectivity: cfg.reflectivity,
    envMapIntensity: cfg.envMapIntensity,
    clearcoat: cfg.clearcoat,
    clearcoatRoughness: cfg.clearcoatRoughness,
    iridescence: cfg.iridescence,
    iridescenceIOR: cfg.iridescenceIOR,
    sheen: cfg.sheen,
    sheenRoughness: cfg.sheenRoughness,
    sheenColor: cfg.sheenColor,
    attenuationDistance: cfg.attenuationDistance,
    attenuationColor: cfg.attenuationColor,
    specularIntensity: cfg.specularIntensity,
    specularColor: cfg.specularColor,
    emissive: cfg.emissive,
    emissiveIntensity: cfg.emissiveIntensity,
    transparent: true,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, waveUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', WAVE_COMMON)
      .replace('#include <beginnormal_vertex>', WAVE_BEGINNORMAL)
      .replace('#include <begin_vertex>', WAVE_BEGIN_VERTEX);
  };

  return material;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function initThreeScene(shaderCanvas, sphereConfig, glassConfig, gridConfig) {
  const COLS = gridConfig.divisions;
  const ROWS = gridConfig.divisions;

  // ---- Renderer / scene / camera ----
  const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('three-canvas'),
    antialias: true,
    alpha: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new THREE.Scene();
  const bgTexture = new THREE.CanvasTexture(shaderCanvas);
  bgTexture.colorSpace = THREE.SRGBColorSpace;
  scene.background = bgTexture;

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, sphereConfig.cameraY, sphereConfig.cameraZ);
  camera.lookAt(0, 0, 0);

  // ---- Lights ----
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
  fillLight.position.set(-3, -2, 2);
  scene.add(fillLight);

  // ---- Glass blob ----
  const waveUniforms = {
    uTime:      { value: 0 },
    uWaveAmp:   { value: glassConfig.waveAmp },
    uWaveFreq:  { value: glassConfig.waveFreq },
    uWaveSpeed: { value: glassConfig.waveSpeed },
  };
  const material = createGlassMaterial(glassConfig, waveUniforms);

  function makeGeometry() {
    return new THREE.SphereGeometry(
      sphereConfig.radius,
      sphereConfig.widthSegments,
      sphereConfig.heightSegments,
    );
  }

  const sphere = new THREE.Mesh(makeGeometry(), material);
  scene.add(sphere);

  let lastR  = sphereConfig.radius;
  let lastWS = sphereConfig.widthSegments;
  let lastHS = sphereConfig.heightSegments;

  // ---- Floor grid ----
  let gridMaterials = [];

  function makeGrid() {
    const group = new THREE.Group();
    const half = gridConfig.size / 2;
    const step = gridConfig.size / gridConfig.divisions;
    const res = new THREE.Vector2(window.innerWidth, window.innerHeight);
    const centerSegs = [];
    const regularSegs = [];

    for (let i = 0; i <= gridConfig.divisions; i++) {
      const t = -half + i * step;
      const isCenter = Math.abs(t) < 1e-6;
      (isCenter ? centerSegs : regularSegs).push(-half, 0, t,  half, 0, t);
      (isCenter ? centerSegs : regularSegs).push(t, 0, -half,  t, 0,  half);
    }

    gridMaterials = [];
    function addLines(positions, color, linewidth) {
      const geo = new LineSegmentsGeometry();
      geo.setPositions(positions);
      const mat = new LineMaterial({ color, linewidth, resolution: res });
      gridMaterials.push(mat);
      group.add(new LineSegments2(geo, mat));
    }
    if (regularSegs.length) addLines(regularSegs, gridConfig.color2, gridConfig.lineWidth);
    if (centerSegs.length)  addLines(centerSegs,  gridConfig.color1, gridConfig.lineWidth * 1.5);

    group.position.y = gridConfig.y;
    group.visible = gridConfig.visible;
    return group;
  }

  let grid = makeGrid();
  scene.add(grid);
  let lastGS  = gridConfig.size;
  let lastGC1 = gridConfig.color1;
  let lastGC2 = gridConfig.color2;
  let lastLW  = gridConfig.lineWidth;

  // ---- Cell ↔ world coordinates ----
  const cellToX = (c) => (c + 0.5) * (gridConfig.size / gridConfig.divisions) - gridConfig.size / 2;
  const cellToZ = (r) => gridConfig.size / 2 - (r + 0.5) * (gridConfig.size / gridConfig.divisions);

  // ---- Mutable state ----
  const startTime = performance.now();
  const mouse = { x: 0, y: 0 };
  const bounce = { y: 0 };
  const scaleBoost = { v: 0 };
  const activeNotes = {};
  let keyTarget = null;
  let currentCell = null;
  let isWrapping = false;
  let heldNoteCount = 0;
  let lastSpaceTime = 0;
  let audioReady = false;

  // ---- Audio gate ----
  async function ensureAudio() {
    if (audioReady) return;
    audioReady = true;
    await startAudio();
  }

  // ---- Note management ----
  function startNote(noteKey, note) {
    if (activeNotes[noteKey]) stopNote(noteKey);
    activeNotes[noteKey] = note;
    keyDown(note, { velocity: 0.7 });
    heldNoteCount++;
    if (heldNoteCount === 1) {
      gsap.killTweensOf(scaleBoost);
      gsap.to(scaleBoost, { v: -0.5, duration: 0.005, ease: 'power1.out' });
    }
  }

  function stopNote(noteKey) {
    if (!activeNotes[noteKey]) return;
    keyUp(activeNotes[noteKey]);
    delete activeNotes[noteKey];
    heldNoteCount = Math.max(0, heldNoteCount - 1);
    if (heldNoteCount === 0) {
      gsap.killTweensOf(scaleBoost);
      gsap.to(scaleBoost, { v: 0, duration: 1.0, ease: 'power1.out' });
    }
  }

  function pluck(note, durationMs = 400) {
    keyDown(note, { velocity: 0.7 });
    setTimeout(() => keyUp(note), durationMs);
  }

  // ---- Movement ----
  function spinOnMove() {
    const obj = { v: 0 };
    let last = 0;
    gsap.to(obj, {
      v: Math.PI * 2,
      duration: 0.7,
      ease: 'power2.out',
      onUpdate() {
        const d = obj.v - last;
        last = obj.v;
        sphere.rotateOnWorldAxis(Y_AXIS, d);
      },
    });
  }

  function goToCell(col, row) {
    col = Math.max(0, Math.min(COLS - 1, col));
    row = Math.max(0, Math.min(ROWS - 1, row));
    if (currentCell?.col === col && currentCell?.row === row) return null;
    currentCell = { col, row };
    keyTarget = { x: cellToX(col), z: cellToZ(row) };
    spinOnMove();
    return NOTES_GRID[col + row * COLS];
  }

  // ---- Animation primitives ----
  function bounceBall(height) {
    gsap.killTweensOf(bounce);
    gsap.timeline()
      .to(bounce, { y: height, duration: 0.2 + height * 0.02, ease: 'power2.out' })
      .to(bounce, { y: 0,      duration: 0.5 + height * 0.04, ease: 'bounce.out' });
  }

  function wrapTeleport({ rawCol, rawRow, nextCol, nextRow, dc, dr }) {
    const exitX  = cellToX(rawCol);
    const exitZ  = cellToZ(rawRow);
    const entryX = cellToX(nextCol - dc);
    const entryZ = cellToZ(nextRow - dr);
    const destX  = cellToX(nextCol);
    const destZ  = cellToZ(nextRow);

    spinOnMove();
    currentCell = { col: nextCol, row: nextRow };
    isWrapping = true;

    gsap.killTweensOf(material, 'opacity');
    gsap.killTweensOf(sphere.position);

    gsap.timeline({
      onComplete: () => {
        isWrapping = false;
        keyTarget = { x: destX, z: destZ };
      },
    })
      .to(sphere.position, { x: exitX, z: exitZ, duration: 1, ease: 'power1.in' }, 0)
      .to(material,        { opacity: 0,         duration: 1, ease: 'power1.in' }, 0)
      .add(() => {
        sphere.position.x = entryX;
        sphere.position.z = entryZ;
      })
      .to(sphere.position, { x: destX, z: destZ, duration: 1, ease: 'power2.out' })
      .to(material,        { opacity: 1,         duration: 1, ease: 'power2.out' }, '<');
  }

  // ---- Per-frame syncs ----
  function syncMaterial() {
    material.color.set(glassConfig.color);
    material.transmission = glassConfig.transmission;
    material.thickness = glassConfig.thickness;
    material.roughness = glassConfig.roughness;
    material.metalness = glassConfig.metalness;
    material.ior = glassConfig.ior;
    material.reflectivity = glassConfig.reflectivity;
    material.envMapIntensity = glassConfig.envMapIntensity;
    material.clearcoat = glassConfig.clearcoat;
    material.clearcoatRoughness = glassConfig.clearcoatRoughness;
    material.iridescence = glassConfig.iridescence;
    material.iridescenceIOR = glassConfig.iridescenceIOR;
    material.sheen = glassConfig.sheen;
    material.sheenRoughness = glassConfig.sheenRoughness;
    material.sheenColor.set(glassConfig.sheenColor);
    material.attenuationDistance = glassConfig.attenuationDistance;
    material.attenuationColor.set(glassConfig.attenuationColor);
    material.specularIntensity = glassConfig.specularIntensity;
    material.specularColor.set(glassConfig.specularColor);
    const hue = ((performance.now() - startTime) / 1000 * 12) % 360;
    material.emissive.setStyle(`hsl(${hue.toFixed(1)}, 97%, 68%)`);
    material.emissiveIntensity = glassConfig.emissiveIntensity;
    material.wireframe = sphereConfig.wireframe;
    waveUniforms.uWaveAmp.value   = glassConfig.waveAmp;
    waveUniforms.uWaveFreq.value  = glassConfig.waveFreq;
    waveUniforms.uWaveSpeed.value = glassConfig.waveSpeed;
  }

  function syncSphere() {
    if (
      sphereConfig.radius !== lastR ||
      sphereConfig.widthSegments !== lastWS ||
      sphereConfig.heightSegments !== lastHS
    ) {
      sphere.geometry.dispose();
      sphere.geometry = makeGeometry();
      lastR  = sphereConfig.radius;
      lastWS = sphereConfig.widthSegments;
      lastHS = sphereConfig.heightSegments;
    }
    sphere.scale.setScalar(sphereConfig.scale * (1 + scaleBoost.v));
    sphere.visible = sphereConfig.visible;
    camera.position.set(0, sphereConfig.cameraY, sphereConfig.cameraZ);
    camera.lookAt(0, 0, 0);
  }

  function syncGrid() {
    if (
      gridConfig.size      !== lastGS  ||
      gridConfig.color1    !== lastGC1 ||
      gridConfig.color2    !== lastGC2 ||
      gridConfig.lineWidth !== lastLW
    ) {
      scene.remove(grid);
      grid.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      grid = makeGrid();
      scene.add(grid);
      lastGS  = gridConfig.size;
      lastGC1 = gridConfig.color1;
      lastGC2 = gridConfig.color2;
      lastLW  = gridConfig.lineWidth;
    }
    grid.position.y = gridConfig.y;
    grid.visible = gridConfig.visible;
  }

  // ---- Input handlers ----
  async function handleSpace(e) {
    e.preventDefault();
    const now = Date.now();
    const doubleTap = (now - lastSpaceTime) < 350;
    lastSpaceTime = now;
    const height = doubleTap ? sphereConfig.bounceHeight * 2 : sphereConfig.bounceHeight;
    await ensureAudio();
    if (currentCell) pluck(NOTES_GRID[currentCell.col + currentCell.row * COLS]);
    bounceBall(height);
  }

  async function handleArrow(e) {
    e.preventDefault();
    if (activeNotes['_arrowTimer']) return;
    await ensureAudio();
    const { dc, dr } = ARROW_DELTA[e.key];

    function step() {
      const from = currentCell ?? { col: 1, row: 1 };
      const rawCol = from.col + dc;
      const rawRow = from.row + dr;
      const nextCol = mod(rawCol, COLS);
      const nextRow = mod(rawRow, ROWS);
      if (nextCol === from.col && nextRow === from.row) return;
      const wrapped = nextCol !== rawCol || nextRow !== rawRow;
      if (wrapped) {
        stopNote('_arrow');
        startNote('_arrow', NOTES_GRID[nextCol + nextRow * COLS]);
        wrapTeleport({ rawCol, rawRow, nextCol, nextRow, dc, dr });
        return;
      }
      stopNote('_arrow');
      const note = goToCell(nextCol, nextRow);
      if (note) startNote('_arrow', note);
    }

    activeNotes['_arrowTimer'] = setInterval(step, 250);
    step();
  }

  async function handleNoteKey(e) {
    const key = e.key.toLowerCase();
    const cell = KEY_MAP[key];
    if (!cell || activeNotes[key]) return;
    await ensureAudio();
    const alreadyHere = currentCell?.col === cell.col && currentCell?.row === cell.row;
    const note = goToCell(cell.col, cell.row) ?? NOTES_GRID[cell.col + cell.row * COLS];
    startNote(key, note);
    if (alreadyHere) bounceBall(sphereConfig.bounceHeight);
  }

  function handleKeydown(e) {
    if (e.code === 'Space') return handleSpace(e);
    if (ARROW_DELTA[e.key]) return handleArrow(e);
    handleNoteKey(e);
  }

  function handleKeyup(e) {
    if (ARROW_DELTA[e.key]) {
      clearInterval(activeNotes['_arrowTimer']);
      delete activeNotes['_arrowTimer'];
      stopNote('_arrow');
      return;
    }
    const key = e.key.toLowerCase();
    if (!KEY_MAP[key]) return;
    stopNote(key);
  }

  const raycaster = new THREE.Raycaster();
  async function handleMousedown(e) {
    const nx =  (e.clientX / window.innerWidth)  * 2 - 1;
    const ny = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const ray = raycaster.ray;
    if (Math.abs(ray.direction.y) < 1e-6) return;
    const t = (gridConfig.y - ray.origin.y) / ray.direction.y;
    if (t <= 0) return;
    const wx = ray.origin.x + t * ray.direction.x;
    const wz = ray.origin.z + t * ray.direction.z;
    const cellW = gridConfig.size / gridConfig.divisions;
    const col = Math.floor((wx + gridConfig.size / 2) / cellW);
    const row = Math.floor((gridConfig.size / 2 - wz) / cellW);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    await ensureAudio();
    const note = goToCell(col, row);
    if (note) startNote('_mouse', note);
  }

  function handleMousemove(e) {
    mouse.x = (e.clientX / window.innerWidth)  * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }

  function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    gridMaterials.forEach((m) => m.resolution.set(window.innerWidth, window.innerHeight));
  }

  // ---- Listeners ----
  window.addEventListener('mousemove', handleMousemove);
  window.addEventListener('mousedown', handleMousedown);
  window.addEventListener('mouseup',   () => stopNote('_mouse'));
  window.addEventListener('keydown',   handleKeydown);
  window.addEventListener('keyup',     handleKeyup);
  window.addEventListener('resize',    handleResize);
  window.addEventListener('click',     ensureAudio, { once: true });

  // ---- Render loop ----
  renderer.setAnimationLoop(() => {
    bgTexture.needsUpdate = true;
    waveUniforms.uTime.value = (performance.now() - startTime) / 1000;
    syncMaterial();
    syncSphere();
    syncGrid();

    const oldX = sphere.position.x;
    const oldZ = sphere.position.z;
    if (!isWrapping) {
      const targetX = keyTarget !== null ? keyTarget.x : -mouse.x * sphereConfig.rollRangeX;
      const targetZ = keyTarget !== null ? keyTarget.z : -mouse.y * sphereConfig.rollRangeZ;
      sphere.position.x += (targetX - oldX) * sphereConfig.ease;
      sphere.position.z += (targetZ - oldZ) * sphereConfig.ease;
    }

    const effectiveRadius = sphereConfig.radius * sphereConfig.scale;
    sphere.position.y = gridConfig.y + effectiveRadius + bounce.y;

    if (!isWrapping && effectiveRadius > 0) {
      const dx = sphere.position.x - oldX;
      const dz = sphere.position.z - oldZ;
      sphere.rotateOnWorldAxis(Z_AXIS, -dx / effectiveRadius);
      sphere.rotateOnWorldAxis(X_AXIS,  dz / effectiveRadius);
    }

    sphere.rotateOnWorldAxis(X_AXIS, sphereConfig.autoRotX);
    sphere.rotateOnWorldAxis(Y_AXIS, sphereConfig.autoRotY);
    sphere.rotateOnWorldAxis(Z_AXIS, sphereConfig.autoRotZ);

    renderer.render(scene, camera);
  });
}
