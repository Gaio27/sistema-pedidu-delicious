import uuid
import secrets
from django.db import models
from django.conf import settings

class TableStatus(models.TextChoices):
    AVAILABLE = 'AVAILABLE', 'Available'
    OCCUPIED = 'OCCUPIED', 'Occupied'
    CLEANING = 'CLEANING', 'Cleaning'
    MAINTENANCE = 'MAINTENANCE', 'Maintenance'

class SessionStatus(models.TextChoices):
    OPEN = 'OPEN', 'Open'
    BILL_REQUESTED = 'BILL_REQUESTED', 'Bill Requested'
    PAYMENT_PENDING = 'PAYMENT_PENDING', 'Payment Pending'
    PAID = 'PAID', 'Paid'
    CLOSED = 'CLOSED', 'Closed'
    CANCELLED = 'CANCELLED', 'Cancelled'

def generate_secure_token():
    return secrets.token_urlsafe(32)

class RestaurantTable(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey('restaurants.Restaurant', on_delete=models.CASCADE, related_name='tables')
    table_code = models.CharField(max_length=30)
    display_name = models.CharField(max_length=80)
    capacity = models.PositiveIntegerField(null=True, blank=True)
    qr_token = models.CharField(max_length=128, unique=True, default=generate_secure_token, db_index=True)
    status = models.CharField(max_length=20, choices=TableStatus.choices, default=TableStatus.AVAILABLE, db_index=True)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'restaurant_tables'
        verbose_name = 'Restaurant Table'
        verbose_name_plural = 'Restaurant Tables'
        ordering = ['sort_order', 'table_code']
        constraints = [
            models.UniqueConstraint(fields=['restaurant', 'table_code'], name='unique_restaurant_table_code'),
        ]

    def __str__(self):
        return f"{self.display_name} ({self.table_code})"

    def rotate_qr(self):
        self.qr_token = generate_secure_token()
        self.save(update_fields=['qr_token', 'updated_at'])
        return self.qr_token

class TableSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    restaurant = models.ForeignKey('restaurants.Restaurant', on_delete=models.CASCADE, related_name='sessions')
    table = models.ForeignKey(RestaurantTable, on_delete=models.PROTECT, related_name='sessions')
    public_token = models.CharField(max_length=128, unique=True, default=generate_secure_token, db_index=True)
    status = models.CharField(max_length=30, choices=SessionStatus.choices, default=SessionStatus.OPEN, db_index=True)
    guest_count = models.PositiveIntegerField(default=1)
    
    opened_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='opened_sessions')
    opened_at = models.DateTimeField(auto_now_add=True)
    bill_requested_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='closed_sessions')
    closed_at = models.DateTimeField(null=True, blank=True)
    close_reason = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'table_sessions'
        verbose_name = 'Table Session'
        verbose_name_plural = 'Table Sessions'
        indexes = [
            models.Index(fields=['table', 'status']),
            models.Index(fields=['opened_at']),
        ]

    def __str__(self):
        return f"Session {self.public_token[:8]} - {self.table.display_name} ({self.status})"

    @property
    def is_active(self):
        return self.status in [
            SessionStatus.OPEN,
            SessionStatus.BILL_REQUESTED,
            SessionStatus.PAYMENT_PENDING,
            SessionStatus.PAID
        ]
