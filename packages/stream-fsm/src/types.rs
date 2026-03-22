use serde::{Deserialize, Serialize};
use tsify_next::Tsify;

/// Source of a cancel request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub enum CancelSource {
    HttpAbort,
    ClientCancel,
    SharedIntent,
}

/// Final outcome of a stream lifecycle.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub enum Outcome {
    Completed,
    Cancelled,
    Errored,
}

/// Error codes that can occur during streaming.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub enum ErrorCode {
    SdkError,
    ProcessCrash,
    Timeout,
    AuthFailure,
    RateLimit,
    BufferOverflow,
    Unknown,
}

/// Response status from a cancel endpoint call.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub enum CancelEndpointStatus {
    Cancelled,
    AlreadyComplete,
    NotFound,
    Error,
}

/// Result of a verification probe after cancel.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub enum VerificationStatus {
    Confirmed,
    StillStreaming,
    Unknown,
}

/// Result of a reconnect probe.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub enum ReconnectStreamState {
    Streaming,
    Complete,
}

/// Type of stream event received on the client side.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub enum StreamEventType {
    Start,
    Message,
    Session,
    Complete,
    Error,
    Ping,
}

/// Type of message received on the server side.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub enum MessageType {
    Assistant,
    ToolUse,
    ToolResult,
    System,
    Other,
}

/// Error returned when a transition is invalid.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct TransitionError {
    pub state_name: String,
    pub event_name: String,
    pub reason: String,
}

impl std::fmt::Display for TransitionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Invalid transition: '{}' in state '{}': {}",
            self.event_name, self.state_name, self.reason
        )
    }
}

impl std::error::Error for TransitionError {}

impl TransitionError {
    pub fn terminal(state: &str, event: &str) -> Self {
        Self {
            state_name: state.into(),
            event_name: event.into(),
            reason: "state is terminal — no further transitions allowed".into(),
        }
    }

    pub fn inapplicable(state: &str, event: &str) -> Self {
        Self {
            state_name: state.into(),
            event_name: event.into(),
            reason: "event is not applicable in this state".into(),
        }
    }
}

/// Information about a pending tool invocation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct PendingTool {
    pub tool_use_id: String,
    pub tool_name: String,
}
