// Vite inlines `?inline` CSS imports as a string (all Modulato apps are Vite).
declare module '*.css?inline' {
  const css: string
  export default css
}
