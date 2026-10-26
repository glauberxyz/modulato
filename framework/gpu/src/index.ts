/**
 * @modulato/gpu — fragment passes on the GPU, Modulato-style.
 *
 * WGSL runs on WebGPU and GLSL on WebGL2, from the same API; a pass given
 * both runs whichever the browser has. Imported shader files hot-swap in
 * place, and uniforms take token groups as-is, so Tweak edits a shader the
 * way it edits a tween. The full reference is the GPU section of MODULATO.md.
 */
export { createGpu, type SurfaceInfo } from './gpu'
export { useGpu } from './react'
export { isShader } from './shader'
export type {
  Backend,
  FragmentInput,
  Gpu,
  GpuOptions,
  Pass,
  PassOptions,
  Shader,
  ShaderLang,
  ShaderSource,
  Target,
  TargetOptions,
  Texture,
  TextureData,
  TextureOptions,
  TextureSource,
  UniformValue,
} from './types'
