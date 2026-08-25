---
'@modulato/server': patch
'@modulato/mcp': patch
---

Dependency hygiene: drop server's stray hard dep on core, bump the MCP SDK

`@modulato/server` declared `modulato` twice — as a peer (`>=0.1.5 <1.0.0`,
the range that is actually meant) and as a plain dependency pinned to `*`.
The `*` entry has been there since the first commit and was simply missed
when the framework packages standardised on peer-only ranges. npm dedupes it
against the site's own copy in practice, so nothing was visibly broken, but
it meant `npm i @modulato/server` quietly pulled a second `modulato` instead
of reporting a missing peer — and core exports a React context and a live
token registry, so two copies is the one failure mode worth being strict
about. The peer already says everything the dependency was saying.

`@modulato/mcp` moves the `@modelcontextprotocol/sdk` floor to `^1.30.0`.
The SDK is the only advisory chain that reached a published package's install
tree — it carries hono, `@hono/node-server`, ajv's fast-uri and
express-rate-limit's ip-address, all of which had open advisories at the
range's old floor. Everything else `npm audit` flagged was build tooling.
