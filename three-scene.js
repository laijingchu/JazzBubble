import * as THREE from 'three';
import { gsap } from 'gsap';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { startAudio, keyDown, keyUp } from './piano.js';

// Key → grid cell (col 0-3 left→right, row 0 = front/near camera, row 3 = back)
const KEY_MAP = {
  'z': { col: 0, row: 0 }, 'x': { col: 1, row: 0 }, 'c': { col: 2, row: 0 }, 'v': { col: 3, row: 0 },
  'a': { col: 0, row: 1 }, 's': { col: 1, row: 1 }, 'd': { col: 2, row: 1 }, 'f': { col: 3, row: 1 },
  'q': { col: 0, row: 2 }, 'w': { col: 1, row: 2 }, 'e': { col: 2, row: 2 }, 'r': { col: 3, row: 2 },
  '1': { col: 0, row: 3 }, '2': { col: 1, row: 3 }, '3': { col: 2, row: 3 }, '4': { col: 3, row: 3 },
};

// Dm pentatonic ascending front→back (index = col + row*4)
const NOTES_GRID = [
  'D1', 'F1', 'G1', 'A1',  // z  x  c  v  (front)
  'C2', 'D2', 'F2', 'G2',  // a  s  d  f
  'A2', 'C3', 'D3', 'F3',  // q  w  e  r
  'G3', 'A3', 'C4', 'D4',  // 1  2  3  4  (back)
];

