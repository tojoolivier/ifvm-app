import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/**
 * Colonne de DataTable — docs/design_handoff_web/README.md §Design tokens
 * (en-tête `600 9.5px` uppercase sur fond `#faf7ef`, cellules numériques en
 * IBM Plex Mono alignées à droite).
 */
export interface DataTableColumn<T> {
  key: string
  header: string
  align?: 'left' | 'right'
  mono?: boolean
  render: (row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  emptyMessage?: string
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyMessage = 'Aucune donnée.',
}: DataTableProps<T>) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b-0 hover:bg-transparent">
          {columns.map((column) => (
            <TableHead
              key={column.key}
              className={cn(
                'bg-background font-sans text-[9.5px] font-semibold uppercase tracking-[.8px] text-ifvm-text-weak',
                column.align === 'right' && 'text-right',
              )}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length} className="py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn('border-t border-[#f4efe2]', onRowClick && 'cursor-pointer')}
            >
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={cn(
                    'py-3 text-[12px]',
                    column.align === 'right' && 'text-right',
                    column.mono ? 'font-mono font-semibold' : 'font-sans font-medium',
                  )}
                >
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
