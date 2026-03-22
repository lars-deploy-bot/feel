use serde::{Deserialize, Serialize};
use tsify_next::Tsify;

use crate::types::{CancelSource, ErrorCode, MessageType, Outcome, TransitionError};

// ---------------------------------------------------------------------------
// Server State
// ---------------------------------------------------------------------------

/// Server-side stream state machine.
///
/// Each variant carries exactly the data valid for that state.
/// Only `server_transition()` can produce new states.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub enum ServerStreamState {
    Idle,

    Starting {
        request_id: String,
        tab_id: String,
        conversation_key: String,
    },

    SessionReceived {
        request_id: String,
        tab_id: String,
        conversation_key: String,
        session_id: String,
    },

    Streaming {
        request_id: String,
        stream_seq: u64,
        input_tokens: u64,
        output_tokens: u64,
        pending_tools: Vec<String>,
        message_count: u64,
    },

    Cancelling {
        cancel_source: CancelSource,
        input_tokens: u64,
        output_tokens: u64,
    },

    Completing {
        total_messages: u64,
        input_tokens: u64,
        output_tokens: u64,
        credits_charged: bool,
    },

    /// Terminal.
    Done { outcome: Outcome },

    Error {
        error_code: ErrorCode,
        last_good_seq: u64,
    },

    Buffering {
        request_id: String,
        stream_seq: u64,
        input_tokens: u64,
        output_tokens: u64,
        pending_tools: Vec<String>,
        message_count: u64,
        buffer_message_count: u64,
    },

    BufferedComplete {
        total_buffered: u64,
    },

    Stale {
        last_activity_at: u64,
        stale_detected_at: u64,
    },
}

impl ServerStreamState {
    pub fn state_name(&self) -> &'static str {
        match self {
            Self::Idle => "Idle",
            Self::Starting { .. } => "Starting",
            Self::SessionReceived { .. } => "SessionReceived",
            Self::Streaming { .. } => "Streaming",
            Self::Cancelling { .. } => "Cancelling",
            Self::Completing { .. } => "Completing",
            Self::Done { .. } => "Done",
            Self::Error { .. } => "Error",
            Self::Buffering { .. } => "Buffering",
            Self::BufferedComplete { .. } => "BufferedComplete",
            Self::Stale { .. } => "Stale",
        }
    }

    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Done { .. })
    }
}

// ---------------------------------------------------------------------------
// Server Events
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub enum ServerEvent {
    ChildProcessStarted { request_id: String, tab_id: String, conversation_key: String },
    SessionIdReceived { session_id: String },
    MessageReceived { stream_seq: u64, message_type: MessageType },
    ToolUseStarted { tool_use_id: String, tool_name: String },
    ToolResultReceived { tool_use_id: String },
    CompleteReceived { total_messages: u64 },
    PingReceived,
    ErrorOccurred { error_code: ErrorCode, message: String },
    CancelRequested { source: CancelSource },
    ReaderDone,
    CreditsCharged,
    CleanupDone,
    ClientDisconnected,
    ClientReconnected,
    BufferFull,
    StaleDetected { last_activity_at: u64, detected_at: u64 },
    TokensAccumulated { input_tokens: u64, output_tokens: u64 },
}

impl ServerEvent {
    pub fn event_name(&self) -> &'static str {
        match self {
            Self::ChildProcessStarted { .. } => "ChildProcessStarted",
            Self::SessionIdReceived { .. } => "SessionIdReceived",
            Self::MessageReceived { .. } => "MessageReceived",
            Self::ToolUseStarted { .. } => "ToolUseStarted",
            Self::ToolResultReceived { .. } => "ToolResultReceived",
            Self::CompleteReceived { .. } => "CompleteReceived",
            Self::PingReceived => "PingReceived",
            Self::ErrorOccurred { .. } => "ErrorOccurred",
            Self::CancelRequested { .. } => "CancelRequested",
            Self::ReaderDone => "ReaderDone",
            Self::CreditsCharged => "CreditsCharged",
            Self::CleanupDone => "CleanupDone",
            Self::ClientDisconnected => "ClientDisconnected",
            Self::ClientReconnected => "ClientReconnected",
            Self::BufferFull => "BufferFull",
            Self::StaleDetected { .. } => "StaleDetected",
            Self::TokensAccumulated { .. } => "TokensAccumulated",
        }
    }
}

