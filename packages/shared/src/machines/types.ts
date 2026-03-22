/**
 * Shared primitives for all state machines.
 *
 * Every machine follows the same pattern:
 * - State is a discriminated union (tag + variant-specific data)
 * - Events are a discriminated union
 * - transition(state, event) → TransitionResult
 * - Only transition() produces new states
 */

export type TransitionResult<S> = { ok: true; state: S } | { ok: false; from: string; event: string; reason: string }

export function ok<S>(state: S): TransitionResult<S> {
  return { ok: true, state }
}

export function err<S>(from: string, event: string, reason?: string): TransitionResult<S> {
  return { ok: false, from, event, reason: reason ?? `${event} is not valid in ${from}` }
}
