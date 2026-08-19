# @modulato/content-local

Local JSON content adapter for Modulato: every `content/*.json` becomes a
typed key of the content snapshot (`modulato content` pulls + generates
types). Also the reference implementation for writing adapters — an adapter
is `{ name, pull({ root }) => snapshot }`.

Part of [modulato](https://www.npmjs.com/package/modulato).
