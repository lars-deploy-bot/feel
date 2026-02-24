import { describe, expect, it } from "vitest"
import { generatePKCEChallenge } from "../pkce"
import {
  GitHubProvider,
  GoogleProvider,
  getProvider,
  hasProvider,
  LinearProvider,
  listProviders,
  MicrosoftProvider,
} from "../providers"

/**
 * Helper: split a space-delimited scope string into a sorted array for comparison.
 */
function scopeSet(scopes: string): string[] {
  return scopes.split(" ").filter(Boolean).sort()
}

describe("OAuth Providers", () => {
  describe("GoogleProvider", () => {
    const google = new GoogleProvider()

    describe("#getAuthUrl", () => {
      it("returns valid authorization URL", () => {
        const url = google.getAuthUrl("client123", "http://localhost:3000/callback", "email profile", "state123")

        expect(url).toContain("https://accounts.google.com/o/oauth2/v2/auth")
        expect(url).toContain("client_id=client123")
        expect(url).toContain("redirect_uri=")
        expect(url).toContain("scope=email+profile")
        expect(url).toContain("state=state123")
        expect(url).toContain("response_type=code")
      })

      it("includes access_type=offline for refresh tokens", () => {
        const url = google.getAuthUrl("client123", "http://localhost:3000/callback", "email")

        expect(url).toContain("access_type=offline")
      })

      it("includes PKCE challenge when provided", () => {
        const pkce = generatePKCEChallenge()

        const url = google.getAuthUrl("client123", "http://localhost:3000/callback", "email", "state123", pkce)

        expect(url).toContain(`code_challenge=${pkce.code_challenge}`)
        expect(url).toContain("code_challenge_method=S256")
      })

      it("includes prompt=consent when forceConsent is true", () => {
        const url = google.getAuthUrl("client123", "http://localhost:3000/callback", "email", undefined, undefined, {
          forceConsent: true,
        })

        expect(url).toContain("prompt=consent")
      })
    })

    // -----------------------------------------------------------------------
    // Scope contract tests (regression gate for issue #131)
    //
    // These tests catch two classes of bugs:
    // 1. Scope profile composition — adding/removing a scope from a profile
    // 2. Scope mutual exclusivity — mixing incompatible scopes (e.g. modify + readonly)
    //
    // The callback hardening PR (#174) will consume GoogleProvider.SCOPES
    // for granted-scope verification at callback time.
    // -----------------------------------------------------------------------

    describe("scope contracts", () => {
      describe("Gmail modify profile", () => {
        it("contains exactly gmail.modify + profile + email", () => {
          const { GMAIL_MODIFY, USERINFO_PROFILE, USERINFO_EMAIL } = GoogleProvider.SCOPES
          expect(scopeSet(GoogleProvider.GMAIL_MODIFY_SCOPES)).toEqual(
            [GMAIL_MODIFY, USERINFO_PROFILE, USERINFO_EMAIL].sort(),
          )
        })

        it("does NOT include gmail.readonly (mutually exclusive with modify)", () => {
          expect(GoogleProvider.GMAIL_MODIFY_SCOPES).not.toContain(GoogleProvider.SCOPES.GMAIL_READONLY)
        })
      })

      describe("Gmail readonly profile", () => {
        it("contains exactly gmail.readonly + profile + email", () => {
          const { GMAIL_READONLY, USERINFO_PROFILE, USERINFO_EMAIL } = GoogleProvider.SCOPES
          expect(scopeSet(GoogleProvider.GMAIL_READONLY_SCOPES)).toEqual(
            [GMAIL_READONLY, USERINFO_PROFILE, USERINFO_EMAIL].sort(),
          )
        })

        it("does NOT include gmail.modify (mutually exclusive with readonly)", () => {
          expect(GoogleProvider.GMAIL_READONLY_SCOPES).not.toContain(GoogleProvider.SCOPES.GMAIL_MODIFY)
        })
      })

      describe("Calendar profile", () => {
        it("contains exactly calendar.events + calendarlist.readonly + email", () => {
          const { CALENDAR_EVENTS, CALENDAR_LIST_READONLY, USERINFO_EMAIL } = GoogleProvider.SCOPES
          expect(scopeSet(GoogleProvider.CALENDAR_SCOPES)).toEqual(
            [CALENDAR_EVENTS, CALENDAR_LIST_READONLY, USERINFO_EMAIL].sort(),
          )
        })
      })

      describe("profiles are distinct", () => {
        it("Gmail modify and Calendar share no capability scopes", () => {
          const gmailScopes = scopeSet(GoogleProvider.GMAIL_MODIFY_SCOPES)
          const calendarScopes = scopeSet(GoogleProvider.CALENDAR_SCOPES)

          // Only identity scopes (userinfo.*) should overlap
          const overlap = gmailScopes.filter(s => calendarScopes.includes(s))
          for (const scope of overlap) {
            expect(scope).toContain("userinfo")
          }
        })
      })
    })
  })

  describe("LinearProvider", () => {
    const linear = new LinearProvider()

    describe("#getAuthUrl", () => {
      it("returns valid authorization URL", () => {
        const url = linear.getAuthUrl("client123", "http://localhost:3000/callback", "read write", "state123")

        expect(url).toContain("https://linear.app/oauth/authorize")
        expect(url).toContain("client_id=client123")
        expect(url).toContain("scope=read+write")
        expect(url).toContain("response_type=code")
      })

      it("includes PKCE challenge when provided", () => {
        const pkce = generatePKCEChallenge()

        const url = linear.getAuthUrl("client123", "http://localhost:3000/callback", "read", "state123", pkce)

        expect(url).toContain(`code_challenge=${pkce.code_challenge}`)
        expect(url).toContain("code_challenge_method=S256")
      })
    })
  })

  describe("GitHubProvider", () => {
    const github = new GitHubProvider()

    describe("#getAuthUrl", () => {
      it("returns valid authorization URL", () => {
        const url = github.getAuthUrl("client123", "http://localhost:3000/callback", "repo user", "state123")

        expect(url).toContain("https://github.com/login/oauth/authorize")
        expect(url).toContain("client_id=client123")
        expect(url).toContain("scope=repo+user")
      })

      it("does not include PKCE (GitHub does not support it)", () => {
        const url = github.getAuthUrl("client123", "http://localhost:3000/callback", "repo")

        // GitHub doesn't support PKCE
        expect(url).not.toContain("code_challenge")
      })
    })
  })

  describe("MicrosoftProvider", () => {
    const microsoft = new MicrosoftProvider()

    describe("#getAuthUrl", () => {
      it("returns valid authorization URL with scopes", () => {
        const url = microsoft.getAuthUrl(
          "client123",
          "http://localhost:3000/callback",
          "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read",
          "state123",
        )

        expect(url).toContain("https://login.microsoftonline.com/common/oauth2/v2.0/authorize")
        expect(url).toContain("client_id=client123")
        expect(url).toContain("redirect_uri=")
        expect(url).toContain("state=state123")
        expect(url).toContain("response_type=code")

        // Verify requested scopes are forwarded
        const urlObj = new URL(url)
        const scope = urlObj.searchParams.get("scope") ?? ""
        expect(scope).toContain("Mail.Read")
        expect(scope).toContain("User.Read")
      })

      it("always injects offline_access for refresh tokens", () => {
        const url = microsoft.getAuthUrl(
          "client123",
          "http://localhost:3000/callback",
          "https://graph.microsoft.com/Mail.Read",
        )

        const urlObj = new URL(url)
        const scope = urlObj.searchParams.get("scope") ?? ""
        expect(scope).toContain("offline_access")
      })

      it("does not duplicate offline_access if already present", () => {
        const url = microsoft.getAuthUrl(
          "client123",
          "http://localhost:3000/callback",
          "offline_access https://graph.microsoft.com/Mail.Read",
        )

        // Count occurrences of offline_access in the scope parameter
        const urlObj = new URL(url)
        const scope = urlObj.searchParams.get("scope") || ""
        const occurrences = scope.split("offline_access").length - 1
        expect(occurrences).toBe(1)
      })

      it("includes prompt=consent", () => {
        const url = microsoft.getAuthUrl("client123", "http://localhost:3000/callback", "User.Read")

        expect(url).toContain("prompt=consent")
      })

      it("includes PKCE challenge when provided", () => {
        const pkce = generatePKCEChallenge()

        const url = microsoft.getAuthUrl("client123", "http://localhost:3000/callback", "User.Read", "state123", pkce)

        expect(url).toContain(`code_challenge=${pkce.code_challenge}`)
        expect(url).toContain("code_challenge_method=S256")
      })

      it("includes state when provided", () => {
        const url = microsoft.getAuthUrl("client123", "http://localhost:3000/callback", "User.Read", "random-state-123")

        expect(url).toContain("state=random-state-123")
      })

      it("omits state when not provided", () => {
        const url = microsoft.getAuthUrl("client123", "http://localhost:3000/callback", "User.Read")

        expect(url).not.toContain("state=")
      })
    })

    // -----------------------------------------------------------------------
    // Scope contract tests
    //
    // Validates that scope profiles are composed correctly and that
    // offline_access is handled properly (requested but not validated).
    // -----------------------------------------------------------------------

    describe("scope contracts", () => {
      describe("Outlook readwrite profile", () => {
        it("contains offline_access + Mail.ReadWrite + Mail.Send + User.Read", () => {
          const { OFFLINE_ACCESS, MAIL_READWRITE, MAIL_SEND, USER_READ } = MicrosoftProvider.SCOPES
          expect(scopeSet(MicrosoftProvider.OUTLOOK_READWRITE_SCOPES)).toEqual(
            [OFFLINE_ACCESS, MAIL_READWRITE, MAIL_SEND, USER_READ].sort(),
          )
        })

        it("does NOT include Mail.Read (use Mail.ReadWrite instead)", () => {
          const scopes = scopeSet(MicrosoftProvider.OUTLOOK_READWRITE_SCOPES)
          expect(scopes).not.toContain(MicrosoftProvider.SCOPES.MAIL_READ)
        })
      })

      describe("Outlook readonly profile", () => {
        it("contains offline_access + Mail.Read + User.Read", () => {
          const { OFFLINE_ACCESS, MAIL_READ, USER_READ } = MicrosoftProvider.SCOPES
          expect(scopeSet(MicrosoftProvider.OUTLOOK_READONLY_SCOPES)).toEqual(
            [OFFLINE_ACCESS, MAIL_READ, USER_READ].sort(),
          )
        })

        it("does NOT include Mail.ReadWrite (mutually exclusive with readonly)", () => {
          expect(MicrosoftProvider.OUTLOOK_READONLY_SCOPES).not.toContain(MicrosoftProvider.SCOPES.MAIL_READWRITE)
        })

        it("does NOT include Mail.Send (readonly should not send)", () => {
          expect(MicrosoftProvider.OUTLOOK_READONLY_SCOPES).not.toContain(MicrosoftProvider.SCOPES.MAIL_SEND)
        })
      })

      describe("profiles are distinct", () => {
        it("readwrite and readonly share only User.Read and offline_access", () => {
          const readwriteScopes = scopeSet(MicrosoftProvider.OUTLOOK_READWRITE_SCOPES)
          const readonlyScopes = scopeSet(MicrosoftProvider.OUTLOOK_READONLY_SCOPES)

          const overlap = readwriteScopes.filter(s => readonlyScopes.includes(s))
          expect(overlap.sort()).toEqual(
            [MicrosoftProvider.SCOPES.USER_READ, MicrosoftProvider.SCOPES.OFFLINE_ACCESS].sort(),
          )
        })
      })
    })
  })

  describe("URL Encoding", () => {
    const google = new GoogleProvider()

    it("properly encodes redirect_uri with special characters", () => {
      const url = google.getAuthUrl("client123", "http://localhost:3000/callback?foo=bar", "email")

      // URL should be encoded
      expect(url).toContain(encodeURIComponent("http://localhost:3000/callback?foo=bar"))
    })

    it("properly encodes scope with spaces", () => {
      const url = google.getAuthUrl("client123", "http://localhost:3000/callback", "email profile openid")

      // Spaces should be encoded as +
      expect(url).toContain("scope=email+profile+openid")
    })
  })

  describe("State Parameter", () => {
    const google = new GoogleProvider()

    it("includes state when provided", () => {
      const url = google.getAuthUrl("client123", "http://localhost:3000/callback", "email", "random-state-123")

      expect(url).toContain("state=random-state-123")
    })

    it("omits state when not provided", () => {
      const url = google.getAuthUrl("client123", "http://localhost:3000/callback", "email")

      expect(url).not.toContain("state=")
    })
  })

  describe("Provider Registry", () => {
    it("microsoft is registered", () => {
      expect(hasProvider("microsoft")).toBe(true)
    })

    it("google_calendar is registered as a Google alias", () => {
      expect(hasProvider("google_calendar")).toBe(true)
      expect(getProvider("google_calendar").name).toBe("google")
    })

    it("getProvider returns MicrosoftProvider instance", () => {
      const provider = getProvider("microsoft")
      expect(provider.name).toBe("microsoft")
    })

    it("listProviders includes microsoft", () => {
      expect(listProviders()).toContain("microsoft")
    })
  })
})
