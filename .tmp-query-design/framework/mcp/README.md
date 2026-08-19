# @modulato/mcp

MCP server for Modulato projects — agents get the same surface the CLI and
Tweak overlay use: `list_routes`, `check`, scaffolds, `list_motion_tokens`,
`set_motion_tokens` (AST-preserving writeback, applied live via HMR),
`replay` and `set_speed` against the running dev server.

```sh
cd your-site && claude mcp add modulato -- npx modulato-mcp
```

Part of [modulato](https://www.npmjs.com/package/modulato).
