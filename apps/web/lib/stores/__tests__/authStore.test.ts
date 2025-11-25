import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  authStore,
  useAuthActions,
  useAuthStatus,
  useIsSessionExpired,
  useSessionExpiredAt,
  useSessionExpiredReason,
} from "../authStore"

describe("authStore", () => {
  // Track location changes via global mock
  let locationHref = ""

  beforeEach(() => {
    // Reset store before each test
    authStore.getState().actions.reset()
    locationHref = ""

    // Mock window.location for redirect tests
    // Note: happy-dom provides window, but we need to mock location.href behavior
    if (typeof window !== "undefined") {
      // Create a mock that tracks href changes
      const mockLocation = Object.create(
        {},
        {
          href: {
            get() {
              return locationHref
            },
            set(value: string) {
              locationHref = value
            },
            configurable: true,
          },
          ancestorOrigins: { value: {} as DOMStringList },
          hash: { value: "", writable: true },
          host: { value: "localhost" },
          hostname: { value: "localhost" },
          origin: { value: "http://localhost" },
          pathname: { value: "/" },
          port: { value: "" },
          protocol: { value: "http:" },
          search: { value: "" },
          assign: { value: vi.fn() },
          reload: { value: vi.fn() },
          replace: { value: vi.fn() },
          toString: { value: () => locationHref },
        },
      ) as Location

      Object.defineProperty(window, "location", {
        value: mockLocation,
        writable: true,
        configurable: true,
      })
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("initial state", () => {
    it("should start with unknown status", () => {
      const { result } = renderHook(() => useAuthStatus())
      expect(result.current).toBe("unknown")
    })

    it("should not be session expired initially", () => {
      const { result } = renderHook(() => useIsSessionExpired())
      expect(result.current).toBe(false)
    })

    it("should have no expired reason initially", () => {
      const { result } = renderHook(() => useSessionExpiredReason())
      expect(result.current).toBeNull()
    })
  })

  describe("setAuthenticated", () => {
    it("should set status to authenticated", () => {
      const { result: statusResult } = renderHook(() => useAuthStatus())
      const { result: actionsResult } = renderHook(() => useAuthActions())

      act(() => {
        actionsResult.current.setAuthenticated()
      })

      expect(statusResult.current).toBe("authenticated")
    })

    it("should clear expired state when authenticated", () => {
      const { result: expiredResult } = renderHook(() => useIsSessionExpired())
      const { result: actionsResult } = renderHook(() => useAuthActions())

      // First expire, then authenticate
      act(() => {
        actionsResult.current.handleSessionExpired("Test reason")
      })
      expect(expiredResult.current).toBe(true)

      act(() => {
        actionsResult.current.setAuthenticated()
      })
      expect(expiredResult.current).toBe(false)
    })
  })

  describe("handleSessionExpired", () => {
    it("should set status to session_expired", () => {
      const { result: statusResult } = renderHook(() => useAuthStatus())
      const { result: actionsResult } = renderHook(() => useAuthActions())

      act(() => {
        actionsResult.current.handleSessionExpired()
      })

      expect(statusResult.current).toBe("session_expired")
    })

    it("should set isSessionExpired to true", () => {
      const { result: expiredResult } = renderHook(() => useIsSessionExpired())
      const { result: actionsResult } = renderHook(() => useAuthActions())

      act(() => {
        actionsResult.current.handleSessionExpired()
      })

      expect(expiredResult.current).toBe(true)
    })

    it("should store the expiry reason", () => {
      const { result: reasonResult } = renderHook(() => useSessionExpiredReason())
      const { result: actionsResult } = renderHook(() => useAuthActions())

      act(() => {
        actionsResult.current.handleSessionExpired("Custom expiry reason")
      })

      expect(reasonResult.current).toBe("Custom expiry reason")
    })

    it("should use default reason when none provided", () => {
      const { result: reasonResult } = renderHook(() => useSessionExpiredReason())
      const { result: actionsResult } = renderHook(() => useAuthActions())

      act(() => {
        actionsResult.current.handleSessionExpired()
      })

      expect(reasonResult.current).toBe("Your session has expired. Please log in again.")
    })

    it("should record expiry timestamp", () => {
      const { result: timestampResult } = renderHook(() => useSessionExpiredAt())
      const { result: actionsResult } = renderHook(() => useAuthActions())

      const before = Date.now()
      act(() => {
        actionsResult.current.handleSessionExpired()
      })
      const after = Date.now()

      expect(timestampResult.current).toBeGreaterThanOrEqual(before)
      expect(timestampResult.current).toBeLessThanOrEqual(after)
    })

    it("should not reset timestamp on repeated calls (idempotent)", () => {
      const { result: timestampResult } = renderHook(() => useSessionExpiredAt())
      const { result: actionsResult } = renderHook(() => useAuthActions())

      act(() => {
        actionsResult.current.handleSessionExpired("First call")
      })
      const firstTimestamp = timestampResult.current

      // Small delay to ensure timestamp would be different if not idempotent
      act(() => {
        actionsResult.current.handleSessionExpired("Second call")
      })

      expect(timestampResult.current).toBe(firstTimestamp)
    })
  })

  describe("redirectToLogin", () => {
    it("should redirect to login page", () => {
      const { result: actionsResult } = renderHook(() => useAuthActions())

      act(() => {
        actionsResult.current.redirectToLogin()
      })

      expect(locationHref).toBe("/?reason=session_expired")
    })

    it("should clear session expired state", () => {
      const { result: statusResult } = renderHook(() => useAuthStatus())
      const { result: actionsResult } = renderHook(() => useAuthActions())

      // First expire
      act(() => {
        actionsResult.current.handleSessionExpired()
      })
      expect(statusResult.current).toBe("session_expired")

      // Then redirect
      act(() => {
        actionsResult.current.redirectToLogin()
      })
      expect(statusResult.current).toBe("unauthenticated")
    })

    it("should clear expiry reason and timestamp", () => {
      const { result: reasonResult } = renderHook(() => useSessionExpiredReason())
      const { result: timestampResult } = renderHook(() => useSessionExpiredAt())
      const { result: actionsResult } = renderHook(() => useAuthActions())

      act(() => {
        actionsResult.current.handleSessionExpired("Test reason")
      })

      act(() => {
        actionsResult.current.redirectToLogin()
      })

      expect(reasonResult.current).toBeNull()
      expect(timestampResult.current).toBeNull()
    })
  })

  describe("reset", () => {
    it("should reset to initial state", () => {
      const { result: statusResult } = renderHook(() => useAuthStatus())
      const { result: expiredResult } = renderHook(() => useIsSessionExpired())
      const { result: actionsResult } = renderHook(() => useAuthActions())

      // Expire first
      act(() => {
        actionsResult.current.handleSessionExpired()
      })

      // Then reset
      act(() => {
        actionsResult.current.reset()
      })

      expect(statusResult.current).toBe("unknown")
      expect(expiredResult.current).toBe(false)
    })
  })

  describe("authStore direct access (for non-React contexts)", () => {
    it("should expose handleSessionExpired", () => {
      authStore.handleSessionExpired("Direct access test")

      const state = authStore.getState()
      expect(state.status).toBe("session_expired")
      expect(state.expiredReason).toBe("Direct access test")
    })

    it("should expose setAuthenticated", () => {
      authStore.setAuthenticated()

      const state = authStore.getState()
      expect(state.status).toBe("authenticated")
    })
  })
})
