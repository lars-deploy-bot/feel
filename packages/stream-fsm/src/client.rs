use serde::{Deserialize, Serialize};
use tsify_next::Tsify;

use crate::types::{
    CancelEndpointStatus, ErrorCode, PendingTool, ReconnectStreamState, StreamEventType,
    TransitionError, VerificationStatus,
};

// ---------------------------------------------------------------------------
// Client State
// ---------------------------------------------------------------------------

/// Client-side stream state machine (per-tab UI lifecycle).
///
/// Each variant carries exactly the data valid for that state.
/// Only `client_transition()` can produce new states.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub enum ClientStreamState {
    Idle {
        last_request_id: Option<String>,
    },

    Submitting {
        request_id: String,
    },

    Streaming {
        request_id: String,
        last_seen_seq: u64,
        message_count: u64,
        pending_tools: Vec<PendingTool>,
    },

    Stopping {
        stop_id: String,
        request_id_at_stop: String,
        abort_sent: bool,
    },

    Verifying {
        stop_id: String,
        request_id_at_stop: String,
        attempts: u32,
        max_attempts: u32,
    },

    StillRunning {
        active_request_id: String,
        stop_id: String,
    },

    Reconnecting {
        tab_id: String,
        last_known_seq: u64,
    },

    ReconnectPolling {
        request_id: String,
        poll_count: u32,
        max_polls: u32,
    },

    Disconnected {
        last_request_id: String,
        last_seen_seq: u64,
        disconnected_at: u64,
    },

    Error {
        error_type: ErrorCode,
        recoverable: bool,
    },
}

impl ClientStreamState {
    pub fn state_name(&self) -> &'static str {
        match self {
            Self::Idle { .. } => "Idle",
            Self::Submitting { .. } => "Submitting",
            Self::Streaming { .. } => "Streaming",
            Self::Stopping { .. } => "Stopping",
            Self::Verifying { .. } => "Verifying",
            Self::StillRunning { .. } => "StillRunning",
            Self::Reconnecting { .. } => "Reconnecting",
            Self::ReconnectPolling { .. } => "ReconnectPolling",
            Self::Disconnected { .. } => "Disconnected",
            Self::Error { .. } => "Error",
        }
    }

    pub fn is_active(&self) -> bool {
        !matches!(self, Self::Idle { .. } | Self::Error { .. })
    }
}

// ---------------------------------------------------------------------------
// Client Events
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub enum ClientEvent {
    UserSendsMessage { request_id: String },
    FetchResponseReceived,
    StreamEventReceived { seq: u64, event_type: StreamEventType },
    StreamCompleted { total_messages: u64 },
    StreamErrorReceived { error_code: ErrorCode },
    UserPressesStop { stop_id: String },
    AbortSent,
    CancelEndpointResponded { status: CancelEndpointStatus },
    CancelTimedOut,
    VerificationResult { status: VerificationStatus, active_request_id: Option<String> },
    TabHidden,
    TabVisible { tab_id: String },
    PageRefreshed { tab_id: String },
    NetworkLost { timestamp: u64 },
    NetworkRestored { tab_id: String },
    ReconnectProbeResult { has_stream: bool, state: Option<ReconnectStreamState>, request_id: Option<String>, messages_count: u64 },
    PollResult { has_stream: bool, state: Option<ReconnectStreamState>, new_messages: u64 },
    PollMaxReached,
    HeartbeatTimeout { timestamp: u64 },
    ToolUseStarted { tool_use_id: String, tool_name: String },
    ToolResultReceived { tool_use_id: String },
}

