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
  /** Classes par ligne — sert au marqueur de ligne sélectionnée de la maquette (`inset 3px 0 0`). */
  rowClassName?: (row: T, index: number) => string | undefined
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyMessage = 'Aucune donnée.',
  rowClassName,
}: DataTableProps<T>) {
  // Padding de cellule du handoff (README §Design tokens) : 12px, porté à 20px
  // en première et dernière colonne pour aligner le contenu sur le bord de carte.
  const paddingX = (index: number) => (index === 0 || index === columns.length - 1 ? 'px-5' : 'px-3')

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b-0 hover:bg-transparent">
          {columns.map((column, index) => (
            <TableHead
              key={column.key}
              className={cn(
                'h-auto bg-background py-[9px] font-sans text-[9.5px] font-semibold uppercase tracking-[.8px] text-ifvm-text-weak',
                paddingX(index),
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
          rows.map((row, index) => (
            <TableRow
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-t border-[#f4efe2]',
                onRowClick && 'cursor-pointer',
                rowClassName?.(row, index),
              )}
            >
              {columns.map((column, index) => (
                <TableCell
                  key={column.key}
                  className={cn(
                    'py-3 text-[12px]',
                    paddingX(index),
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
