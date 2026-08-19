import { useCallback, useState, type FormEvent } from 'react'

export interface ActionContext {
  /** The submitted form data. */
  form: FormData
}

/**
 * A server action reference. On the SERVER this carries the real handler
 * (plus its URL, stamped by the build). On the CLIENT the whole server.ts
 * module is replaced with URL-only stubs — handler code, imports and secrets
 * never reach the browser bundle.
 */
export interface Action<T = unknown> {
  $action: true
  /** POST endpoint — filled in by @modulato/vite from the file's location. */
  url: string
  method: 'post'
  handler?: (ctx: ActionContext) => T | Promise<T>
}

/**
 * Declare a server action in a page's colocated server.ts:
 *
 *   // pages/contact/server.ts — server-only, secrets are safe here
 *   export const subscribe = action(async ({ form }) => {
 *     await klaviyo.subscribe(String(form.get('email')))
 *     return { message: 'Subscribed!' }
 *   })
 *
 * Throwing makes the submission fail with the error message. Return
 * `{ redirect: '/thanks' }` to redirect no-JS submissions.
 */
export function action<T>(handler: (ctx: ActionContext) => T | Promise<T>): Action<T> {
  return { $action: true, url: '', method: 'post', handler }
}

export type FormActionPhase = 'idle' | 'pending' | 'ok' | 'error'

export interface FormAction<T> {
  /** Spread onto the <form>: real action/method (works without JS) + interception. */
  attrs: {
    action: string
    method: 'post'
    onSubmit: (event: FormEvent<HTMLFormElement>) => void
  }
  state: FormActionPhase
  data: T | null
  error: string | null
  reset: () => void
}

/**
 * Progressive form wiring for a server action. The form renders with a real
 * action URL — no JS still submits (the server answers with a redirect).
 * With JS the submit is intercepted and posted via fetch, and `state`
 * transitions idle → pending → ok|error for animated feedback.
 */
export function useFormAction<T>(ref: Action<T>): FormAction<T> {
  const [state, setState] = useState<FormActionPhase>('idle')
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const form = new FormData(event.currentTarget)
      setState('pending')
      setError(null)
      void fetch(ref.url, {
        method: 'POST',
        body: form,
        headers: { accept: 'application/json' },
      })
        .then(async (res) => {
          const body = (await res.json()) as { ok: boolean; data?: T; error?: string }
          if (body.ok) {
            setData(body.data ?? null)
            setState('ok')
          } else {
            setError(body.error ?? `request failed (${res.status})`)
            setState('error')
          }
        })
        .catch((err: unknown) => {
          setError(String(err))
          setState('error')
        })
    },
    [ref.url],
  )

  const reset = useCallback(() => {
    setState('idle')
    setData(null)
    setError(null)
  }, [])

  return { attrs: { action: ref.url, method: 'post', onSubmit }, state, data, error, reset }
}