impl ClientEvent {
    pub fn event_name(&self) -> &'static str {
        match self {
            Self::UserSendsMessage { .. } => "UserSendsMessage",
            Self::FetchResponseReceived => "FetchResponseReceived",
            Self::StreamEventReceived { .. } => "StreamEventReceived",
            Self::StreamCompleted { .. } => "StreamCompleted",
            Self::StreamErrorReceived { .. } => "StreamErrorReceived",
            Self::UserPressesStop { .. } => "UserPressesStop",
            Self::AbortSent => "AbortSent",
            Self::CancelEndpointResponded { .. } => "CancelEndpointResponded",
            Self::CancelTimedOut => "CancelTimedOut",
            Self::VerificationResult { .. } => "VerificationResult",
            Self::TabHidden => "TabHidden",
            Self::TabVisible { .. } => "TabVisible",
            Self::PageRefreshed { .. } => "PageRefreshed",
            Self::NetworkLost { .. } => "NetworkLost",
            Self::NetworkRestored { .. } => "NetworkRestored",
            Self::ReconnectProbeResult { .. } => "ReconnectProbeResult",
            Self::PollResult { .. } => "PollResult",
            Self::PollMaxReached => "PollMaxReached",
            Self::HeartbeatTimeout { .. } => "HeartbeatTimeout",
            Self::ToolUseStarted { .. } => "ToolUseStarted",
            Self::ToolResultReceived { .. } => "ToolResultReceived",
        }
    }
}

// ---------------------------------------------------------------------------
// Client Transition
// ---------------------------------------------------------------------------

