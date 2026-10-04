import uuid
from django.db import models
from django.conf import settings

class AuditEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_actions')
    actor_role = models.CharField(max_length=50, null=True, blank=True)
    action = models.CharField(max_length=100, db_index=True)
    entity_type = models.CharField(max_length=80, db_index=True)
    entity_id = models.CharField(max_length=100, db_index=True)
    
    before_data = models.JSONField(null=True, blank=True)
    after_data = models.JSONField(null=True, blank=True)
    
    ip_hash_or_ip = models.CharField(max_length=100, blank=True, default="")
    user_agent = models.TextField(blank=True, default="")
    request_id = models.CharField(max_length=100, blank=True, default="")
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'audit_events'
        verbose_name = 'Audit Event'
        verbose_name_plural = 'Audit Events'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M:%S')}] {self.action} on {self.entity_type}:{self.entity_id} by {self.actor_user or self.actor_role or 'SYSTEM'}"
