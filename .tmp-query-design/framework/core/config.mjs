// Runtime for `modulato/config` — modulato.config.ts executes in plain Node
// (the CLI's config loader), so this entry must not touch the TS source.
// Types come from ./src/config.ts via the exports map's "types" condition.

/** Identity helper for typed modulato.config.ts files. */
export function defineConfig(config) {
  return config
}
