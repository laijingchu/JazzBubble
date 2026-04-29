import './style.css';
import { createShader } from 'shaders/js';
import { Pane } from 'tweakpane';

// --- CONFIGURATION ---
const blobConfig = {
  colorA: '#ff6b35',
  colorB: '#e91e63',
  size: 0.5,
  deformation: 0.5,
  softness: 0.5,
  highlightIntensity: 0.5,
  highlightX: 0.3,
  highlightY: -0.3,
  highlightZ: 0.4,
  highlightColor: '#ffe11a',
  speed: 0.5,
  seed: 1,
  colorSpace: 'linear',
  center: { x: 0.5, y: 0.5 },
  opacity: 1,
  blendMode: 'normal'
};

const swirlConfig = {
  colorA: '#ff6b35', 
  colorB: '#e91e63', 
  speed: 1,
  detail: 1,
  blend: 50,
  colorSpace: 'linear'
};

const halftoneConfig = {
  style: 'classic',
  frequency: 100,
  angle: 45,
  cyanAngle: 15,
  magentaAngle: 75,
  yellowAngle: 0,
  blackAngle: 45,
  misprint: 0,
  misprintAngle: 0,
  paperColor: '#ffffff00', // Transparent by default so Swirl shows
  cyanColor: '#00ffff',
  magentaColor: '#ff00ff',
  yellowColor: '#ffff00',
  blackColor: '#000000'
};

let shaderInstance = null;
const canvas = document.getElementById('shader-canvas');

// Initialize the shader
async function initShader() {
  shaderInstance = await createShader(canvas, {
    components: [
      {
        type: 'Swirl',
        id: 'bg_swirl',
        props: swirlConfig
      },
      {
        type: 'Halftone',
        id: 'fg_halftone',
        props: halftoneConfig,
        children: [
          {
            type: 'Blob',
            id: 'main_blob',
            props: blobConfig
          }
        ]
      }
    ]
  });
}

// Update the shader when config changes
function updateBlobShader() {
  if (shaderInstance) shaderInstance.update('main_blob', blobConfig);
}
function updateSwirlShader() {
  if (shaderInstance) shaderInstance.update('bg_swirl', swirlConfig);
}
function updateHalftoneShader() {
  if (shaderInstance) shaderInstance.update('fg_halftone', halftoneConfig);
}

