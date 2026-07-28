import { enhance } from 'modulato'

/**
 * Enhancer for prose we don't hand-author: any year in the text gets a thin
 * underline and a tooltip, so dates read as data. Applies to every matching
 * node when a page mounts and cleans up on unmount.
 */
export default enhance('.movement__p, .plate__note', ({ element }) => {
  const YEAR = /\b(1[5-9]\d{2}|20[0-2]\d)\b/g
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const targets: Text[] = []
  let node = walker.nextNode()
  while (node) {
    if (node.textContent && YEAR.test(node.textContent)) targets.push(node as Text)
    YEAR.lastIndex = 0
    node = walker.nextNode()
  }

  for (const text of targets) {
    const frag = document.createDocumentFragment()
    let last = 0
    const source = text.textContent ?? ''
    for (const match of source.matchAll(YEAR)) {
      const at = match.index ?? 0
      frag.append(source.slice(last, at))
      const mark = document.createElement('span')
      mark.className = 'year'
      mark.textContent = match[0]
      frag.append(mark)
      last = at + match[0].length
    }
    frag.append(source.slice(last))
    text.replaceWith(frag)
  }

  // Nothing to tear down — the nodes die with the page.
  return undefined
})
