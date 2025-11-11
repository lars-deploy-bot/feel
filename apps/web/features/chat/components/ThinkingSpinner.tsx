export function ThinkingSpinner() {
  return (
    <span
      className="inline-flex items-center justify-center text-green-600 dark:text-green-500"
      style={{ verticalAlign: "middle", width: "0.8em" }}
      aria-hidden="true"
    >
      <span className="thinking-grow inline-block">•</span>
    </span>
  )
}
