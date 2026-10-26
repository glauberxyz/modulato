# @modulato/gpu

GPU passes for Modulato: **WGSL on WebGPU, GLSL on WebGL2, one API.** A
pass given both languages runs whichever the browser has. Shader files
hot-swap in place, uniforms take a `motion.ts` token group as-is (so Tweak
edits a shader the way it edits a tween), and everything is disposed with
the component.

```tsx
import { useRef } from 'react'
import { useTicker } from 'modulato'
import { useGpu } from '@modulato/gpu'
import wash from './wash.wgsl'
import washGl from './wash.frag'

export function Wash() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const pass = useGpu(canvas, (gpu) => gpu.pass({ fragment: { wgsl: wash, glsl: washGl } }))
  useTicker((time) => pass.current?.set('time', time / 1000).draw())
  return <canvas ref={canvas} aria-hidden="true" />
}
```

**Planes.** Put `<GpuStage/>` in the shell, and `usePlane(ref)` lets the
GPU draw a page element, wherever it is each frame. The element stays in the
DOM, so it is still server-rendered, accessible and laid out by CSS, and is
hidden only once the GPU has it. The stage copies the element's position,
opacity, overflow clipping, `object-fit` and `border-radius`. During page
transitions it copies the page stacking too, and it reads all of it after
Lenis and GSAP have moved things that frame, so a plane never lags.
`<Shared>` morphs between planes are drawn on the GPU, mipmapped so they stay
sharp at every size.

**Build-time assets.** `logo.svg?sdf` gives a signed distance field from the
SVG's geometry, and `Font.ttf?text=EXPA&points` an outline sampled into
points, worked out once at build rather than in every browser.

Opt in to shader-import types in `tsconfig.json`:
`"types": ["vite/client", "@modulato/gpu/shaders"]`.

No meshes, instancing or compute: a 3D scene stays on its own engine.

The full reference, including the step-by-step guide for migrating an existing WebGL canvas without changing a pixel, is §11 of
[MODULATO.md](https://github.com/glauberxyz/modulato/blob/main/docs/MODULATO.md).

Part of [modulato](https://www.npmjs.com/package/modulato) — scaffold a site
with `npm create modulato@latest`.
