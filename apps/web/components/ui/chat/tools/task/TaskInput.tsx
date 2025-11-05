interface TaskInputProps {
  description: string
  prompt: string
  subagent_type: string
}

export function TaskInput({ description, prompt, subagent_type }: TaskInputProps) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-black/60 dark:text-white/60 font-thin">{description}</div>
      <div className="text-xs text-black/40 dark:text-white/40 font-thin">agent: {subagent_type.toLowerCase()}</div>
      {prompt && (
        <div className="text-xs text-black/30 dark:text-white/30 font-thin leading-relaxed">
          {prompt.slice(0, 100)}
          {prompt.length > 100 ? "..." : ""}
        </div>
      )}
    </div>
  )
}
