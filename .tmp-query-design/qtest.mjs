// Minimal DOM shim so the real search.ts can be imported and exercised.
class Loc {
  constructor(href) { this.set(href) }
  set(href) { const u = new URL(href, 'https://x.test'); this.href = u.href; this.pathname = u.pathname; this.search = u.search; this.hash = u.hash }
}
const loc = new Loc('/darkroom?preset=riso')
const handlers = {}
globalThis.window = {
  location: loc,
  history: {
    state: {},
    pushState(s, _t, url) { this.state = s; loc.set(url) },
    replaceState(s, _t, url) { this.state = s; loc.set(url) },
  },
  addEventListener(t, cb) { (handlers[t] ??= []).push(cb) },
  removeEventListener(t, cb) { handlers[t] = (handlers[t] ?? []).filter((h) => h !== cb) },
}
globalThis.history = window.history

const m = await import('./framework/core/src/search.ts')

const eq = (a, b, msg) => console.log((JSON.stringify(a) === JSON.stringify(b) ? 'PASS ' : 'FAIL ') + msg, JSON.stringify(a))

// 1. Gate closed = server/hydration answer, even though location HAS a query.
eq(m.getQuery(), {}, 'gate closed -> {} (matches SSR HTML)')

// 2. A subscriber gets notified when the gate opens.
let notified = 0
// (subscribe is not exported; useSearchParams subscribes. Emulate by opening.)
m.openQuery()
eq(m.getQuery(), { preset: 'riso' }, 'gate open -> live query')

// 3. Identity is stable until the search string changes.
console.log((m.getQuery() === m.getQuery() ? 'PASS ' : 'FAIL ') + 'stable identity between reads')
const before = m.getQuery()

// 4. setSearchParam (shallow write) is visible IMMEDIATELY, no re-resolve.
m.setSearchParam('preset', 'blown')
eq(m.getQuery(), { preset: 'blown' }, 'fresh right after setSearchParam')
console.log((m.getQuery() !== before ? 'PASS ' : 'FAIL ') + 'new identity after a real change')

// 5. Frozen.
try { m.getQuery().preset = 'x'; console.log('FAIL not frozen') } catch { console.log('PASS frozen (throws on write)') }

// 6. popstate: location changed by the browser, no notify from us.
loc.set('/darkroom?preset=newsprint&tag=a&tag=b')
eq(m.getQuery(), { preset: 'newsprint', tag: 'a' }, 'popstate/live read; repeated key = first wins')

// 7. __proto__ / constructor stay ordinary keys.
loc.set('/x?__proto__=evil&constructor=c&empty=')
eq({ ...m.getQuery() }, { __proto__: 'evil', constructor: 'c', empty: '' }, 'null-prototype: __proto__/constructor/empty')
console.log((Object.getPrototypeOf({}).polluted === undefined ? 'PASS ' : 'FAIL ') + 'no prototype pollution')

// 8. Empty search.
loc.set('/x')
eq(m.getQuery(), {}, 'no query -> {}')
