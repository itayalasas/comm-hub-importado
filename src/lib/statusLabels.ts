const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  scheduled: 'Programado',
  batch: 'En lote',
  active: 'Activo',
  paused: 'Pausado',
  done: 'Completado',
  failed: 'Fallido',
  cancelled: 'Cancelado',
  pending: 'Pendiente',
  processing: 'Procesando',
  queued: 'En espera',
  sent: 'Enviado',
  success: 'Exito',
  warning: 'Aviso',
  error: 'Error',
  info: 'Info',
};

export function translateStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
