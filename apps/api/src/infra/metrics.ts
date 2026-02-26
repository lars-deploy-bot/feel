// Plug in Prometheus/PostHog when ready.
// For now, all methods are no-ops.

export const metrics = {
  increment(_name: string): void {
    // no-op
  },
  histogram(_name: string, _value: number): void {
    // no-op
  },
  gauge(_name: string, _value: number): void {
    // no-op
  },
}
