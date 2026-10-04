from .models import AuditEvent

def get_recent_audit_events(limit: int = 100):
    return AuditEvent.objects.select_related('actor_user').order_by('-created_at')[:limit]