// Set up Tweakpane UI
function setupUI() {
  const pane = new Pane({
    title: 'Mixer Controls',
    expanded: true,
  });

  const tab = pane.addTab({
    pages: [
      {title: 'Blob'},
      {title: 'Swirl'},
      {title: 'Halftone'}
    ],
  });

  // --- BLOB TAB ---
  const blobPage = tab.pages[0];
  
  const colorsFolder = blobPage.addFolder({ title: 'Colors & Blending' });
  colorsFolder.addBinding(blobConfig, 'colorA', { label: 'Color A' }).on('change', updateBlobShader);
  colorsFolder.addBinding(blobConfig, 'colorB', { label: 'Color B' }).on('change', updateBlobShader);
  colorsFolder.addBinding(blobConfig, 'highlightColor', { label: 'Color C (Highlight)' }).on('change', updateBlobShader);
  colorsFolder.addBinding(blobConfig, 'colorSpace', {
    options: {
      linear: 'linear', oklch: 'oklch', oklab: 'oklab', hsl: 'hsl', hsv: 'hsv', lch: 'lch'
    }
  }).on('change', updateBlobShader);
  colorsFolder.addBinding(blobConfig, 'blendMode', {
    options: {
      normal: 'normal', multiply: 'multiply', screen: 'screen', overlay: 'overlay',
      darken: 'darken', lighten: 'lighten', 'color-dodge': 'color-dodge', 'color-burn': 'color-burn',
      'hard-light': 'hard-light', 'soft-light': 'soft-light', difference: 'difference',
      exclusion: 'exclusion', hue: 'hue', saturation: 'saturation', color: 'color', luminosity: 'luminosity'
    }
  }).on('change', updateBlobShader);
  colorsFolder.addBinding(blobConfig, 'opacity', { min: 0, max: 1 }).on('change', updateBlobShader);

  const shapeFolder = blobPage.addFolder({ title: 'Shape & Animation' });
  shapeFolder.addBinding(blobConfig, 'center', { x: { min: 0, max: 1 }, y: { min: 0, max: 1 } }).on('change', updateBlobShader);
  shapeFolder.addBinding(blobConfig, 'size', { min: 0, max: 2 }).on('change', updateBlobShader);
  shapeFolder.addBinding(blobConfig, 'deformation', { min: 0, max: 2 }).on('change', updateBlobShader);
  shapeFolder.addBinding(blobConfig, 'softness', { min: 0, max: 1 }).on('change', updateBlobShader);
  shapeFolder.addBinding(blobConfig, 'speed', { min: 0, max: 2 }).on('change', updateBlobShader);
  shapeFolder.addBinding(blobConfig, 'seed', { step: 1, min: 0, max: 100 }).on('change', updateBlobShader);

  const lightingFolder = blobPage.addFolder({ title: 'Lighting' });
  lightingFolder.addBinding(blobConfig, 'highlightIntensity', { min: 0, max: 2 }).on('change', updateBlobShader);
  lightingFolder.addBinding(blobConfig, 'highlightX', { min: -1, max: 1 }).on('change', updateBlobShader);
  lightingFolder.addBinding(blobConfig, 'highlightY', { min: -1, max: 1 }).on('change', updateBlobShader);
  lightingFolder.addBinding(blobConfig, 'highlightZ', { min: -1, max: 1 }).on('change', updateBlobShader);

  // --- SWIRL TAB ---
  const swirlPage = tab.pages[1];
  const swirlColorsFolder = swirlPage.addFolder({ title: 'Colors & Style' });
  swirlColorsFolder.addBinding(swirlConfig, 'colorA', { label: 'Color A' }).on('change', updateSwirlShader);
  swirlColorsFolder.addBinding(swirlConfig, 'colorB', { label: 'Color B' }).on('change', updateSwirlShader);
  swirlColorsFolder.addBinding(swirlConfig, 'colorSpace', {
    options: {
      linear: 'linear', oklch: 'oklch', oklab: 'oklab', hsl: 'hsl', hsv: 'hsv', lch: 'lch'
    }
  }).on('change', updateSwirlShader);
  
  const swirlAnimFolder = swirlPage.addFolder({ title: 'Pattern & Animation' });
  swirlAnimFolder.addBinding(swirlConfig, 'speed', { min: 0, max: 5 }).on('change', updateSwirlShader);
  swirlAnimFolder.addBinding(swirlConfig, 'detail', { min: 0, max: 5 }).on('change', updateSwirlShader);
  swirlAnimFolder.addBinding(swirlConfig, 'blend', { min: 0, max: 100 }).on('change', updateSwirlShader);

  // --- HALFTONE TAB ---
  const htPage = tab.pages[2];
  htPage.addBinding(halftoneConfig, 'style', {
    options: { classic: 'classic', cmyk: 'cmyk' }
  }).on('change', updateHalftoneShader);
  htPage.addBinding(halftoneConfig, 'frequency', { min: 10, max: 300 }).on('change', updateHalftoneShader);
  htPage.addBinding(halftoneConfig, 'angle', { min: 0, max: 360 }).on('change', updateHalftoneShader);
  htPage.addBinding(halftoneConfig, 'misprint', { min: 0, max: 100 }).on('change', updateHalftoneShader);
  htPage.addBinding(halftoneConfig, 'misprintAngle', { min: 0, max: 360 }).on('change', updateHalftoneShader);

  const htColorsFolder = htPage.addFolder({ title: 'Colors' });
  // Pass color bindings in case they want to adjust paper/cmyk colors
  htColorsFolder.addBinding(halftoneConfig, 'paperColor').on('change', updateHalftoneShader);
  htColorsFolder.addBinding(halftoneConfig, 'cyanColor').on('change', updateHalftoneShader);
  htColorsFolder.addBinding(halftoneConfig, 'magentaColor').on('change', updateHalftoneShader);
  htColorsFolder.addBinding(halftoneConfig, 'yellowColor').on('change', updateHalftoneShader);
  htColorsFolder.addBinding(halftoneConfig, 'blackColor').on('change', updateHalftoneShader);

  // Export Code Action
  const exportBtn = pane.addButton({
    title: 'Export Code',
  });

  exportBtn.on('click', () => {
    showExportModal();
  });
}

// Handle Export Modal
const modal = document.getElementById('code-modal');
const closeBtn = document.getElementById('close-modal');
const copyBtn = document.getElementById('copy-btn');
const codeBlock = document.getElementById('code-block');

function showExportModal() {
  const code = `import { createShader } from 'shaders/js';

const canvas = document.getElementById('shader-canvas');

const shader = await createShader(canvas, {
  components: [
    {
      type: 'Swirl',
      props: ${JSON.stringify(swirlConfig, null, 6).trim()}
    },
    {
      type: 'Halftone',
      props: ${JSON.stringify(halftoneConfig, null, 6).trim()},
      children: [
        {
          type: 'Blob',
          props: ${JSON.stringify(blobConfig, null, 10).trim()}
        }
      ]
    }
  ]
});`;

  codeBlock.textContent = code;
  modal.classList.remove('hidden');
}

closeBtn.addEventListener('click', () => {
  modal.classList.add('hidden');
});

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(codeBlock.textContent).then(() => {
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = 'Copy to Clipboard';
    }, 2000);
  });
});

// Bootstrap
initShader().then(() => {
  setupUI();
});
