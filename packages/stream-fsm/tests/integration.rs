use stream_fsm::client::{client_transition, ClientEvent, ClientStreamState};
use stream_fsm::server::{server_transition, ServerEvent, ServerStreamState};
use stream_fsm::types::*;

fn server_to_streaming() -> ServerStreamState {
    let s = server_transition(
        ServerStreamState::Idle,
        ServerEvent::ChildProcessStarted { request_id: "r1".into(), tab_id: "t1".into(), conversation_key: "k1".into() },
    ).unwrap();
    let s = server_transition(s, ServerEvent::SessionIdReceived { session_id: "s1".into() }).unwrap();
    server_transition(s, ServerEvent::MessageReceived { stream_seq: 1, message_type: MessageType::Assistant }).unwrap()
}

fn client_idle() -> ClientStreamState {
    ClientStreamState::Idle { last_request_id: None }
}

fn client_to_streaming() -> ClientStreamState {
    let s = client_transition(client_idle(), ClientEvent::UserSendsMessage { request_id: "r1".into() }).unwrap();
    client_transition(s, ClientEvent::FetchResponseReceived).unwrap()
}

#[test]
fn server_full_happy_path() {
    let s = server_to_streaming();
    let s = server_transition(s, ServerEvent::TokensAccumulated { input_tokens: 500, output_tokens: 200 }).unwrap();
    let s = server_transition(s, ServerEvent::CompleteReceived { total_messages: 2 }).unwrap();
    let s = server_transition(s, ServerEvent::CreditsCharged).unwrap();
    let s = server_transition(s, ServerEvent::CleanupDone).unwrap();
    assert!(matches!(s, ServerStreamState::Done { outcome: Outcome::Completed, input_tokens: 500, output_tokens: 200 }));
}

#[test]
fn server_cancel_preserves_tokens() {
    let s = server_to_streaming();
    let s = server_transition(s, ServerEvent::TokensAccumulated { input_tokens: 300, output_tokens: 100 }).unwrap();
    let s = server_transition(s, ServerEvent::CancelRequested { source: CancelSource::HttpAbort }).unwrap();
    let s = server_transition(s, ServerEvent::ReaderDone).unwrap();
    assert!(matches!(s, ServerStreamState::Done { outcome: Outcome::Cancelled, input_tokens: 300, output_tokens: 100 }));
}

#[test]
fn server_buffering_reconnect() {
    let s = server_to_streaming();
    let s = server_transition(s, ServerEvent::ClientDisconnected).unwrap();
    let s = server_transition(s, ServerEvent::MessageReceived { stream_seq: 2, message_type: MessageType::Assistant }).unwrap();
    let s = server_transition(s, ServerEvent::ClientReconnected).unwrap();
    assert_eq!(s.state_name(), "Streaming");
}

#[test]
fn server_stale_then_reconnect() {
    let s = server_to_streaming();
    let s = server_transition(s, ServerEvent::ClientDisconnected).unwrap();
    let s = server_transition(s, ServerEvent::StaleDetected { last_activity_at: 1000, detected_at: 60000 }).unwrap();
    let s = server_transition(s, ServerEvent::ClientReconnected).unwrap();
    assert!(matches!(s, ServerStreamState::Done { outcome: Outcome::Completed, .. }));
}

#[test]
fn server_terminal_rejects() {
    let done = ServerStreamState::Done { outcome: Outcome::Completed, input_tokens: 0, output_tokens: 0 };
    let err = server_transition(done, ServerEvent::CleanupDone).unwrap_err();
    assert!(err.reason.contains("terminal"));
}

#[test]
fn server_cancel_then_error() {
    let s = server_to_streaming();
    let s = server_transition(s, ServerEvent::CancelRequested { source: CancelSource::SharedIntent }).unwrap();
    let s = server_transition(s, ServerEvent::ErrorOccurred { error_code: ErrorCode::ProcessCrash, message: "crash".into() }).unwrap();
    assert!(matches!(s, ServerStreamState::Done { outcome: Outcome::Errored, .. }));
}

