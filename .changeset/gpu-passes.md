---
'@modulato/gpu': minor
'@modulato/vite': minor
'modulato': minor
'create-modulato': patch
---

GPU passes: `@modulato/gpu`, and shader-file imports in `@modulato/vite`

A new, optional package for fragment-shader work. One API runs WGSL on
WebGPU and GLSL on WebGL2. A pass given both languages runs whichever the
browser has, so the fallback is a second file rather than a second code path.

```tsx
const pass = useGpu(canvas, (gpu) => gpu.pass({ fragment: { wgsl: wash, glsl: washGl } }))
useTicker((time) => pass.current?.set(resolveTokens(tokens).wash).set('time', time / 1000).draw())
```

- `useGpu` / `createGpu` give a surface whose resources are disposed with the
  component. All WebGPU surfaces on a page share one device.
- Uniforms are set by name and read off the shader. A WGSL struct is laid out
  by WGSL's own alignment rules. `size`, `u_size` and `size_` all answer to
  `set('size')`. A hex string fills a vec3/vec4, and a whole `motion.ts` token
  group goes in at once, so Tweak edits a shader like it edits a tween.
- Textures from images, canvases, video or raw bytes, with optional mipmaps.
  Render targets chain passes. `uv` and textures are bottom-up in both
  languages, so existing WebGL shaders need no change.
- `@modulato/vite` compiles `.wgsl`, `.glsl`, `.frag` and `.vert` imports. In
  dev an edit recompiles inside the live pass, with no remount. A compile
  error keeps the last good program drawing and prints `file:line:col`. A
  build strips comments. `?raw` imports and files another plugin already
  compiled are left alone, and `modulato({ shaders: false })` opts out.
- Dev only: `window.__MODULATO_GPU__` lists live surfaces with their errors
  and uniforms, and `capture()` returns a frame as PNG, so an agent can check
  work it cannot see. `?gpu=webgl2` forces the fallback.

**Planes.** Put `<GpuStage/>` in the shell, and `usePlane(ref)` lets the GPU
draw a page element wherever it is each frame. The element stays in the DOM,
server-rendered and accessible, and is hidden only once the GPU has it. The
stage copies:

- the box, read after every rAF callback (Lenis, `useTicker`, GSAP) and after
  layout, so a plane never trails its element;
- the effective opacity;
- `overflow` clipping;
- `object-fit` and `border-radius`;
- page stacking during transitions.

Frames with nothing moving aren't redrawn, and a page without planes costs
nothing.

**`<Shared>` morphs on the GPU.** `flipShared` now fires a `modulato:flip`
window event (`{ clone, pair }`; `modulato` minor). When the shared element
is a live plane, the stage draws the flying clone with the plane's shader,
mipmapped so it stays sharp at every size, and crossfades it to the
destination's image as it lands.

MODULATO.md §11 documents it, along with a migration guide for existing WebGL
canvases. The guide is written for an agent: inventory first, port one canvas
at a time, keep shader text byte-identical, and verify pixel parity against a
baseline. Nothing else changes unless it was asked for.

create-modulato takes a patch so scaffolds carry the updated reference.
