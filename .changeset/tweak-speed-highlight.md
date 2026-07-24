---
'@modulato/tweak': patch
---

The active speed pill tracks the real playback speed. The highlight now
subscribes to the core's `modulato:speed` event instead of riding on an
incidental status-line rerender — clicking 1× right after a save no longer
looks dead (the click always worked; the highlight just never moved), and a
speed set externally (MCP `set_speed`) moves the highlight too. The redundant
"0.5× speed" status message is gone; the highlighted pill is the indicator.