#[test]
fn server_buffered_complete() {
    let s = server_to_streaming();
    let s = server_transition(s, ServerEvent::ClientDisconnected).unwrap();
    let s = server_transition(s, ServerEvent::CompleteReceived { total_messages: 1 }).unwrap();
    let s = server_transition(s, ServerEvent::ClientReconnected).unwrap();
    assert!(matches!(s, ServerStreamState::Done { outcome: Outcome::Completed, .. }));
}

#[test]
fn client_full_happy_path() {
    let s = client_to_streaming();
    let s = client_transition(s, ClientEvent::StreamEventReceived { seq: 1, event_type: StreamEventType::Message }).unwrap();
    let s = client_transition(s, ClientEvent::StreamCompleted { total_messages: 1 }).unwrap();
    assert_eq!(s.state_name(), "Idle");
    if let ClientStreamState::Idle { last_request_id } = &s {
        assert_eq!(last_request_id.as_deref(), Some("r1"));
    }
}

#[test]
fn client_network_loss_reconnect_poll() {
    let s = client_to_streaming();
    let s = client_transition(s, ClientEvent::StreamEventReceived { seq: 5, event_type: StreamEventType::Message }).unwrap();
    let s = client_transition(s, ClientEvent::NetworkLost { timestamp: 1000 }).unwrap();
    let s = client_transition(s, ClientEvent::NetworkRestored { tab_id: "t1".into() }).unwrap();
    let s = client_transition(s, ClientEvent::ReconnectProbeResult {
        has_stream: true, state: Some(ReconnectStreamState::Streaming), request_id: Some("r1".into()), messages_count: 8,
    }).unwrap();
    assert_eq!(s.state_name(), "ReconnectPolling");
    let s = client_transition(s, ClientEvent::PollResult {
        has_stream: true, state: Some(ReconnectStreamState::Complete), new_messages: 0,
    }).unwrap();
    assert_eq!(s.state_name(), "Idle");
}

#[test]
fn client_stop_verify_retry() {
    let s = client_to_streaming();
    let s = client_transition(s, ClientEvent::UserPressesStop { stop_id: "s1".into() }).unwrap();
    let s = client_transition(s, ClientEvent::CancelEndpointResponded { status: CancelEndpointStatus::Error }).unwrap();
    let s = client_transition(s, ClientEvent::VerificationResult {
        status: VerificationStatus::StillStreaming, active_request_id: Some("r-new".into()),
    }).unwrap();
    assert_eq!(s.state_name(), "StillRunning");
    if let ClientStreamState::StillRunning { active_request_id, .. } = &s {
        assert_eq!(active_request_id, "r-new");
    }
    let s = client_transition(s, ClientEvent::UserPressesStop { stop_id: "s2".into() }).unwrap();
    assert_eq!(s.state_name(), "Stopping");
}

#[test]
fn client_cancel_after_complete() {
    let s = client_to_streaming();
    let s = client_transition(s, ClientEvent::UserPressesStop { stop_id: "s1".into() }).unwrap();
    let s = client_transition(s, ClientEvent::StreamCompleted { total_messages: 5 }).unwrap();
    assert_eq!(s.state_name(), "Idle");
}

#[test]
fn client_double_stop_rejected() {
    let s = client_to_streaming();
    let s = client_transition(s, ClientEvent::UserPressesStop { stop_id: "s1".into() }).unwrap();
    assert!(client_transition(s, ClientEvent::UserPressesStop { stop_id: "s2".into() }).is_err());
}

#[test]
fn client_heartbeat_timeout() {
    let s = client_to_streaming();
    let s = client_transition(s, ClientEvent::HeartbeatTimeout { timestamp: 42 }).unwrap();
    if let ClientStreamState::Disconnected { disconnected_at, .. } = &s {
        assert_eq!(*disconnected_at, 42);
    }
}

#[test]
fn client_reconnect_no_stream() {
    let s = client_transition(client_idle(), ClientEvent::TabVisible { tab_id: "t1".into() }).unwrap();
    let s = client_transition(s, ClientEvent::ReconnectProbeResult {
        has_stream: false, state: None, request_id: None, messages_count: 0,
    }).unwrap();
    assert_eq!(s.state_name(), "Idle");
}

