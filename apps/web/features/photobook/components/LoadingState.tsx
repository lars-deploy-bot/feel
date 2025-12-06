import { Image as ImageIcon } from "lucide-react"

interface LoadingStateProps {
  message: string
}

export function LoadingState({ message }: LoadingStateProps) {
  return (
    <output className="text-center py-32 block" aria-live="polite">
      <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
        <ImageIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
      </div>
      <p className="text-gray-500 dark:text-gray-400">{message}</p>
    </output>
  )
}
