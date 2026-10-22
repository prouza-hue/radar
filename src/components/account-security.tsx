"use client"

import { useAction, useQuery } from "convex/react"
import { ConvexError } from "convex/values"
import { api } from "@/convex/_generated/api"
import { useState } from "react"
import { GoogleAuthButton } from "@/components/google-auth-button"

export function AccountSecurity() {
  const security = useQuery(api.googleAuth.accountSecurity)
  const unlinkGoogle = useAction(api.googleAuth.unlinkGoogle)
  const revokeOtherSessions = useAction(api.googleAuth.revokeOtherSessions)
  const revokeAllSessions = useAction(api.googleAuth.revokeAllSessions)
  const [error, setError] = useState<string | null>(null)

  const run = async (message: string, operation: () => Promise<unknown>) => {
    if (!window.confirm(message)) return
    setError(null)
    try {
      await operation()
    } catch (caught) {
      const code =
        caught instanceof ConvexError &&
        typeof caught.data === "object" &&
        caught.data &&
        "code" in caught.data
          ? caught.data.code
          : null
      setError(
        code === "LAST_SIGN_IN_METHOD"
          ? "Google je jediný způsob přihlášení, proto jej nelze odpojit."
          : "Změnu se nepodařilo dokončit. Přihlas se znovu a opakuj ji.",
      )
    }
  }

  if (!security) return null
  return (
    <section aria-labelledby="account-security-title">
      <h2 id="account-security-title">Přihlášení a zabezpečení</h2>
      {security.googleLinked ? (
        <button
          className="secondary" type="button"
          disabled={!security.canUnlinkGoogle}
          onClick={() =>
            void run("Odpojit Google from this account?", () =>
              unlinkGoogle({}),
            )
          }
        >
          Odpojit Google
        </button>
      ) : (
        <GoogleAuthButton mode="link" />
      )}
      {security.googleLinked && !security.canUnlinkGoogle ? (
        <p>Google je jediný způsob přihlášení, proto jej nelze odpojit.</p>
      ) : null}
      <button
        className="secondary" type="button"
        onClick={() =>
          void run("Sign out every other browser?", () =>
            revokeOtherSessions({}),
          )
        }
      >
        Odhlásit ostatní zařízení
      </button>
      <button
        className="secondary" type="button"
        onClick={() =>
          void run("Sign out every browser, including this one?", async () => {
            await revokeAllSessions({})
            window.location.replace("/")
          })
        }
      >
        Odhlásit všechna zařízení
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  )
}