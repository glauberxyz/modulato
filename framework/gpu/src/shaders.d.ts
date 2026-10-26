/**
 * Shader file imports, as `@modulato/vite` compiles them.
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
