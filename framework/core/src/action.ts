import { useCallback, useState, type FormEvent } from 'react'
import type { Cookies } from './cookies'

export interface ActionContext {
  /** The submitted form data. */
  form: FormData
  /**
   * The whole request — headers, method, url. Already consumed into `form`,
   * so read the body through that rather than `request.formData()`.
   *
   * This is how an action authenticates: `request.headers`, or `cookies`
   * below for the common case.
   */
  request: Request
  /**
   * Read and write cookies. Writes are flushed onto the response when the
   * handler returns — including when it THROWS, so an action that clears a
   * session and then rejects still clears it.
   */
  cookies: Cookies
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
 * The handler also gets `request` and `cookies`, which is what makes a
 * session possible — sign-in is an action that verifies a password and sets
 * an httpOnly cookie:
 *
 *   export const signIn = action(async ({ form, cookies }) => {
 *     const token = await verify(form.get('email'), form.get('password'))
 *     cookies.set('session', token, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 })
 *     return { redirect: '/dashboard' }
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
