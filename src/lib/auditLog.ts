import { queryMutate } from './queryApi';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'impersonation_start'
  | 'impersonation_end';

export type AuditEntityType =
  | 'session'
  | 'account_access'
  | 'application'
  | 'template'
  | 'whatsapp_template'
  | 'email_credentials'
  | 'embed_credential'
  | 'whatsapp_config'
  | 'automation_program';

export interface LogAuditEventParams {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  applicationId?: string | null;
  tenantId?: string | null;
  actor: { id?: string | null; email?: string | null; name?: string | null };
  metadata?: Record<string, unknown>;
}

// Fire-and-forget: an audit-log write must never block or fail the real
// user action it is describing. Errors are swallowed and only logged.
export async function logAuditEvent(params: LogAuditEventParams): Promise<void> {
  try {
    const { error } = await queryMutate({
      table: 'audit_logs',
      operation: 'insert',
      data: {
        tenant_id: params.tenantId || null,
        application_id: params.applicationId || null,
        actor_user_id: params.actor.id || null,
        actor_email: params.actor.email || null,
        actor_name: params.actor.name || null,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId || null,
        entity_label: params.entityLabel || null,
        metadata: params.metadata || {},
      },
    });

    if (error) {
      console.warn('audit log insert failed:', error.message);
    }
  } catch (err) {
    console.warn('audit log insert failed:', err);
  }
}
