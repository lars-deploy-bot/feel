"use client"

import { useEffect, useRef } from "react"
import { useChatInput } from "./ChatInputContext"

export function InputArea() {
  const { message, setMessage, onSubmit, config } = useChatInput()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      const minHeightPx = parseInt(config.minHeight ?? "80px", 10)
      const maxHeightPx = parseInt(config.maxHeight ?? "100px", 10)

      // Reset to min height
      textareaRef.current.style.height = `${minHeightPx}px`

      // Calculate content height
      const scrollHeight = textareaRef.current.scrollHeight
      const newHeight = Math.min(Math.max(scrollHeight, minHeightPx), maxHeightPx)
      textareaRef.current.style.height = `${newHeight}px`
    }
  }, [message, config.minHeight, config.maxHeight])

  return (
    <textarea
      ref={textareaRef}
      value={message}
      onChange={e => setMessage(e.target.value)}
      onKeyDown={e => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          onSubmit()
        }
      }}
      placeholder={config.placeholder}
      className="w-full resize-none border-0 bg-transparent text-base font-normal focus:outline-none py-3 pl-3 pr-14 text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40"
      rows={1}
      data-testid="message-input"
      aria-label="Message input"
    />
  )
}
