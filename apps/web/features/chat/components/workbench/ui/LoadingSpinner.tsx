import { PulsingDot } from "../../ui/PulsingDot"

/**
 * Consistent loading spinner for workbench views
 */
export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-24">
      <PulsingDot size="lg" />
    </div>
  )
}
