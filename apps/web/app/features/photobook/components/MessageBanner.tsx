interface MessageBannerProps {
  message: string
  type: "error" | "success"
}

export function MessageBanner({ message, type }: MessageBannerProps) {
  const styles = {
    error: "text-red-600 bg-red-50",
    success: "text-green-700 bg-green-50 font-medium",
  }

  return (
    <div className="mb-8 text-center" role="alert" aria-live="polite">
      <p className={`${styles[type]} px-6 py-3 rounded-full inline-block`}>{message}</p>
    </div>
  )
}
