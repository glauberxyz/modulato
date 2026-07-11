import { action } from 'modulato'

// Server-only: this module never reaches the client bundle — the build
// replaces it with URL stubs. Secrets and SDK calls are safe here.
export const subscribe = action(async ({ form }) => {
  const email = String(form.get('email') ?? '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('That email doesn’t look right — try again?')
  }
  // A real site would call its ESP here (Klaviyo, Buttondown, …).
  await new Promise((resolve) => setTimeout(resolve, 400))
  return { message: `${email} is on the list. (Demo — nothing was stored.)` }
})
