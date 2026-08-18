---
'modulato': patch
---

Back and Forward during a transition no longer desync the URL from the page.

The popstate handler ignores a traversal whose path matches the page already on
screen — that guard is for a query or hash change pushed by `useSearchParam`,
which must not re-resolve or remount anything. It compared against
`state.current`, and during an uncommitted transition `current` is still the
page being animated AWAY: the address bar was pushed to the destination when the
navigation started.

So a traversal back to the outgoing page looked like a query-only change and was
dropped. The URL became the old path while the app carried on committing the new
one, and the two disagreed until the next navigation — reproducible by stalling
a transition and pressing Back, and easy to hit for real on a slow connection or
with a long transition.

The comparison is now against the pending entry when there is one, which is what
the URL is actually showing. A genuine traversal mid-transition cancels the
in-flight one and starts its own — the reader has asked for a different
destination than the one being animated to, and finishing that first would land
them on a page they have already left. That needed no new machinery: `navigate`
takes a fresh token, and the transition effect's cleanup marks the running one
cancelled as soon as the pending entry changes.
