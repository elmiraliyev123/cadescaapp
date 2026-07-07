import type { ReactNode } from "react";

type DataTableColumn<T> = {
  header: string;
  cell: (row: T) => ReactNode;
};

export function DataTable<T>({ columns, rows, getRowKey }: { columns: DataTableColumn<T>[]; rows: T[]; getRowKey: (row: T) => string }) {
  return (
    <div className="max-w-full overflow-x-auto rounded-xl border border-outline-variant/70 bg-surface-container-lowest">
      <table className="min-w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-outline-variant/70 bg-surface-container-low">
            {columns.map((column) => (
              <th key={column.header} className="px-4 py-3 text-caption font-semibold uppercase tracking-[0.08em] text-secondary">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="border-b border-outline-variant/70 last:border-0">
              {columns.map((column) => (
                <td key={column.header} className="whitespace-nowrap px-4 py-3.5 text-label-md text-primary">
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
