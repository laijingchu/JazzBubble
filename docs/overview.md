# Shaders Blob Mixer — Overview

A small Vite-based vanilla JS web app for interactively mixing GPU shader effects in the browser. Users tweak parameters via a Tweakpane UI and can export the resulting configuration as copy-pasteable code.

## Stack

Declared in [package.json](../package.json):

- **Vite** — dev server and build (`npm run dev` / `npm run build` / `npm run preview`).
- **`shaders`** — provides `createShader()` and the component types (`Swirl`, `Halftone`, `Blob`).
- **`tweakpane`** — control panel UI (tabs, folders, sliders, color pickers).
- **`gsap`** — listed as a dependency but not currently imported.
- ESM modules, no framework.

## File map

| File | Purpose |
| --- | --- |
| [index.html](../index.html) | Mounts a fullscreen `<canvas id="shader-canvas">` plus a hidden `#code-modal` for the export dialog. |
| [main.js](../main.js) | All application logic: configs, shader init, Tweakpane bindings, export modal. |
| [style.css](../style.css) | Fullscreen canvas (`z-index: -1`) and glassmorphism modal styles. |

## Architecture

### Shader composition

[`initShader`](../main.js#L55-L77) builds a layered component tree via `createShader(canvas, { components: [...] })`:

```
Swirl (bg_swirl)         ← background
└── Halftone (fg_halftone)
    └── Blob (main_blob) ← child of Halftone
```

The Halftone effect wraps the Blob, so the halftone pattern is applied on top of the blob shape; the Swirl renders behind everything.

### Configuration objects

Three plain objects at the top of [main.js](../main.js#L6-L49) hold the live state:

- **`blobConfig`** — colors (A/B + highlight), shape (size, deformation, softness, center, seed), animation (speed), lighting (highlight XYZ + intensity), color space, opacity, blend mode.
- **`swirlConfig`** — colors, speed, detail, blend, color space.
- **`halftoneConfig`** — style (classic/cmyk), frequency, angle, per-channel CMYK angles, misprint amount/angle, paper + CMYK colors. Paper defaults to `#ffffff00` (transparent) so the underlying Swirl shows through.

### Live updates

Each Tweakpane binding's `.on('change', ...)` calls one of the three updater functions ([main.js:80-88](../main.js#L80-L88)), which invoke `shaderInstance.update(id, config)` to push fresh uniforms to the GPU without rebuilding the pipeline.

### UI layout

[`setupUI`](../main.js#L91-L183) creates a single Tweakpane with three tabs:

- **Blob** — folders for *Colors & Blending*, *Shape & Animation*, *Lighting*.
- **Swirl** — *Colors & Style*, *Pattern & Animation*.
- **Halftone** — top-level controls plus a *Colors* folder for paper + CMYK.

An **Export Code** button at the bottom opens the modal.

### Export modal

[`showExportModal`](../main.js#L191-L217) serializes the three config objects into a `createShader(...)` snippet and renders it in `#code-block`. The Copy button uses `navigator.clipboard.writeText` and briefly flips its label to "Copied!".

## Bootstrap

[main.js:233-235](../main.js#L233-L235):

```js
initShader().then(() => {
  setupUI();
});
```

The shader is created first (async), then the UI is wired up so bindings can immediately call `shaderInstance.update(...)`.

## Running locally

```bash
npm install
npm run dev
```