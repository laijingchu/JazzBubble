import './style.css';
import { createShader } from 'shaders/js';
import { Pane } from 'tweakpane';
import { initThreeScene } from './three-scene.js';
import { preloadSamples } from './piano.js';

// --- CONFIGURATION ---
const gradientConfig = {
  colorA: '#bdf9ff',
  colorB: '#e8d8ff',
  colorC: '#1f2b49',
  colorD: '#f8e3db',
  colorSpace: 'oklch',
  speed: 1,
  distortion: 0.5,
  seed: 0,
};

const glassConfig = {
  color: '#ffffff',
  transmission: 1,
  thickness: 0.5,
  roughness: 0.14,
  metalness: 0.42,
  ior: 1.27,
  reflectivity: 0.61,
  envMapIntensity: 2.12,
  clearcoat: 0.55,
  clearcoatRoughness: 0.23,
  iridescence: 0,
  iridescenceIOR: 1.3,
  sheen: 0.59,
  sheenRoughness: 1,
  sheenColor: '#ffffff',
  attenuationDistance: 1000,
  attenuationColor: '#ffffff',
  specularIntensity: 0.33,
  specularColor: '#011824',
  emissive: '#5ba9fc',
  emissiveIntensity: 0.71,
  waveAmp: 0.071,
  waveFreq: 5.2,
  waveSpeed: 0.49,
};

const sphereConfig = {
  radius: 0.84,
  widthSegments: 82,
  heightSegments: 70,
  scale: 1.91,
  rollRangeX: 5,
  rollRangeZ: 3,
  ease: 0.05,
  autoRotX: -0.005,
  autoRotY: -0.025,
  autoRotZ: 0,
  wireframe: false,
  visible: true,
  cameraZ: 19.8,
  cameraY: 5.8,
  bounceHeight: 6.8,
};

const gridConfig = {
  size: 28,
  divisions: 4,
  color1: '#ff6262',
  color2: '#ffffff',
  lineWidth: 1.5,
  y: -3.8,
  visible: true,
};

// Snapshot defaults before localStorage overwrites them
const DEFAULTS = {
  gradient: { ...gradientConfig },
  glass:    { ...glassConfig },
  sphere:   { ...sphereConfig },
  grid:     { ...gridConfig },
};

// --- PERSISTENCE ---
const STORAGE_KEY = 'jazzbubble-settings';

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.gradient) Object.assign(gradientConfig, saved.gradient);
    if (saved.glass) Object.assign(glassConfig, saved.glass);
    if (saved.sphere) Object.assign(sphereConfig, saved.sphere);
    if (saved.grid) {
      const { divisions: _, ...rest } = saved.grid;
      Object.assign(gridConfig, rest);
    }
  } catch (e) {
    console.warn('Failed to load saved settings', e);
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      gradient: gradientConfig,
      glass: glassConfig,
      sphere: sphereConfig,
      grid: gridConfig,
    }));
  } catch (e) {
    console.warn('Failed to save settings', e);
  }
}

loadSettings();

let shaderInstance = null;
const canvas = document.getElementById('shader-canvas');

async function initShader() {
  shaderInstance = await createShader(canvas, {
    components: [
      { type: 'FlowingGradient', id: 'bg_gradient', props: gradientConfig },
    ]
  });
}

function updateGradientShader() {
  if (shaderInstance) shaderInstance.update('bg_gradient', gradientConfig);
}