export function initThreeScene(shaderCanvas, sphereConfig, glassConfig, gridConfig) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, sphereConfig.cameraY, sphereConfig.cameraZ);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('three-canvas'),
    antialias: true,
    alpha: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  const bgTexture = new THREE.CanvasTexture(shaderCanvas);
  bgTexture.colorSpace = THREE.SRGBColorSpace;
  scene.background = bgTexture;

  const material = new THREE.MeshPhysicalMaterial({
    color: glassConfig.color,
    transmission: glassConfig.transmission,
    thickness: glassConfig.thickness,
    roughness: glassConfig.roughness,
    metalness: glassConfig.metalness,
    ior: glassConfig.ior,
    reflectivity: glassConfig.reflectivity,
    envMapIntensity: glassConfig.envMapIntensity,
    clearcoat: glassConfig.clearcoat,
    clearcoatRoughness: glassConfig.clearcoatRoughness,
    iridescence: glassConfig.iridescence,
    iridescenceIOR: glassConfig.iridescenceIOR,
    sheen: glassConfig.sheen,
    sheenRoughness: glassConfig.sheenRoughness,
    sheenColor: glassConfig.sheenColor,
    attenuationDistance: glassConfig.attenuationDistance,
    attenuationColor: glassConfig.attenuationColor,
    specularIntensity: glassConfig.specularIntensity,
    specularColor: glassConfig.specularColor,
    emissive: glassConfig.emissive,
    emissiveIntensity: glassConfig.emissiveIntensity,
    transparent: true,
  });

  const waveUniforms = {
    uTime: { value: 0 },
    uWaveAmp: { value: glassConfig.waveAmp },
    uWaveFreq: { value: glassConfig.waveFreq },
    uWaveSpeed: { value: glassConfig.waveSpeed },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, waveUniforms);

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
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
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      `vec3 objectNormal = vec3(normal);
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
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `vec3 transformed = displaced(position, normal);`
    );
  };

  function makeGeometry() {
    return new THREE.SphereGeometry(
      sphereConfig.radius,
      sphereConfig.widthSegments,
      sphereConfig.heightSegments
    );
  }

  const sphere = new THREE.Mesh(makeGeometry(), material);
  scene.add(sphere);

  let lastR = sphereConfig.radius,
    lastWS = sphereConfig.widthSegments,
    lastHS = sphereConfig.heightSegments;

  // Floor grid
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
      (isCenter ? centerSegs : regularSegs).push(-half, 0, t, half, 0, t);
      (isCenter ? centerSegs : regularSegs).push(t, 0, -half, t, 0, half);
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
    if (centerSegs.length) addLines(centerSegs, gridConfig.color1, gridConfig.lineWidth * 1.5);

    group.position.y = gridConfig.y;
    group.visible = gridConfig.visible;
    return group;
  }

  let grid = makeGrid();
  scene.add(grid);
  let lastGS = gridConfig.size,
    lastGC1 = gridConfig.color1,
    lastGC2 = gridConfig.color2,
    lastLW = gridConfig.lineWidth;

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
  fillLight.position.set(-3, -2, 2);
  scene.add(fillLight);

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
    waveUniforms.uWaveAmp.value = glassConfig.waveAmp;
    waveUniforms.uWaveFreq.value = glassConfig.waveFreq;
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
      lastR = sphereConfig.radius;
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
      gridConfig.size !== lastGS ||
      gridConfig.color1 !== lastGC1 ||
      gridConfig.color2 !== lastGC2 ||
      gridConfig.lineWidth !== lastLW
    ) {
      scene.remove(grid);
      grid.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      grid = makeGrid();
      scene.add(grid);
      lastGS = gridConfig.size;
      lastGC1 = gridConfig.color1;
      lastGC2 = gridConfig.color2;
      lastLW = gridConfig.lineWidth;
    }
    grid.position.y = gridConfig.y;
    grid.visible = gridConfig.visible;
  }

  const mouse = { x: 0, y: 0 };
  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    gridMaterials.forEach(m => m.resolution.set(window.innerWidth, window.innerHeight));
  });

  let audioReady = false;
  async function ensureAudio() {
    if (!audioReady) {
      audioReady = true;
      await startAudio();
    }
  }
  window.addEventListener('click', ensureAudio, { once: true });

  const raycaster = new THREE.Raycaster();

  window.addEventListener('mousedown', async (e) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
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
  });

  window.addEventListener('mouseup', () => { stopNote('_mouse'); });

  let keyTarget = null;
  let currentCell = null;
  const activeNotes = {};

  const scaleBoost = { v: 0 };
  let heldNoteCount = 0;

  function startNote(noteKey, note) {
    if (activeNotes[noteKey]) stopNote(noteKey);
    activeNotes[noteKey] = note;
    keyDown(note, { velocity: 0.7 });
    heldNoteCount++;
    if (heldNoteCount === 1) {
      gsap.killTweensOf(scaleBoost);
      gsap.to(scaleBoost, { v: -0.2, duration: 0.08, ease: 'power1.out' });
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

  const COLS = gridConfig.divisions;
  const ROWS = gridConfig.divisions;

  function goToCell(col, row) {
    col = Math.max(0, Math.min(COLS - 1, col));
    row = Math.max(0, Math.min(ROWS - 1, row));
    if (currentCell?.col === col && currentCell?.row === row) return null;
    currentCell = { col, row };
    const cellW = gridConfig.size / gridConfig.divisions;
    keyTarget = {
      x: (col + 0.5) * cellW - gridConfig.size / 2,
      z: gridConfig.size / 2 - (row + 0.5) * cellW,
    };
    return NOTES_GRID[col + row * 4];
  }

  const bounce = { y: 0 };
  let lastSpaceTime = 0;

  const ARROW_DELTA = {
    ArrowLeft: { dc: -1, dr: 0 },
    ArrowRight: { dc: 1, dr: 0 },
    ArrowUp: { dc: 0, dr: 1 },
    ArrowDown: { dc: 0, dr: -1 },
  };

  window.addEventListener('keydown', async (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      const now = Date.now();
      const doubleTap = (now - lastSpaceTime) < 350;
      lastSpaceTime = now;
      const height = doubleTap ? sphereConfig.bounceHeight * 2 : sphereConfig.bounceHeight;
      await ensureAudio();
      if (currentCell) {
        const note = NOTES_GRID[currentCell.col + currentCell.row * 4];
        keyDown(note, { velocity: 0.7 });
        setTimeout(() => keyUp(note), 400);
      }
      gsap.killTweensOf(bounce);
      gsap.timeline()
        .to(bounce, { y: height, duration: 0.2 + height * 0.02, ease: 'power2.out' })
        .to(bounce, { y: 0, duration: 0.5 + height * 0.04, ease: 'bounce.out' });
      return;
    }

    if (ARROW_DELTA[e.key]) {
      e.preventDefault();
      if (activeNotes['_arrowTimer']) return;
      await ensureAudio();
      const { dc, dr } = ARROW_DELTA[e.key];

      function stepArrow() {
        const from = currentCell ?? { col: 1, row: 1 };
        const nextCol = Math.max(0, Math.min(COLS - 1, from.col + dc));
        const nextRow = Math.max(0, Math.min(ROWS - 1, from.row + dr));
        if (nextCol === from.col && nextRow === from.row) return;
        stopNote('_arrow');
        const note = goToCell(nextCol, nextRow);
        if (note) startNote('_arrow', note);
      }

      activeNotes['_arrowTimer'] = setInterval(stepArrow, 250);
      stepArrow();
      return;
    }

    const key = e.key.toLowerCase();
    const cell = KEY_MAP[key];
    if (!cell || activeNotes[key]) return;
    await ensureAudio();
    const alreadyHere = currentCell?.col === cell.col && currentCell?.row === cell.row;
    const note = goToCell(cell.col, cell.row) ?? NOTES_GRID[cell.col + cell.row * 4];
    startNote(key, note);
    if (alreadyHere) {
      const height = sphereConfig.bounceHeight;
      gsap.killTweensOf(bounce);
      gsap.timeline()
        .to(bounce, { y: height, duration: 0.2 + height * 0.02, ease: 'power2.out' })
        .to(bounce, { y: 0, duration: 0.5 + height * 0.04, ease: 'bounce.out' });
    }
  });

  window.addEventListener('keyup', (e) => {
    if (ARROW_DELTA[e.key]) {
      clearInterval(activeNotes['_arrowTimer']);
      delete activeNotes['_arrowTimer'];
      stopNote('_arrow');
      return;
    }
    const key = e.key.toLowerCase();
    if (!KEY_MAP[key]) return;
    stopNote(key);
  });

  const startTime = performance.now();
  const X_AXIS = new THREE.Vector3(1, 0, 0);
  const Z_AXIS = new THREE.Vector3(0, 0, 1);
  const Y_AXIS = new THREE.Vector3(0, 1, 0);

  renderer.setAnimationLoop(() => {
    bgTexture.needsUpdate = true;
    waveUniforms.uTime.value = (performance.now() - startTime) / 1000;
    syncMaterial();
    syncSphere();
    syncGrid();

    const targetX = keyTarget !== null ? keyTarget.x : -mouse.x * sphereConfig.rollRangeX;
    const targetZ = keyTarget !== null ? keyTarget.z : -mouse.y * sphereConfig.rollRangeZ;
    const oldX = sphere.position.x;
    const oldZ = sphere.position.z;
    sphere.position.x += (targetX - oldX) * sphereConfig.ease;
    sphere.position.z += (targetZ - oldZ) * sphereConfig.ease;
    const dx = sphere.position.x - oldX;
    const dz = sphere.position.z - oldZ;

    // Rest the sphere on the grid: y = gridY + radius * scale
    const effectiveRadius = sphereConfig.radius * sphereConfig.scale;
    sphere.position.y = gridConfig.y + effectiveRadius + bounce.y;

    // Rolling rotation: angular delta = linear delta / radius
    if (effectiveRadius > 0) {
      sphere.rotateOnWorldAxis(Z_AXIS, -dx / effectiveRadius);
      sphere.rotateOnWorldAxis(X_AXIS, dz / effectiveRadius);
    }

    // Auto rotation accumulated on world axes
    sphere.rotateOnWorldAxis(X_AXIS, sphereConfig.autoRotX);
    sphere.rotateOnWorldAxis(Y_AXIS, sphereConfig.autoRotY);
    sphere.rotateOnWorldAxis(Z_AXIS, sphereConfig.autoRotZ);

    renderer.render(scene, camera);
  });
}
