// Filas que devuelve `db.from(...).groupBy(...)`: una por combinación de columnas,
// con `count` y `<columna>_count`. Si la API todavía no agrupa, devuelve las filas
// sueltas; en ese caso cada fila cuenta como 1 y así el panel no muestra cifras rotas.
export type GroupedRow = Record<string, unknown>;

export function rowCount(row: GroupedRow): number {
  return typeof row.count === 'number' ? row.count : 1;
}

export function nonNullCount(row: GroupedRow, column: string): number {
  const counted = row[`${column}_count`];
  if (typeof counted === 'number') return counted;
  return row[column] !== null && row[column] !== undefined ? 1 : 0;
}

export function sumCounts(rows: GroupedRow[], predicate: (row: GroupedRow) => boolean): number {
  return rows.reduce((total, row) => (predicate(row) ? total + rowCount(row) : total), 0);
}
