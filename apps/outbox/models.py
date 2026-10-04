import uuid
from django.db import models
from django.utils import timezone

class OutboxStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    PROCESSING = 'PROCESSING', 'Processing'
    DISPATCHED = 'DISPATCHED', 'Dispatched'
    DEAD = 'DEAD', 'Dead'

class OutboxEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    aggregate_type = models.CharField(max_length=80, db_index=True)
    aggregate_id = models.UUIDField(db_index=True)
    event_type = models.CharField(max_length=120, db_index=True)
    event_version = models.IntegerField(default=1)
    payload = models.JSONField()
    
    status = models.CharField(max_length=20, choices=OutboxStatus.choices, default=OutboxStatus.PENDING, db_index=True)
    attempt_count = models.IntegerField(default=0)
    next_attempt_at = models.DateTimeField(default=timezone.now, db_index=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'outbox_events'
        verbose_name = 'Outbox Event'
        verbose_name_plural = 'Outbox Events'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['status', 'next_attempt_at', 'created_at']),
            models.Index(fields=['aggregate_type', 'aggregate_id']),
        ]

    def __str__(self):
        return f"[{self.status}] {self.event_type} ({self.aggregate_type}:{self.aggregate_id})"
