---
'@modulato/gpu': minor
'@modulato/vite': minor
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

MODULATO.md §11 documents it, along with a migration guide for existing WebGL
canvases. The guide is written for an agent: inventory first, port one canvas
at a time, keep shader text byte-identical, and verify pixel parity against a
baseline. Nothing else changes unless it was asked for.

create-modulato takes a patch so scaffolds carry the updated reference.