pub fn client_transition(
    state: ClientStreamState,
    event: ClientEvent,
) -> Result<ClientStreamState, TransitionError> {
    use ClientEvent as E;
    use ClientStreamState as S;

    match (state, event) {
        // ── Idle ────────────────────────────────────────────────────
        (S::Idle { .. }, E::UserSendsMessage { request_id }) => Ok(S::Submitting { request_id }),
        (S::Idle { .. }, E::TabVisible { tab_id }) => Ok(S::Reconnecting { tab_id, last_known_seq: 0 }),
        (S::Idle { .. }, E::PageRefreshed { tab_id }) => Ok(S::Reconnecting { tab_id, last_known_seq: 0 }),
        (s @ S::Idle { .. }, E::TabHidden) => Ok(s),
        (S::Idle { .. }, e) => Err(TransitionError::inapplicable("Idle", e.event_name())),

        // ── Submitting ──────────────────────────────────────────────
        (S::Submitting { request_id }, E::FetchResponseReceived) => {
            Ok(S::Streaming { request_id, last_seen_seq: 0, message_count: 0, pending_tools: Vec::new() })
        }
        (S::Submitting { .. }, E::StreamErrorReceived { error_code }) => {
            Ok(S::Error { error_type: error_code, recoverable: true })
        }
        (S::Submitting { request_id }, E::UserPressesStop { stop_id }) => {
            Ok(S::Stopping { stop_id, request_id_at_stop: request_id, abort_sent: false })
        }
        (S::Submitting { request_id }, E::NetworkLost { timestamp }) => {
            Ok(S::Disconnected { last_request_id: request_id, last_seen_seq: 0, disconnected_at: timestamp })
        }
        (S::Submitting { .. }, e) => Err(TransitionError::inapplicable("Submitting", e.event_name())),

        // ── Streaming ───────────────────────────────────────────────
        (S::Streaming { request_id, message_count, pending_tools, .. },
         E::StreamEventReceived { seq, .. }) => {
            Ok(S::Streaming { request_id, last_seen_seq: seq, message_count: message_count + 1, pending_tools })
        }
        (S::Streaming { request_id, .. }, E::StreamCompleted { .. }) => {
            Ok(S::Idle { last_request_id: Some(request_id) })
        }
        (S::Streaming { .. }, E::StreamErrorReceived { error_code }) => {
            Ok(S::Error { error_type: error_code, recoverable: true })
        }
        (S::Streaming { request_id, .. }, E::UserPressesStop { stop_id }) => {
            Ok(S::Stopping { stop_id, request_id_at_stop: request_id, abort_sent: false })
        }
        (s @ S::Streaming { .. }, E::TabHidden) => Ok(s),
        (S::Streaming { request_id, last_seen_seq, .. }, E::NetworkLost { timestamp }) => {
            Ok(S::Disconnected { last_request_id: request_id, last_seen_seq, disconnected_at: timestamp })
        }
        (S::Streaming { request_id, last_seen_seq, .. }, E::HeartbeatTimeout { timestamp }) => {
            Ok(S::Disconnected { last_request_id: request_id, last_seen_seq, disconnected_at: timestamp })
        }
        (S::Streaming { request_id, last_seen_seq, message_count, mut pending_tools },
         E::ToolUseStarted { tool_use_id, tool_name }) => {
            pending_tools.push(PendingTool { tool_use_id, tool_name });
            Ok(S::Streaming { request_id, last_seen_seq, message_count, pending_tools })
        }
        (S::Streaming { request_id, last_seen_seq, message_count, mut pending_tools },
         E::ToolResultReceived { tool_use_id }) => {
            pending_tools.retain(|t| t.tool_use_id != tool_use_id);
            Ok(S::Streaming { request_id, last_seen_seq, message_count, pending_tools })
        }
        (S::Streaming { .. }, e) => Err(TransitionError::inapplicable("Streaming", e.event_name())),

        // ── Stopping ────────────────────────────────────────────────
        (S::Stopping { stop_id, request_id_at_stop, .. }, E::AbortSent) => {
            Ok(S::Stopping { stop_id, request_id_at_stop, abort_sent: true })
        }
        (S::Stopping { .. }, E::CancelEndpointResponded { status: CancelEndpointStatus::Cancelled }) => {
            Ok(S::Idle { last_request_id: None })
        }
        (S::Stopping { .. }, E::CancelEndpointResponded { status: CancelEndpointStatus::AlreadyComplete }) => {
            Ok(S::Idle { last_request_id: None })
        }
        (S::Stopping { stop_id, request_id_at_stop, .. }, E::CancelEndpointResponded { status: CancelEndpointStatus::NotFound | CancelEndpointStatus::Error }) => {
            Ok(S::Verifying { stop_id, request_id_at_stop, attempts: 0, max_attempts: 3 })
        }
        (S::Stopping { stop_id, request_id_at_stop, .. }, E::CancelTimedOut) => {
            Ok(S::Verifying { stop_id, request_id_at_stop, attempts: 0, max_attempts: 3 })
        }
        (S::Stopping { request_id_at_stop, .. }, E::StreamCompleted { .. }) => {
            Ok(S::Idle { last_request_id: Some(request_id_at_stop) })
        }
        (S::Stopping { request_id_at_stop, .. }, E::NetworkLost { timestamp }) => {
            Ok(S::Disconnected { last_request_id: request_id_at_stop, last_seen_seq: 0, disconnected_at: timestamp })
        }
        (S::Stopping { .. }, E::StreamErrorReceived { error_code }) => {
            Ok(S::Error { error_type: error_code, recoverable: true })
        }
        (S::Stopping { .. }, e) => Err(TransitionError::inapplicable("Stopping", e.event_name())),

        // ── Verifying ───────────────────────────────────────────────
        (S::Verifying { .. }, E::VerificationResult { status: VerificationStatus::Confirmed, .. }) => {
            Ok(S::Idle { last_request_id: None })
        }
        (S::Verifying { stop_id, request_id_at_stop, .. },
         E::VerificationResult { status: VerificationStatus::StillStreaming, active_request_id }) => {
            Ok(S::StillRunning {
                active_request_id: active_request_id.unwrap_or(request_id_at_stop),
                stop_id,
            })
        }
        (S::Verifying { .. }, E::VerificationResult { status: VerificationStatus::Unknown, .. }) => {
            Ok(S::Idle { last_request_id: None })
        }
        (S::Verifying { .. }, E::StreamCompleted { .. }) => Ok(S::Idle { last_request_id: None }),
        (S::Verifying { request_id_at_stop, .. }, E::NetworkLost { timestamp }) => {
            Ok(S::Disconnected { last_request_id: request_id_at_stop, last_seen_seq: 0, disconnected_at: timestamp })
        }
        (S::Verifying { .. }, e) => Err(TransitionError::inapplicable("Verifying", e.event_name())),

        // ── StillRunning ────────────────────────────────────────────
        (S::StillRunning { active_request_id, .. }, E::UserPressesStop { stop_id }) => {
            Ok(S::Stopping { stop_id, request_id_at_stop: active_request_id, abort_sent: false })
        }
        (S::StillRunning { active_request_id, .. }, E::StreamCompleted { .. }) => {
            Ok(S::Idle { last_request_id: Some(active_request_id) })
        }
        (S::StillRunning { active_request_id, .. }, E::NetworkLost { timestamp }) => {
            Ok(S::Disconnected { last_request_id: active_request_id, last_seen_seq: 0, disconnected_at: timestamp })
        }
        (S::StillRunning { .. }, e) => Err(TransitionError::inapplicable("StillRunning", e.event_name())),

        // ── Reconnecting ────────────────────────────────────────────
        (S::Reconnecting { .. }, E::ReconnectProbeResult { has_stream: false, .. }) => {
            Ok(S::Idle { last_request_id: None })
        }
        (S::Reconnecting { .. }, E::ReconnectProbeResult { has_stream: true, state: Some(ReconnectStreamState::Complete), .. }) => {
            Ok(S::Idle { last_request_id: None })
        }
        (S::Reconnecting { .. }, E::ReconnectProbeResult { has_stream: true, state: Some(ReconnectStreamState::Streaming), request_id, .. }) => {
            Ok(S::ReconnectPolling { request_id: request_id.unwrap_or_default(), poll_count: 0, max_polls: 20 })
        }
        (S::Reconnecting { .. }, E::ReconnectProbeResult { has_stream: true, state: None, .. }) => {
            Ok(S::Idle { last_request_id: None })
        }
        (S::Reconnecting { .. }, E::NetworkLost { timestamp }) => {
            Ok(S::Disconnected { last_request_id: String::new(), last_seen_seq: 0, disconnected_at: timestamp })
        }
        (S::Reconnecting { .. }, e) => Err(TransitionError::inapplicable("Reconnecting", e.event_name())),

        // ── ReconnectPolling ────────────────────────────────────────
        (S::ReconnectPolling { .. }, E::PollResult { state: Some(ReconnectStreamState::Complete), .. }) => {
            Ok(S::Idle { last_request_id: None })
        }
        (S::ReconnectPolling { request_id, poll_count, max_polls },
         E::PollResult { state: Some(ReconnectStreamState::Streaming), .. }) => {
            Ok(S::ReconnectPolling { request_id, poll_count: poll_count + 1, max_polls })
        }
        (S::ReconnectPolling { .. }, E::PollResult { .. }) => Ok(S::Idle { last_request_id: None }),
        (S::ReconnectPolling { .. }, E::PollMaxReached) => Ok(S::Idle { last_request_id: None }),
        (S::ReconnectPolling { .. }, E::TabHidden) => Ok(S::Idle { last_request_id: None }),
        (S::ReconnectPolling { request_id, .. }, E::UserPressesStop { stop_id }) => {
            Ok(S::Stopping { stop_id, request_id_at_stop: request_id, abort_sent: false })
        }
        (S::ReconnectPolling { .. }, E::StreamCompleted { .. }) => Ok(S::Idle { last_request_id: None }),
        (S::ReconnectPolling { .. }, E::NetworkLost { timestamp }) => {
            Ok(S::Disconnected { last_request_id: String::new(), last_seen_seq: 0, disconnected_at: timestamp })
        }
        (S::ReconnectPolling { .. }, e) => Err(TransitionError::inapplicable("ReconnectPolling", e.event_name())),

        // ── Disconnected ────────────────────────────────────────────
        (S::Disconnected { last_seen_seq, .. }, E::NetworkRestored { tab_id }) => {
            Ok(S::Reconnecting { tab_id, last_known_seq: last_seen_seq })
        }
        (S::Disconnected { .. }, E::UserPressesStop { .. }) => Ok(S::Idle { last_request_id: None }),
        (S::Disconnected { .. }, e) => Err(TransitionError::inapplicable("Disconnected", e.event_name())),

        // ── Error ───────────────────────────────────────────────────
        (S::Error { .. }, E::UserSendsMessage { request_id }) => Ok(S::Submitting { request_id }),
        (S::Error { .. }, E::TabVisible { tab_id }) => Ok(S::Reconnecting { tab_id, last_known_seq: 0 }),
        (S::Error { .. }, E::PageRefreshed { tab_id }) => Ok(S::Reconnecting { tab_id, last_known_seq: 0 }),
        (S::Error { .. }, e) => Err(TransitionError::inapplicable("Error", e.event_name())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn idle() -> ClientStreamState {
        ClientStreamState::Idle { last_request_id: None }
    }

    fn to_streaming() -> ClientStreamState {
        let s = client_transition(idle(), ClientEvent::UserSendsMessage { request_id: "r1".into() }).unwrap();
        client_transition(s, ClientEvent::FetchResponseReceived).unwrap()
    }

    #[test]
    fn happy_path_full_lifecycle() {
        let s = to_streaming();
        let s = client_transition(s, ClientEvent::StreamEventReceived { seq: 1, event_type: StreamEventType::Message }).unwrap();
        let s = client_transition(s, ClientEvent::StreamEventReceived { seq: 2, event_type: StreamEventType::Message }).unwrap();
        let s = client_transition(s, ClientEvent::StreamCompleted { total_messages: 2 }).unwrap();
        assert_eq!(s.state_name(), "Idle");
        if let ClientStreamState::Idle { last_request_id } = &s {
            assert_eq!(last_request_id.as_deref(), Some("r1"));
        }
    }

    #[test]
    fn stop_during_streaming_confirmed() {
        let s = to_streaming();
        let s = client_transition(s, ClientEvent::UserPressesStop { stop_id: "s1".into() }).unwrap();
        let s = client_transition(s, ClientEvent::AbortSent).unwrap();
        if let ClientStreamState::Stopping { abort_sent, .. } = &s { assert!(*abort_sent); }
        let s = client_transition(s, ClientEvent::CancelEndpointResponded { status: CancelEndpointStatus::Cancelled }).unwrap();
        assert_eq!(s.state_name(), "Idle");
    }

    #[test]
    fn stop_verify_still_running_with_request_id() {
        let s = to_streaming();
        let s = client_transition(s, ClientEvent::UserPressesStop { stop_id: "s1".into() }).unwrap();
        let s = client_transition(s, ClientEvent::CancelEndpointResponded { status: CancelEndpointStatus::Error }).unwrap();
        let s = client_transition(s, ClientEvent::VerificationResult {
            status: VerificationStatus::StillStreaming, active_request_id: Some("r-new".into()),
        }).unwrap();
        if let ClientStreamState::StillRunning { active_request_id, .. } = &s {
            assert_eq!(active_request_id, "r-new");
        }
    }

    #[test]
    fn stop_verify_still_running_falls_back() {
        let s = to_streaming();
        let s = client_transition(s, ClientEvent::UserPressesStop { stop_id: "s1".into() }).unwrap();
        let s = client_transition(s, ClientEvent::CancelTimedOut).unwrap();
        let s = client_transition(s, ClientEvent::VerificationResult {
            status: VerificationStatus::StillStreaming, active_request_id: None,
        }).unwrap();
        if let ClientStreamState::StillRunning { active_request_id, .. } = &s {
            assert_eq!(active_request_id, "r1");
        }
    }

    #[test]
    fn heartbeat_timeout_carries_timestamp() {
        let s = to_streaming();
        let s = client_transition(s, ClientEvent::HeartbeatTimeout { timestamp: 42 }).unwrap();
        if let ClientStreamState::Disconnected { disconnected_at, .. } = &s {
            assert_eq!(*disconnected_at, 42);
        }
    }

    #[test]
    fn network_restored_carries_tab_id() {
        let s = to_streaming();
        let s = client_transition(s, ClientEvent::NetworkLost { timestamp: 1000 }).unwrap();
        let s = client_transition(s, ClientEvent::NetworkRestored { tab_id: "t1".into() }).unwrap();
        if let ClientStreamState::Reconnecting { tab_id, last_known_seq } = &s {
            assert_eq!(tab_id, "t1");
            assert_eq!(*last_known_seq, 0);
        }
    }

    #[test]
    fn reconnect_probe_carries_request_id() {
        let s = client_transition(idle(), ClientEvent::TabVisible { tab_id: "t1".into() }).unwrap();
        let s = client_transition(s, ClientEvent::ReconnectProbeResult {
            has_stream: true, state: Some(ReconnectStreamState::Streaming),
            request_id: Some("r-active".into()), messages_count: 3,
        }).unwrap();
        if let ClientStreamState::ReconnectPolling { request_id, .. } = &s {
            assert_eq!(request_id, "r-active");
        }
    }

    #[test]
    fn verifying_network_loss_preserves_request_id() {
        let s = to_streaming();
        let s = client_transition(s, ClientEvent::UserPressesStop { stop_id: "s1".into() }).unwrap();
        let s = client_transition(s, ClientEvent::CancelTimedOut).unwrap();
        let s = client_transition(s, ClientEvent::NetworkLost { timestamp: 999 }).unwrap();
        if let ClientStreamState::Disconnected { last_request_id, .. } = &s {
            assert_eq!(last_request_id, "r1");
        }
    }

    #[test]
    fn double_stop_rejected() {
        let s = to_streaming();
        let s = client_transition(s, ClientEvent::UserPressesStop { stop_id: "s1".into() }).unwrap();
        assert!(client_transition(s, ClientEvent::UserPressesStop { stop_id: "s2".into() }).is_err());
    }

    #[test]
    fn idle_rejects_invalid_events() {
        assert!(client_transition(idle(), ClientEvent::FetchResponseReceived).is_err());
        assert!(client_transition(idle(), ClientEvent::AbortSent).is_err());
    }

    #[test]
    fn streaming_tab_hidden_noop() {
        let s = to_streaming();
        let s = client_transition(s, ClientEvent::TabHidden).unwrap();
        assert_eq!(s.state_name(), "Streaming");
    }

    #[test]
    fn tool_tracking() {
        let s = to_streaming();
        let s = client_transition(s, ClientEvent::ToolUseStarted { tool_use_id: "t1".into(), tool_name: "Read".into() }).unwrap();
        let s = client_transition(s, ClientEvent::ToolUseStarted { tool_use_id: "t2".into(), tool_name: "Write".into() }).unwrap();
        if let ClientStreamState::Streaming { ref pending_tools, .. } = s {
            assert_eq!(pending_tools.len(), 2);
        }
        let s = client_transition(s, ClientEvent::ToolResultReceived { tool_use_id: "t1".into() }).unwrap();
        if let ClientStreamState::Streaming { ref pending_tools, .. } = s {
            assert_eq!(pending_tools.len(), 1);
            assert_eq!(pending_tools[0].tool_use_id, "t2");
        }
    }

    #[test]
    fn error_retry() {
        let s = ClientStreamState::Error { error_type: ErrorCode::SdkError, recoverable: true };
        let s = client_transition(s, ClientEvent::UserSendsMessage { request_id: "r2".into() }).unwrap();
        assert_eq!(s.state_name(), "Submitting");
    }

    #[test]
    fn disconnected_user_gives_up() {
        let s = ClientStreamState::Disconnected { last_request_id: "r1".into(), last_seen_seq: 5, disconnected_at: 1000 };
        let s = client_transition(s, ClientEvent::UserPressesStop { stop_id: "s1".into() }).unwrap();
        assert_eq!(s.state_name(), "Idle");
    }

    #[test]
    fn reconnect_poll_max_reached() {
        let s = ClientStreamState::ReconnectPolling { request_id: "r1".into(), poll_count: 19, max_polls: 20 };
        let s = client_transition(s, ClientEvent::PollMaxReached).unwrap();
        assert_eq!(s.state_name(), "Idle");
    }

    #[test]
    fn still_running_completes() {
        let s = ClientStreamState::StillRunning { active_request_id: "r1".into(), stop_id: "s1".into() };
        let s = client_transition(s, ClientEvent::StreamCompleted { total_messages: 10 }).unwrap();
        assert_eq!(s.state_name(), "Idle");
    }
}
