/**
 * @modulato/gpu — fragment passes on the GPU, Modulato-style.
 *
 * WGSL runs on WebGPU and GLSL on WebGL2, from the same API; a pass given
 * both runs whichever the browser has. Imported shader files hot-swap in
 * place, and uniforms take token groups as-is, so Tweak edits a shader the
 * way it edits a tween. The full reference is the GPU section of MODULATO.md.
 */
export { createGpu, type SurfaceInfo } from './gpu'
export { GpuStage, type GpuStageProps, useGpu, usePlane } from './react'
export { createStage, type PlaneFrame, type PlaneOptions, type Stage, type StageOptions } from './stage'
export { onLateFrame } from './late'
export { isShader } from './shader'
export { loadImage } from './common'
export type {
  Backend,
  DrawOptions,
  FragmentInput,
  Gpu,
  GpuOptions,
  Pass,
  PassOptions,
  PointsAsset,
  Rect,
  SdfAsset,
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
