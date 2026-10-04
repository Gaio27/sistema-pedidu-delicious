from typing import Optional, Dict, Any
from .models import AuditEvent

def log_audit_event(
    *,
    action: str,
    entity_type: str,
    entity_id: str,
    actor_user=None,
    actor_role: Optional[str] = None,
    before_data: Optional[Dict[str, Any]] = None,
    after_data: Optional[Dict[str, Any]] = None,
    ip_address: str = "",
    user_agent: str = "",
    request_id: str = ""
) -> AuditEvent:
    """
    Logs an append-only audit event.
    """
    if actor_user and not actor_role:
        actor_role = getattr(actor_user, 'role', 'STAFF')

    return AuditEvent.objects.create(
        actor_user=actor_user,
        actor_role=actor_role or 'SYSTEM',
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        before_data=before_data,
        after_data=after_data,
        ip_hash_or_ip=ip_address,
        user_agent=user_agent[:500] if user_agent else "",
        request_id=request_id
    )
