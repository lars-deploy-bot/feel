import { Rocket } from 'lucide-react'

interface StartMessageProps {
  data: {
    host: string
    cwd: string
    message: string
    messageLength: number
  }
  timestamp: string
}

export function StartMessage({ data, timestamp }: StartMessageProps) {
  return (
    <div className="text-sm text-gray-600 text-center my-2">
      <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 inline-flex items-center gap-2">
        <Rocket size={16} />
        Started in {data.cwd}
      </div>
    </div>
  )
}