// ---------------------------------------------------------------------------
// Server Transition
// ---------------------------------------------------------------------------

/// Pure transition function. Every (state, event) pair is handled — adding a
/// new state variant without match arms is a compile error.  Within each state
/// block, valid transitions are listed first; everything else falls through to
/// a per-state wildcard that returns `TransitionError::inapplicable`.
#[must_use]
pub fn server_transition(
    state: ServerStreamState,
    event: ServerEvent,
) -> Result<ServerStreamState, TransitionError> {
    use ServerEvent as E;
    use ServerStreamState as S;

    match (state, event) {
        // ── Idle ────────────────────────────────────────────────────
        (S::Idle, E::ChildProcessStarted { request_id, tab_id, conversation_key }) => {
            Ok(S::Starting { request_id, tab_id, conversation_key })
        }
        (S::Idle, e) => Err(TransitionError::inapplicable("Idle", e.event_name())),

        // ── Starting ────────────────────────────────────────────────
        (S::Starting { request_id, tab_id, conversation_key }, E::SessionIdReceived { session_id }) => {
            Ok(S::SessionReceived { request_id, tab_id, conversation_key, session_id })
        }
        (S::Starting { .. }, E::ErrorOccurred { error_code, .. }) => {
            Ok(S::Error { error_code, last_good_seq: 0 })
        }
        (S::Starting { .. }, E::CancelRequested { source }) => {
            Ok(S::Cancelling { cancel_source: source, input_tokens: 0, output_tokens: 0 })
        }
        (S::Starting { .. }, e) => Err(TransitionError::inapplicable("Starting", e.event_name())),

        // ── SessionReceived ─────────────────────────────────────────
        (S::SessionReceived { request_id, .. }, E::MessageReceived { stream_seq, .. }) => {
            Ok(S::Streaming {
                request_id, stream_seq,
                input_tokens: 0, output_tokens: 0,
                pending_tools: Vec::new(), message_count: 1,
            })
        }
        (S::SessionReceived { .. }, E::CompleteReceived { total_messages }) => {
            Ok(S::Completing { total_messages, input_tokens: 0, output_tokens: 0, credits_charged: false })
        }
        (S::SessionReceived { .. }, E::ErrorOccurred { error_code, .. }) => {
            Ok(S::Error { error_code, last_good_seq: 0 })
        }
        (S::SessionReceived { .. }, E::CancelRequested { source }) => {
            Ok(S::Cancelling { cancel_source: source, input_tokens: 0, output_tokens: 0 })
        }
        (S::SessionReceived { .. }, e) => Err(TransitionError::inapplicable("SessionReceived", e.event_name())),

        // ── Streaming ───────────────────────────────────────────────
        (S::Streaming { request_id, input_tokens, output_tokens, pending_tools, message_count, .. },
         E::MessageReceived { stream_seq: new_seq, .. }) => {
            Ok(S::Streaming {
                request_id, stream_seq: new_seq,
                input_tokens, output_tokens, pending_tools,
                message_count: message_count + 1,
            })
        }
        (S::Streaming { request_id, stream_seq, input_tokens, output_tokens, mut pending_tools, message_count },
         E::ToolUseStarted { tool_use_id, .. }) => {
            if !pending_tools.contains(&tool_use_id) {
                pending_tools.push(tool_use_id);
            }
            Ok(S::Streaming { request_id, stream_seq, input_tokens, output_tokens, pending_tools, message_count })
        }
        (S::Streaming { request_id, stream_seq, input_tokens, output_tokens, mut pending_tools, message_count },
         E::ToolResultReceived { tool_use_id }) => {
            pending_tools.retain(|id| id != &tool_use_id);
            Ok(S::Streaming { request_id, stream_seq, input_tokens, output_tokens, pending_tools, message_count })
        }
        (S::Streaming { request_id, stream_seq, input_tokens, output_tokens, pending_tools, message_count },
         E::TokensAccumulated { input_tokens: new_in, output_tokens: new_out }) => {
            Ok(S::Streaming {
                request_id, stream_seq,
                input_tokens: input_tokens + new_in,
                output_tokens: output_tokens + new_out,
                pending_tools, message_count,
            })
        }
        (S::Streaming { input_tokens, output_tokens, message_count, .. },
         E::CompleteReceived { total_messages }) => {
            Ok(S::Completing {
                total_messages: total_messages.max(message_count),
                input_tokens, output_tokens, credits_charged: false,
            })
        }
        (S::Streaming { input_tokens, output_tokens, .. }, E::CancelRequested { source }) => {
            Ok(S::Cancelling { cancel_source: source, input_tokens, output_tokens })
        }
        (S::Streaming { stream_seq, .. }, E::ErrorOccurred { error_code, .. }) => {
            Ok(S::Error { error_code, last_good_seq: stream_seq })
        }
        (S::Streaming { request_id, stream_seq, input_tokens, output_tokens, pending_tools, message_count },
         E::ClientDisconnected) => {
            Ok(S::Buffering {
                request_id, stream_seq, input_tokens, output_tokens,
                pending_tools, message_count, buffer_message_count: 0,
            })
        }
        (s @ S::Streaming { .. }, E::PingReceived) => Ok(s),
        (S::Streaming { .. }, e) => Err(TransitionError::inapplicable("Streaming", e.event_name())),

        // ── Cancelling ──────────────────────────────────────────────
        (S::Cancelling { .. }, E::ReaderDone) => Ok(S::Done { outcome: Outcome::Cancelled }),
        (S::Cancelling { .. }, E::CleanupDone) => Ok(S::Done { outcome: Outcome::Cancelled }),
        (S::Cancelling { .. }, E::ErrorOccurred { .. }) => Ok(S::Done { outcome: Outcome::Errored }),
        (S::Cancelling { .. }, e) => Err(TransitionError::inapplicable("Cancelling", e.event_name())),

        // ── Completing ──────────────────────────────────────────────
        (S::Completing { total_messages, input_tokens, output_tokens, .. }, E::CreditsCharged) => {
            Ok(S::Completing { total_messages, input_tokens, output_tokens, credits_charged: true })
        }
        (S::Completing { .. }, E::CleanupDone) => Ok(S::Done { outcome: Outcome::Completed }),
        (S::Completing { .. }, E::ErrorOccurred { error_code, .. }) => {
            Ok(S::Error { error_code, last_good_seq: 0 })
        }
        (S::Completing { .. }, e) => Err(TransitionError::inapplicable("Completing", e.event_name())),

        // ── Done (terminal) ─────────────────────────────────────────
        (S::Done { .. }, e) => Err(TransitionError::terminal("Done", e.event_name())),

        // ── Error ───────────────────────────────────────────────────
        (S::Error { .. }, E::CleanupDone) => Ok(S::Done { outcome: Outcome::Errored }),
        (S::Error { .. }, e) => Err(TransitionError::inapplicable("Error", e.event_name())),

        // ── Buffering ───────────────────────────────────────────────
        (S::Buffering { request_id, input_tokens, output_tokens, pending_tools, message_count, buffer_message_count, .. },
         E::MessageReceived { stream_seq: new_seq, .. }) => {
            Ok(S::Buffering {
                request_id, stream_seq: new_seq,
                input_tokens, output_tokens, pending_tools,
                message_count: message_count + 1,
                buffer_message_count: buffer_message_count + 1,
            })
        }
        (S::Buffering { buffer_message_count, .. }, E::CompleteReceived { .. }) => {
            Ok(S::BufferedComplete { total_buffered: buffer_message_count })
        }
        (S::Buffering { request_id, stream_seq, input_tokens, output_tokens, pending_tools, message_count, .. },
         E::ClientReconnected) => {
            Ok(S::Streaming { request_id, stream_seq, input_tokens, output_tokens, pending_tools, message_count })
        }
        (S::Buffering { request_id, stream_seq, input_tokens, output_tokens, pending_tools, message_count, buffer_message_count },
         E::TokensAccumulated { input_tokens: new_in, output_tokens: new_out }) => {
            Ok(S::Buffering {
                request_id, stream_seq,
                input_tokens: input_tokens + new_in, output_tokens: output_tokens + new_out,
                pending_tools, message_count, buffer_message_count,
            })
        }
        (S::Buffering { .. }, E::CancelRequested { source }) => {
            Ok(S::Cancelling { cancel_source: source, input_tokens: 0, output_tokens: 0 })
        }
        (S::Buffering { .. }, E::BufferFull) => {
            Ok(S::Error { error_code: ErrorCode::BufferOverflow, last_good_seq: 0 })
        }
        (S::Buffering { .. }, E::StaleDetected { last_activity_at, detected_at }) => {
            Ok(S::Stale { last_activity_at, stale_detected_at: detected_at })
        }
        (S::Buffering { .. }, E::ErrorOccurred { error_code, .. }) => {
            Ok(S::Error { error_code, last_good_seq: 0 })
        }
        (S::Buffering { .. }, e) => Err(TransitionError::inapplicable("Buffering", e.event_name())),

        // ── BufferedComplete ────────────────────────────────────────
        (S::BufferedComplete { .. }, E::ClientReconnected) => Ok(S::Done { outcome: Outcome::Completed }),
        (S::BufferedComplete { .. }, e) => Err(TransitionError::inapplicable("BufferedComplete", e.event_name())),

        // ── Stale ───────────────────────────────────────────────────
        (S::Stale { .. }, E::ClientReconnected) => Ok(S::Done { outcome: Outcome::Completed }),
        (S::Stale { .. }, E::CleanupDone) => Ok(S::Done { outcome: Outcome::Completed }),
        (S::Stale { .. }, e) => Err(TransitionError::inapplicable("Stale", e.event_name())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn start_event() -> ServerEvent {
        ServerEvent::ChildProcessStarted {
            request_id: "req-1".into(), tab_id: "tab-1".into(), conversation_key: "key-1".into(),
        }
    }

    fn session_event() -> ServerEvent {
        ServerEvent::SessionIdReceived { session_id: "sess-1".into() }
    }

    fn msg_event(seq: u64) -> ServerEvent {
        ServerEvent::MessageReceived { stream_seq: seq, message_type: MessageType::Assistant }
    }

    fn to_streaming() -> ServerStreamState {
        let s = server_transition(ServerStreamState::Idle, start_event()).unwrap();
        let s = server_transition(s, session_event()).unwrap();
        server_transition(s, msg_event(1)).unwrap()
    }

    #[test]
    fn happy_path_full_lifecycle() {
        let s = to_streaming();
        let s = server_transition(s, msg_event(2)).unwrap();
        let s = server_transition(s, ServerEvent::TokensAccumulated { input_tokens: 500, output_tokens: 200 }).unwrap();
        let s = server_transition(s, ServerEvent::CompleteReceived { total_messages: 3 }).unwrap();
        assert_eq!(s.state_name(), "Completing");
        let s = server_transition(s, ServerEvent::CreditsCharged).unwrap();
        let s = server_transition(s, ServerEvent::CleanupDone).unwrap();
        assert!(matches!(s, ServerStreamState::Done { outcome: Outcome::Completed }));
    }

    #[test]
    fn cancel_during_streaming() {
        let s = to_streaming();
        let s = server_transition(s, ServerEvent::CancelRequested { source: CancelSource::HttpAbort }).unwrap();
        assert_eq!(s.state_name(), "Cancelling");
        let s = server_transition(s, ServerEvent::ReaderDone).unwrap();
        assert!(matches!(s, ServerStreamState::Done { outcome: Outcome::Cancelled }));
    }

    #[test]
    fn cancel_during_starting() {
        let s = server_transition(ServerStreamState::Idle, start_event()).unwrap();
        let s = server_transition(s, ServerEvent::CancelRequested { source: CancelSource::ClientCancel }).unwrap();
        assert_eq!(s.state_name(), "Cancelling");
    }

    #[test]
    fn cancel_plus_error() {
        let s = to_streaming();
        let s = server_transition(s, ServerEvent::CancelRequested { source: CancelSource::SharedIntent }).unwrap();
        let s = server_transition(s, ServerEvent::ErrorOccurred { error_code: ErrorCode::ProcessCrash, message: "boom".into() }).unwrap();
        assert!(matches!(s, ServerStreamState::Done { outcome: Outcome::Errored }));
    }

    #[test]
    fn error_during_starting() {
        let s = server_transition(ServerStreamState::Idle, start_event()).unwrap();
        let s = server_transition(s, ServerEvent::ErrorOccurred { error_code: ErrorCode::AuthFailure, message: "nope".into() }).unwrap();
        assert_eq!(s.state_name(), "Error");
    }

    #[test]
    fn error_during_streaming() {
        let s = to_streaming();
        let s = server_transition(s, ServerEvent::ErrorOccurred { error_code: ErrorCode::Timeout, message: "".into() }).unwrap();
        assert_eq!(s.state_name(), "Error");
        let s = server_transition(s, ServerEvent::CleanupDone).unwrap();
        assert!(matches!(s, ServerStreamState::Done { outcome: Outcome::Errored }));
    }

    #[test]
    fn completing_error() {
        let s = to_streaming();
        let s = server_transition(s, ServerEvent::CompleteReceived { total_messages: 1 }).unwrap();
        let s = server_transition(s, ServerEvent::ErrorOccurred { error_code: ErrorCode::SdkError, message: "".into() }).unwrap();
        assert_eq!(s.state_name(), "Error");
    }

    #[test]
    fn session_received_immediate_complete() {
        let s = server_transition(ServerStreamState::Idle, start_event()).unwrap();
        let s = server_transition(s, session_event()).unwrap();
        let s = server_transition(s, ServerEvent::CompleteReceived { total_messages: 0 }).unwrap();
        assert_eq!(s.state_name(), "Completing");
    }

    #[test]
    fn tool_tracking() {
        let s = to_streaming();
        let s = server_transition(s, ServerEvent::ToolUseStarted { tool_use_id: "t1".into(), tool_name: "Read".into() }).unwrap();
        if let ServerStreamState::Streaming { ref pending_tools, .. } = s {
            assert_eq!(pending_tools, &["t1"]);
        } else { panic!() }
        let s = server_transition(s, ServerEvent::ToolResultReceived { tool_use_id: "t1".into() }).unwrap();
        if let ServerStreamState::Streaming { ref pending_tools, .. } = s {
            assert!(pending_tools.is_empty());
        } else { panic!() }
    }

    #[test]
    fn token_accumulation() {
        let s = to_streaming();
        let s = server_transition(s, ServerEvent::TokensAccumulated { input_tokens: 100, output_tokens: 50 }).unwrap();
        let s = server_transition(s, ServerEvent::TokensAccumulated { input_tokens: 200, output_tokens: 100 }).unwrap();
        if let ServerStreamState::Streaming { input_tokens, output_tokens, .. } = s {
            assert_eq!(input_tokens, 300);
            assert_eq!(output_tokens, 150);
        } else { panic!() }
    }

    #[test]
    fn ping_during_streaming() {
        let s = to_streaming();
        let s = server_transition(s, ServerEvent::PingReceived).unwrap();
        assert_eq!(s.state_name(), "Streaming");
    }

    #[test]
    fn buffering_disconnect_reconnect() {
        let s = to_streaming();
        let s = server_transition(s, ServerEvent::ClientDisconnected).unwrap();
        assert_eq!(s.state_name(), "Buffering");
        let s = server_transition(s, msg_event(2)).unwrap();
        let s = server_transition(s, msg_event(3)).unwrap();
        if let ServerStreamState::Buffering { buffer_message_count, message_count, .. } = &s {
            assert_eq!(*buffer_message_count, 2);
            assert_eq!(*message_count, 3);
        } else { panic!() }
        let s = server_transition(s, ServerEvent::ClientReconnected).unwrap();
        assert_eq!(s.state_name(), "Streaming");
    }

    #[test]
    fn buffered_complete() {
        let s = to_streaming();
        let s = server_transition(s, ServerEvent::ClientDisconnected).unwrap();
        let s = server_transition(s, msg_event(2)).unwrap();
        let s = server_transition(s, ServerEvent::CompleteReceived { total_messages: 2 }).unwrap();
        assert_eq!(s.state_name(), "BufferedComplete");
        let s = server_transition(s, ServerEvent::ClientReconnected).unwrap();
        assert!(matches!(s, ServerStreamState::Done { outcome: Outcome::Completed }));
    }

    #[test]
    fn buffering_cancel() {
        let s = to_streaming();
        let s = server_transition(s, ServerEvent::ClientDisconnected).unwrap();
        let s = server_transition(s, ServerEvent::CancelRequested { source: CancelSource::SharedIntent }).unwrap();
        assert_eq!(s.state_name(), "Cancelling");
    }

    #[test]
    fn buffering_error() {
        let s = to_streaming();
        let s = server_transition(s, ServerEvent::ClientDisconnected).unwrap();
        let s = server_transition(s, ServerEvent::ErrorOccurred { error_code: ErrorCode::Unknown, message: "".into() }).unwrap();
        assert_eq!(s.state_name(), "Error");
    }

    #[test]
    fn buffering_tokens() {
        let s = to_streaming();
        let s = server_transition(s, ServerEvent::ClientDisconnected).unwrap();
        let s = server_transition(s, ServerEvent::TokensAccumulated { input_tokens: 50, output_tokens: 25 }).unwrap();
        if let ServerStreamState::Buffering { input_tokens, output_tokens, .. } = s {
            assert_eq!(input_tokens, 50);
            assert_eq!(output_tokens, 25);
        } else { panic!() }
    }

    #[test]
    fn buffer_overflow() {
        let s = to_streaming();
        let s = server_transition(s, ServerEvent::ClientDisconnected).unwrap();
        let s = server_transition(s, ServerEvent::BufferFull).unwrap();
        assert!(matches!(s, ServerStreamState::Error { error_code: ErrorCode::BufferOverflow, .. }));
    }

    #[test]
    fn stale_detection() {
        let s = to_streaming();
        let s = server_transition(s, ServerEvent::ClientDisconnected).unwrap();
        let s = server_transition(s, ServerEvent::StaleDetected { last_activity_at: 1000, detected_at: 60000 }).unwrap();
        assert_eq!(s.state_name(), "Stale");
    }

    #[test]
    fn stale_cleanup() {
        let s = to_streaming();
        let s = server_transition(s, ServerEvent::ClientDisconnected).unwrap();
        let s = server_transition(s, ServerEvent::StaleDetected { last_activity_at: 1000, detected_at: 60000 }).unwrap();
        let s = server_transition(s, ServerEvent::ClientReconnected).unwrap();
        assert!(matches!(s, ServerStreamState::Done { outcome: Outcome::Completed }));
    }

    #[test]
    fn idle_rejects_non_start_events() {
        assert!(server_transition(ServerStreamState::Idle, ServerEvent::PingReceived).is_err());
        assert!(server_transition(ServerStreamState::Idle, ServerEvent::CleanupDone).is_err());
    }

    #[test]
    fn done_rejects_all_events() {
        let done = ServerStreamState::Done { outcome: Outcome::Completed };
        assert!(server_transition(done.clone(), start_event()).is_err());
        assert!(server_transition(done.clone(), ServerEvent::PingReceived).is_err());
        let err = server_transition(done, ServerEvent::CleanupDone).unwrap_err();
        assert!(err.reason.contains("terminal"));
    }
}
