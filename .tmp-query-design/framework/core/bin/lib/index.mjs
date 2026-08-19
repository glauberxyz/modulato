// Programmatic access to the CLI's operations — used by @modulato/mcp so
// agents and the command line share one implementation.
export { scanRoutes, scanTransitions, toPattern, encodeRouteId, decodeRouteId } from './scan.mjs'
export { newPage, newTransition, newBehavior, newIntro, ScaffoldError } from './scaffold.mjs'
export { check } from './check.mjs'
