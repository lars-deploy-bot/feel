//! # stream-fsm
//!
//! Rust → WASM state machine for the Alive NDJSON streaming protocol.
//!
//! Two exhaustive state machines (server + client) where illegal states are
//! unrepresentable. Both browser and Node.js import the same WASM binary.
//!
//! ## Guarantees
//!
//! 1. States are opaque enums — consumers cannot construct states directly.
//! 2. `transition()` returns `Result` — invalid pairs error, never panic.
//! 3. Data lives in enum variants — no tokens without Streaming, no stop_id without Stopping.
//! 4. Pure functions — no side effects. The TS glue does the actual work.
//! 5. Adding a state variant without match arms is a compile error.

pub mod client;
pub mod server;
pub mod types;

pub use client::{client_transition, ClientEvent, ClientStreamState};
pub use server::{server_transition, ServerEvent, ServerStreamState};
pub use types::TransitionError;

use wasm_bindgen::prelude::*;

// ---------------------------------------------------------------------------
// WASM helpers — macro to avoid copy-pasting the serde dance
// ---------------------------------------------------------------------------

macro_rules! wasm_transition {
    ($fn_name:ident, $js_name:expr, $state_ty:ty, $event_ty:ty, $transition_fn:path) => {
        #[wasm_bindgen(js_name = $js_name)]
        pub fn $fn_name(state: JsValue, event: JsValue) -> Result<JsValue, JsValue> {
            let s: $state_ty = serde_wasm_bindgen::from_value(state)
                .map_err(|e| JsValue::from_str(&format!("Bad state: {e}")))?;
            let e: $event_ty = serde_wasm_bindgen::from_value(event)
                .map_err(|e| JsValue::from_str(&format!("Bad event: {e}")))?;
            match $transition_fn(s, e) {
                Ok(new) => serde_wasm_bindgen::to_value(&new)
                    .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}"))),
                Err(te) => Err(serde_wasm_bindgen::to_value(&te)
                    .map_err(|e| JsValue::from_str(&format!("Serialize error: {e}")))?),
            }
        }
    };
}

wasm_transition!(wasm_server_transition, "serverTransition", ServerStreamState, ServerEvent, server_transition);
wasm_transition!(wasm_client_transition, "clientTransition", ClientStreamState, ClientEvent, client_transition);

#[wasm_bindgen(js_name = "serverIdle")]
pub fn wasm_server_idle() -> JsValue {
    serde_wasm_bindgen::to_value(&ServerStreamState::Idle).unwrap()
}

#[wasm_bindgen(js_name = "clientIdle")]
pub fn wasm_client_idle() -> JsValue {
    serde_wasm_bindgen::to_value(&ClientStreamState::Idle { last_request_id: None }).unwrap()
}

macro_rules! wasm_state_query {
    ($fn_name:ident, $js_name:expr, $state_ty:ty, $method:ident, $ret:ty) => {
        #[wasm_bindgen(js_name = $js_name)]
        pub fn $fn_name(state: JsValue) -> Result<$ret, JsValue> {
            let s: $state_ty = serde_wasm_bindgen::from_value(state)
                .map_err(|e| JsValue::from_str(&format!("Bad state: {e}")))?;
            Ok(s.$method().into())
        }
    };
}

wasm_state_query!(wasm_server_state_name, "serverStateName", ServerStreamState, state_name, String);
wasm_state_query!(wasm_client_state_name, "clientStateName", ClientStreamState, state_name, String);
wasm_state_query!(wasm_server_is_terminal, "serverIsTerminal", ServerStreamState, is_terminal, bool);
wasm_state_query!(wasm_client_is_active, "clientIsActive", ClientStreamState, is_active, bool);
