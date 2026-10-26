/**
 * Shader file and GPU asset imports, as `@modulato/vite` compiles them.
 *
 * Opt-in, through `compilerOptions.types` — `["vite/client",
 * "@modulato/gpu/shaders"]`. Not referenced from the package's own index on
 * purpose: a site that already imports `.glsl` through another plugin has its
 * own `declare module '*.glsl'`, and two wildcard declarations that disagree
 * about the default export are a type error in a project that changed
 * nothing but installing this package.
 */

declare module '*.wgsl' {
  const shader: import('@modulato/gpu').Shader
  export default shader
}

declare module '*.glsl' {
  const shader: import('@modulato/gpu').Shader
  export default shader
}

declare module '*.frag' {
  const shader: import('@modulato/gpu').Shader
  export default shader
}

declare module '*.vert' {
  const shader: import('@modulato/gpu').Shader
  export default shader
}

// Build-time assets. The kind goes LAST in the query — `?size=256&sdf` —
// which is what lets one wildcard per kind type every variant.
declare module '*?sdf' {
  const asset: import('@modulato/gpu').SdfAsset
  export default asset
}
declare module '*&sdf' {
  const asset: import('@modulato/gpu').SdfAsset
  export default asset
}
declare module '*?points' {
  const asset: import('@modulato/gpu').PointsAsset
  export default asset
}
declare module '*&points' {
  const asset: import('@modulato/gpu').PointsAsset
  export default asset
}