#[test]
fn client_error_recovery() {
    let s = ClientStreamState::Error { error_type: ErrorCode::SdkError, recoverable: true };
    let s = client_transition(s, ClientEvent::UserSendsMessage { request_id: "r2".into() }).unwrap();
    assert_eq!(s.state_name(), "Submitting");
}

#[test]
fn client_tool_tracking() {
    let s = client_to_streaming();
    let s = client_transition(s, ClientEvent::ToolUseStarted { tool_use_id: "t1".into(), tool_name: "Read".into() }).unwrap();
    let s = client_transition(s, ClientEvent::ToolResultReceived { tool_use_id: "t1".into() }).unwrap();
    if let ClientStreamState::Streaming { ref pending_tools, .. } = s {
        assert!(pending_tools.is_empty());
    }
}

#[test]
fn full_lifecycle_both_machines() {
    let c = client_transition(client_idle(), ClientEvent::UserSendsMessage { request_id: "r1".into() }).unwrap();
    let s = server_transition(
        ServerStreamState::Idle,
        ServerEvent::ChildProcessStarted { request_id: "r1".into(), tab_id: "t1".into(), conversation_key: "k1".into() },
    ).unwrap();
    let s = server_transition(s, ServerEvent::SessionIdReceived { session_id: "sess-1".into() }).unwrap();
    let c = client_transition(c, ClientEvent::FetchResponseReceived).unwrap();
    let s = server_transition(s, ServerEvent::MessageReceived { stream_seq: 1, message_type: MessageType::Assistant }).unwrap();
    let c = client_transition(c, ClientEvent::StreamEventReceived { seq: 1, event_type: StreamEventType::Message }).unwrap();
    let s = server_transition(s, ServerEvent::CompleteReceived { total_messages: 1 }).unwrap();
    let s = server_transition(s, ServerEvent::CreditsCharged).unwrap();
    let s = server_transition(s, ServerEvent::CleanupDone).unwrap();
    let c = client_transition(c, ClientEvent::StreamCompleted { total_messages: 1 }).unwrap();
    assert!(s.is_terminal());
    assert!(!c.is_active());
}

#[test]
fn cancel_from_both_perspectives() {
    let c = client_to_streaming();
    let s = server_to_streaming();
    let c = client_transition(c, ClientEvent::UserPressesStop { stop_id: "s1".into() }).unwrap();
    let s = server_transition(s, ServerEvent::CancelRequested { source: CancelSource::ClientCancel }).unwrap();
    let s = server_transition(s, ServerEvent::ReaderDone).unwrap();
    let c = client_transition(c, ClientEvent::CancelEndpointResponded { status: CancelEndpointStatus::Cancelled }).unwrap();
    assert!(matches!(s, ServerStreamState::Done { outcome: Outcome::Cancelled, .. }));
    assert_eq!(c.state_name(), "Idle");
}

#[test]
fn disconnect_reconnect_both_perspectives() {
    let c = client_to_streaming();
    let s = server_to_streaming();
    let c = client_transition(c, ClientEvent::NetworkLost { timestamp: 1000 }).unwrap();
    let s = server_transition(s, ServerEvent::ClientDisconnected).unwrap();
    let s = server_transition(s, ServerEvent::MessageReceived { stream_seq: 2, message_type: MessageType::Assistant }).unwrap();
    let c = client_transition(c, ClientEvent::NetworkRestored { tab_id: "t1".into() }).unwrap();
    let s = server_transition(s, ServerEvent::ClientReconnected).unwrap();
    assert_eq!(s.state_name(), "Streaming");
    let c = client_transition(c, ClientEvent::ReconnectProbeResult {
        has_stream: true, state: Some(ReconnectStreamState::Streaming), request_id: Some("r1".into()), messages_count: 2,
    }).unwrap();
    assert_eq!(c.state_name(), "ReconnectPolling");
}

#[test]
fn transition_error_display() {
    let err = TransitionError::inapplicable("Idle", "MessageReceived");
    assert!(err.to_string().contains("MessageReceived"));
}

#[test]
fn transition_error_is_std_error() {
    let err = TransitionError::terminal("Done", "Ping");
    let _: &dyn std::error::Error = &err;
}
