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

Opt in to shader-import types in `tsconfig.json`:
`"types": ["vite/client", "@modulato/gpu/shaders"]`.

Fragment passes only, for now — a scene with meshes or blending stays on its
own engine. The full reference, including the step-by-step guide for
migrating an existing WebGL canvas without changing a pixel, is §11 of
[MODULATO.md](https://github.com/glauberxyz/modulato/blob/main/docs/MODULATO.md).

Part of [modulato](https://www.npmjs.com/package/modulato) — scaffold a site
with `npm create modulato@latest`.
