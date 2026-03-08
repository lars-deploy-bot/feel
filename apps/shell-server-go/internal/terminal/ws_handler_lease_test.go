package terminal

import (
	"testing"
	"time"
)

func TestConsumeLeaseAllowsInternalLeaseWithoutMatchingCookie(t *testing.T) {
	handler := &WSHandler{
		leases: map[string]WSLease{
			"internal-token": {
				SessionToken: internalLeaseSessionToken,
				Workspace:    "example.com",
				Cwd:          "/srv/webalive/sites/example.com/user",
				RunAsOwner:   true,
				ExpiresAt:    time.Now().Add(time.Minute),
			},
		},
	}

	workspace, cwd, runAsOwner, err := handler.consumeLease("browser-cookie", "internal-token")
	if err != nil {
		t.Fatalf("consumeLease returned error: %v", err)
	}

	if workspace != "example.com" {
		t.Fatalf("workspace = %q, want %q", workspace, "example.com")
	}
	if cwd != "/srv/webalive/sites/example.com/user" {
		t.Fatalf("cwd = %q, want %q", cwd, "/srv/webalive/sites/example.com/user")
	}
	if !runAsOwner {
		t.Fatal("expected runAsOwner to be true")
	}
}

func TestConsumeLeaseRejectsMismatchedBrowserLease(t *testing.T) {
	handler := &WSHandler{
		leases: map[string]WSLease{
			"browser-token": {
				SessionToken: "session-a",
				Workspace:    "example.com",
				Cwd:          "/srv/webalive/sites/example.com/user",
				RunAsOwner:   true,
				ExpiresAt:    time.Now().Add(time.Minute),
			},
		},
	}

	_, _, _, err := handler.consumeLease("session-b", "browser-token")
	if err != ErrLeaseSessionDenied {
		t.Fatalf("consumeLease error = %v, want %v", err, ErrLeaseSessionDenied)
	}
}
