// Vite inlines `?inline` CSS imports as a string (all Modulato apps are Vite).
declare module '*.css?inline' {
  const css: string
  export default css
}

// Vite serves asset imports as a URL string.
declare module '*.woff2' {
  const url: string
  export default url
}
