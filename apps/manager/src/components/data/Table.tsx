import { cn } from "@/lib/cn"

interface Column<T> {
  key: string
  header: string
  render: (row: T) => React.ReactNode
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyFn: (row: T) => string
  onRowClick?: (row: T) => void
  className?: string
}

export function Table<T>({ columns, data, keyFn, onRowClick, className }: TableProps<T>) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider",
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {data.map(row => (
            <tr
              key={keyFn(row)}
              onClick={() => onRowClick?.(row)}
              className={cn("transition-colors", onRowClick && "cursor-pointer hover:bg-surface-secondary")}
            >
              {columns.map(col => (
                <td key={col.key} className={cn("px-4 py-3.5", col.className)}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
