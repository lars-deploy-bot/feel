export function ThinkingSpinner() {
  return (
    <span
      className="font-mono inline-block overflow-hidden text-center align-middle relative text-black/35"
      aria-hidden="true"
    >
      <span className="invisible">✽</span>
      <span className="block absolute left-0 right-0 select-none thinking-spinner-animate" style={{ top: "-0.35em" }}>
        <span className="block" style={{ lineHeight: "2em" }}>
          ·
        </span>
        <span className="block" style={{ lineHeight: "2em" }}>
          ✢
        </span>
        <span className="block" style={{ lineHeight: "2em" }}>
          ✶
        </span>
        <span className="block" style={{ lineHeight: "2em" }}>
          ✻
        </span>
        <span className="block" style={{ lineHeight: "2em" }}>
          ✽
        </span>
      </span>
    </span>
  )
}
