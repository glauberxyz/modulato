/** The overlay's own shadow host. Its contents are ours, not the site's. */
export const OVERLAY_HOST = '__modulato-tweak'

/**
 * The deepest focused element, walking INTO shadow trees.
 *
 * `document.activeElement` retargets to the shadow HOST, so a focused field
 * inside a shadow tree reads as the host `<div>` from outside. The overlay's
 * own inputs live in exactly such a tree, so every check that cares about
 * "is somebody typing" has to walk in.
 */
function deepActive(): HTMLElement | null {
  let el: Element | null = document.activeElement
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement
  return el instanceof HTMLElement ? el : null
}

function isField(el: HTMLElement): boolean {
  return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
}

/** Is the caret in a text field anywhere — the site's or ours? */
export function isTyping(): boolean {
  const el = deepActive()
  return !!el && isField(el)
}

/**
 * The overlay's own focused text field, or null.
 *
 * The distinction from `isTyping` matters for Escape: a field inside the panel
 * is ours to blur, and a field on the SITE is not — pressing Escape in the
 * page's own search box should do whatever the page does, not reach into it.
 * `document.activeElement === host` is the test, because that is exactly what
 * focus inside our shadow tree looks like from out here.
 */
export function focusedOverlayField(): HTMLElement | null {
  const host = document.getElementById(OVERLAY_HOST)
  if (!host || document.activeElement !== host) return null
  const el = deepActive()
  return el && isField(el) ? el : null
}