function setupUI() {
  const pane = new Pane({
    title: 'Mixer Controls',
    expanded: true,
  });

  const tab = pane.addTab({
    pages: [
      { title: 'Gradient' },
      { title: 'Glass' },
      { title: 'Sphere' },
      { title: 'Grid' },
      { title: 'Scene' },
    ],
  });

  // --- GRADIENT TAB ---
  const gradientPage = tab.pages[0];
  const gradientColors = gradientPage.addFolder({ title: 'Colors' });
  gradientColors.addBinding(gradientConfig, 'colorA', { label: 'Color A' }).on('change', updateGradientShader);
  gradientColors.addBinding(gradientConfig, 'colorB', { label: 'Color B' }).on('change', updateGradientShader);
  gradientColors.addBinding(gradientConfig, 'colorC', { label: 'Color C' }).on('change', updateGradientShader);
  gradientColors.addBinding(gradientConfig, 'colorD', { label: 'Color D' }).on('change', updateGradientShader);
  gradientColors.addBinding(gradientConfig, 'colorSpace', {
    options: { oklch: 'oklch', linear: 'linear', oklab: 'oklab', hsl: 'hsl', hsv: 'hsv', lch: 'lch' }
  }).on('change', updateGradientShader);
  const gradientAnim = gradientPage.addFolder({ title: 'Animation' });
  gradientAnim.addBinding(gradientConfig, 'speed', { min: 0, max: 5 }).on('change', updateGradientShader);
  gradientAnim.addBinding(gradientConfig, 'distortion', { min: 0, max: 1, step: 0.01 }).on('change', updateGradientShader);
  gradientAnim.addBinding(gradientConfig, 'seed', { min: 0, max: 100, step: 1 }).on('change', updateGradientShader);
  gradientPage.addButton({ title: 'Reset' }).on('click', () => {
    Object.assign(gradientConfig, DEFAULTS.gradient); updateGradientShader(); pane.refresh(); saveSettings();
  });

  // --- GLASS TAB ---
  const glassPage = tab.pages[1];

  const baseFolder = glassPage.addFolder({ title: 'Base' });
  baseFolder.addBinding(glassConfig, 'color');
  baseFolder.addBinding(glassConfig, 'transmission', { min: 0, max: 1, step: 0.01 });
  baseFolder.addBinding(glassConfig, 'thickness', { min: 0, max: 5, step: 0.01 });
  baseFolder.addBinding(glassConfig, 'roughness', { min: 0, max: 1, step: 0.01 });
  baseFolder.addBinding(glassConfig, 'metalness', { min: 0, max: 1, step: 0.01 });
  baseFolder.addBinding(glassConfig, 'ior', { min: 1, max: 2.33, step: 0.01 });
  baseFolder.addBinding(glassConfig, 'reflectivity', { min: 0, max: 1, step: 0.01 });
  baseFolder.addBinding(glassConfig, 'envMapIntensity', { label: 'envMap', min: 0, max: 3, step: 0.01 });

  const ccFolder = glassPage.addFolder({ title: 'Clearcoat' });
  ccFolder.addBinding(glassConfig, 'clearcoat', { min: 0, max: 1, step: 0.01 });
  ccFolder.addBinding(glassConfig, 'clearcoatRoughness', { label: 'roughness', min: 0, max: 1, step: 0.01 });

  const irFolder = glassPage.addFolder({ title: 'Iridescence' });
  irFolder.addBinding(glassConfig, 'iridescence', { min: 0, max: 1, step: 0.01 });
  irFolder.addBinding(glassConfig, 'iridescenceIOR', { label: 'IOR', min: 1, max: 2.33, step: 0.01 });

  const sheenFolder = glassPage.addFolder({ title: 'Sheen' });
  sheenFolder.addBinding(glassConfig, 'sheen', { min: 0, max: 1, step: 0.01 });
  sheenFolder.addBinding(glassConfig, 'sheenRoughness', { label: 'roughness', min: 0, max: 1, step: 0.01 });
  sheenFolder.addBinding(glassConfig, 'sheenColor', { label: 'color' });

  const attFolder = glassPage.addFolder({ title: 'Attenuation' });
  attFolder.addBinding(glassConfig, 'attenuationDistance', { label: 'distance', min: 0.1, max: 1000, step: 0.1 });
  attFolder.addBinding(glassConfig, 'attenuationColor', { label: 'color' });

  const specFolder = glassPage.addFolder({ title: 'Specular' });
  specFolder.addBinding(glassConfig, 'specularIntensity', { label: 'intensity', min: 0, max: 1, step: 0.01 });
  specFolder.addBinding(glassConfig, 'specularColor', { label: 'color' });

  const emFolder = glassPage.addFolder({ title: 'Emissive' });
  emFolder.addBinding(glassConfig, 'emissive', { label: 'color' });
  emFolder.addBinding(glassConfig, 'emissiveIntensity', { label: 'intensity', min: 0, max: 5, step: 0.01 });

  const waveFolder = glassPage.addFolder({ title: 'Wave Distortion' });
  waveFolder.addBinding(glassConfig, 'waveAmp', { label: 'amplitude', min: 0, max: 0.5, step: 0.001 });
  waveFolder.addBinding(glassConfig, 'waveFreq', { label: 'frequency', min: 0, max: 20, step: 0.1 });
  waveFolder.addBinding(glassConfig, 'waveSpeed', { label: 'speed', min: 0, max: 5, step: 0.01 });
  glassPage.addButton({ title: 'Reset' }).on('click', () => {
    Object.assign(glassConfig, DEFAULTS.glass); pane.refresh(); saveSettings();
  });

  // --- SPHERE TAB ---
  const spherePage = tab.pages[2];

  const sizeFolder = spherePage.addFolder({ title: 'Size' });
  sizeFolder.addBinding(sphereConfig, 'radius', { min: 0.1, max: 5, step: 0.01 });
  sizeFolder.addBinding(sphereConfig, 'widthSegments', { label: 'width segs', min: 3, max: 128, step: 1 });
  sizeFolder.addBinding(sphereConfig, 'heightSegments', { label: 'height segs', min: 2, max: 128, step: 1 });
  sizeFolder.addBinding(sphereConfig, 'scale', { min: 0.1, max: 5, step: 0.01 });

  const rollFolder = spherePage.addFolder({ title: 'Mouse Roll' });
  rollFolder.addBinding(sphereConfig, 'rollRangeX', { label: 'Range X', min: 0, max: 10, step: 0.1 });
  rollFolder.addBinding(sphereConfig, 'rollRangeZ', { label: 'Range Z', min: 0, max: 10, step: 0.1 });
  rollFolder.addBinding(sphereConfig, 'ease', { label: 'Ease', min: 0.01, max: 1, step: 0.01 });

  const autoFolder = spherePage.addFolder({ title: 'Auto Rotation' });
  autoFolder.addBinding(sphereConfig, 'autoRotX', { label: 'Speed X', min: -0.05, max: 0.05, step: 0.001 });
  autoFolder.addBinding(sphereConfig, 'autoRotY', { label: 'Speed Y', min: -0.05, max: 0.05, step: 0.001 });
  autoFolder.addBinding(sphereConfig, 'autoRotZ', { label: 'Speed Z', min: -0.05, max: 0.05, step: 0.001 });

  const bounceFolder = spherePage.addFolder({ title: 'Bounce' });
  bounceFolder.addBinding(sphereConfig, 'bounceHeight', { label: 'height', min: 0.5, max: 10, step: 0.1 });
  spherePage.addButton({ title: 'Reset' }).on('click', () => {
    const keys = ['radius','widthSegments','heightSegments','scale','rollRangeX','rollRangeZ','ease','autoRotX','autoRotY','autoRotZ','bounceHeight'];
    keys.forEach(k => { sphereConfig[k] = DEFAULTS.sphere[k]; });
    pane.refresh(); saveSettings();
  });

  // --- GRID TAB ---
  const gridPage = tab.pages[3];
  gridPage.addBinding(gridConfig, 'visible', { label: 'visible' });
  gridPage.addBinding(gridConfig, 'size', { label: 'size', min: 1, max: 100, step: 0.5 });
  gridPage.addBinding(gridConfig, 'y', { label: 'Y', min: -10, max: 5, step: 0.01 });
  gridPage.addBinding(gridConfig, 'lineWidth', { label: 'thickness', min: 0.5, max: 10, step: 0.5 });
  gridPage.addBinding(gridConfig, 'color1', { label: 'center color' });
  gridPage.addBinding(gridConfig, 'color2', { label: 'line color' });
  gridPage.addButton({ title: 'Reset' }).on('click', () => {
    const { divisions: _, ...gridDefaults } = DEFAULTS.grid;
    Object.assign(gridConfig, gridDefaults); pane.refresh(); saveSettings();
  });

  // --- SCENE TAB ---
  const scenePage = tab.pages[4];
  scenePage.addBinding(sphereConfig, 'cameraY', { label: 'Camera Y', min: -5, max: 10, step: 0.1 });
  scenePage.addBinding(sphereConfig, 'cameraZ', { label: 'Camera Z', min: 1, max: 20, step: 0.1 });
  scenePage.addBinding(sphereConfig, 'wireframe');
  scenePage.addBinding(sphereConfig, 'visible');
  scenePage.addButton({ title: 'Reset' }).on('click', () => {
    const keys = ['cameraY', 'cameraZ', 'wireframe', 'visible'];
    keys.forEach(k => { sphereConfig[k] = DEFAULTS.sphere[k]; });
    pane.refresh(); saveSettings();
  });

  pane.addButton({ title: 'Export Code' }).on('click', showExportModal);
  pane.addButton({ title: 'Reset Settings' }).on('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  // Persist any change anywhere in the pane
  pane.on('change', saveSettings);
}

const modal = document.getElementById('code-modal');
const closeBtn = document.getElementById('close-modal');
const copyBtn = document.getElementById('copy-btn');
const codeBlock = document.getElementById('code-block');

function showExportModal() {
  const j = (obj) => JSON.stringify(obj, null, 2);
  const code = `import { createShader } from 'shaders/js';
import { initThreeScene } from './three-scene.js';

const canvas = document.getElementById('shader-canvas');

const gradientConfig = ${j(gradientConfig)};

const glassConfig = ${j(glassConfig)};

const sphereConfig = ${j(sphereConfig)};

const gridConfig = ${j({ ...gridConfig, divisions: 4 })};

const shader = await createShader(canvas, {
  components: [{ type: 'FlowingGradient', props: gradientConfig }]
});

initThreeScene(canvas, sphereConfig, glassConfig, gridConfig);`;

  codeBlock.textContent = code;
  modal.classList.remove('hidden');
}

closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

const controlsTip = document.getElementById('controls-tip');
const dismissTip = document.getElementById('dismiss-tip');
dismissTip.addEventListener('click', () => controlsTip.classList.add('hidden'));

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(codeBlock.textContent).then(() => {
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy to Clipboard'; }, 2000);
  });
});

// Bootstrap — load piano samples and shader in parallel, then reveal scene
const loadingScreen = document.getElementById('loading-screen');

Promise.all([preloadSamples(), initShader()]).then(() => {
  loadingScreen.classList.add('hidden');
  setupUI();
  initThreeScene(canvas, sphereConfig, glassConfig, gridConfig);
});
