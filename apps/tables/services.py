from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from .models import RestaurantTable, TableSession, TableStatus, SessionStatus, TableActivationRequest, ActivationRequestStatus

ACTIVE_SESSION_STATUSES = [
    SessionStatus.OPEN,
    SessionStatus.BILL_REQUESTED,
    SessionStatus.PAYMENT_PENDING,
    SessionStatus.PAID,
]

def open_table_session(*, table: RestaurantTable, opened_by, guest_count: int = 1, request_id: str = "", device_token: str = "") -> TableSession:
    """
    Opens a new dine-in table session atomically.
    Ensures that only ONE active session exists per table.
    Links and approves any pending TableActivationRequest for this table.
    """
    with transaction.atomic():
        locked_table = RestaurantTable.objects.select_for_update().get(id=table.id)
        
        if not locked_table.is_active:
            raise ValidationError("Table is not active.")
        if locked_table.status == TableStatus.MAINTENANCE:
            raise ValidationError("Table is currently under maintenance.")
            
        existing_active = TableSession.objects.filter(
            table=locked_table,
            status__in=ACTIVE_SESSION_STATUSES
        ).first()
        
        if existing_active:
            raise ValidationError(f"Table already has an active session (Session ID: {existing_active.id}).")
            
        # Check and resolve any pending activation requests for this table
        pending_reqs = TableActivationRequest.objects.filter(
            table=locked_table,
            status=ActivationRequestStatus.PENDING
        )
        resolved_device_token = device_token
        for req in pending_reqs:
            req.status = ActivationRequestStatus.APPROVED
            req.resolved_at = timezone.now()
            req.resolved_by = opened_by
            req.save(update_fields=['status', 'resolved_at', 'resolved_by'])
            if not resolved_device_token and req.device_token:
                resolved_device_token = req.device_token
            if guest_count <= 1 and req.guest_count > 1:
                guest_count = req.guest_count

        session = TableSession.objects.create(
            restaurant=locked_table.restaurant,
            table=locked_table,
            opened_by=opened_by,
            guest_count=max(1, guest_count),
            status=SessionStatus.OPEN,
            primary_device_token=resolved_device_token or None,
            authorized_device_tokens=[resolved_device_token] if resolved_device_token else []
        )
        
        locked_table.status = TableStatus.OCCUPIED
        locked_table.save(update_fields=['status', 'updated_at'])
        
        # Outbox & Audit integration
        from apps.audit.services import log_audit_event
        from apps.outbox.services import create_outbox_event
        
        log_audit_event(
            actor_user=opened_by,
            actor_role=getattr(opened_by, 'role', 'CASHIER'),
            action='TABLE_OPEN',
            entity_type='TableSession',
            entity_id=str(session.id),
            after_data={'table_code': locked_table.table_code, 'guest_count': session.guest_count},
            request_id=request_id
        )
        
        create_outbox_event(
            aggregate_type='TABLE_SESSION',
            aggregate_id=session.id,
            event_type='SESSION_OPENED',
            payload={
                'session_id': str(session.id),
                'public_token': session.public_token,
                'table_id': str(locked_table.id),
                'table_code': locked_table.table_code,
                'table_name': locked_table.display_name,
                'qr_token': locked_table.qr_token,
                'status': session.status,
            }
        )
        
        return session


def request_table_activation(*, table: RestaurantTable, device_token: str = "", guest_count: int = 2) -> TableActivationRequest:
    """
    Submits a table activation request from customer scanning an unopened/locked table QR.
    Emits TABLE_ACTIVATION_REQUESTED outbox event to notify cashier immediately.
    """
    with transaction.atomic():
        locked_table = RestaurantTable.objects.select_for_update().get(id=table.id)
        if not locked_table.is_active:
            raise ValidationError("Meza la ativu.")
        if locked_table.status == TableStatus.MAINTENANCE:
            raise ValidationError("Meza iha manutensaun nia laran.")

        # If table already has an active session, return None
        existing_active = TableSession.objects.filter(
            table=locked_table,
            status__in=ACTIVE_SESSION_STATUSES
        ).first()
        if existing_active:
            return None

        # Re-use or update existing pending request
        req = TableActivationRequest.objects.filter(
            table=locked_table,
            status=ActivationRequestStatus.PENDING
        ).first()

        if req:
            req.requested_at = timezone.now()
            if device_token:
                req.device_token = device_token
            if guest_count > 0:
                req.guest_count = guest_count
            req.save(update_fields=['requested_at', 'device_token', 'guest_count'])
        else:
            req = TableActivationRequest.objects.create(
                restaurant=locked_table.restaurant,
                table=locked_table,
                device_token=device_token or "",
                guest_count=max(1, guest_count),
                status=ActivationRequestStatus.PENDING
            )

        from apps.outbox.services import create_outbox_event
        create_outbox_event(
            aggregate_type='TABLE',
            aggregate_id=locked_table.id,
            event_type='TABLE_ACTIVATION_REQUESTED',
            payload={
                'request_id': str(req.id),
                'table_id': str(locked_table.id),
                'table_code': locked_table.table_code,
                'table_name': locked_table.display_name,
                'guest_count': req.guest_count,
                'device_token': req.device_token,
                'requested_at': req.requested_at.isoformat(),
            }
        )

        return req


def approve_table_activation(*, request_id: str, approved_by, request_id_header: str = "") -> TableSession:
    """
    Approves a table activation request by opening the table session and claiming the requesting device.
    """
    with transaction.atomic():
        req = TableActivationRequest.objects.select_for_update().get(id=request_id)
        if req.status != ActivationRequestStatus.PENDING:
            existing_active = TableSession.objects.filter(
                table=req.table,
                status__in=ACTIVE_SESSION_STATUSES
            ).first()
            if existing_active:
                return existing_active
            raise ValidationError(f"Pedidu loke meza la válidu tanba status '{req.status}'.")

        session = open_table_session(
            table=req.table,
            opened_by=approved_by,
            guest_count=req.guest_count,
            request_id=request_id_header,
            device_token=req.device_token or ""
        )
        return session


def reject_table_activation(*, request_id: str, rejected_by, reason: str = "") -> TableActivationRequest:
    """
    Rejects a table activation request.
    """
    with transaction.atomic():
        req = TableActivationRequest.objects.select_for_update().get(id=request_id)
        req.status = ActivationRequestStatus.REJECTED
        req.resolved_at = timezone.now()
        req.resolved_by = rejected_by
        req.save(update_fields=['status', 'resolved_at', 'resolved_by'])
        return req


def close_table_session(*, session: TableSession, closed_by, reason: str = "Completed", request_id: str = "") -> TableSession:
    """
    Closes an active table session atomically.
    Sets table to AVAILABLE.
    """
    with transaction.atomic():
        locked_session = TableSession.objects.select_for_update().get(id=session.id)
        
        if locked_session.status == SessionStatus.CLOSED:
            return locked_session
            
        locked_session.status = SessionStatus.CLOSED
        locked_session.closed_by = closed_by
        locked_session.closed_at = timezone.now()
        locked_session.close_reason = reason
        locked_session.save(update_fields=['status', 'closed_by', 'closed_at', 'close_reason', 'updated_at'])
        
        table = RestaurantTable.objects.select_for_update().get(id=locked_session.table_id)
        table.status = TableStatus.AVAILABLE
        table.save(update_fields=['status', 'updated_at'])
        
        # Outbox & Audit integration
        from apps.audit.services import log_audit_event
        from apps.outbox.services import create_outbox_event
        
        log_audit_event(
            actor_user=closed_by,
            actor_role=getattr(closed_by, 'role', 'CASHIER') if closed_by else 'SYSTEM',
            action='TABLE_CLOSE',
            entity_type='TableSession',
            entity_id=str(locked_session.id),
            after_data={'close_reason': reason},
            request_id=request_id
        )
        
        create_outbox_event(
            aggregate_type='TABLE_SESSION',
            aggregate_id=locked_session.id,
            event_type='SESSION_CLOSED',
            payload={
                'session_id': str(locked_session.id),
                'public_token': locked_session.public_token,
                'table_id': str(table.id),
                'table_code': table.table_code,
                'status': locked_session.status,
            }
        )
        
        return locked_session

def request_bill_for_session(*, session: TableSession, request_id: str = "") -> TableSession:
    """
    Customer or cashier requests bill for the table session.
    Strictly validates that table has at least one order SERVED and no pending/cooking orders.
    """
    with transaction.atomic():
        locked_session = TableSession.objects.select_for_update().get(id=session.id)
        if locked_session.status == SessionStatus.OPEN:
            from apps.ordering.models import Order, OrderStatus
            
            # 1. Must have at least 1 order with status SERVED
            served_orders = Order.objects.filter(
                table_session=locked_session,
                status=OrderStatus.SERVED
            )
            if not served_orders.exists():
                raise ValidationError(
                    "Ita-boot seidauk bele husu konta tanba seidauk iha pedidu ne'ebé entrega tiha ona ba meza (SERVED)."
                )

            # 2. Must not have orders currently being verified or cooking in kitchen
            cooking_orders = Order.objects.filter(
                table_session=locked_session,
                status__in=[
                    OrderStatus.WAITING_CASHIER_CONFIRMATION,
                    OrderStatus.CONFIRMED,
                    OrderStatus.PREPARING
                ]
            )
            if cooking_orders.exists():
                raise ValidationError(
                    "Sei iha hahan ne'ebé prepara hela iha dapur. Favór hein to'o hahan hotu to'o meza molok husu konta."
                )

            locked_session.status = SessionStatus.BILL_REQUESTED
            locked_session.bill_requested_at = timezone.now()
            locked_session.save(update_fields=['status', 'bill_requested_at', 'updated_at'])
            
            from apps.outbox.services import create_outbox_event
            create_outbox_event(
                aggregate_type='TABLE_SESSION',
                aggregate_id=locked_session.id,
                event_type='BILL_REQUESTED',
                payload={
                    'session_id': str(locked_session.id),
                    'public_token': locked_session.public_token,
                    'table_code': locked_session.table.table_code,
                    'table_name': locked_session.table.display_name,
                }
            )
        return locked_session

def rotate_table_qr(*, table: RestaurantTable, actor_user, request_id: str = "") -> str:
    with transaction.atomic():
        locked_table = RestaurantTable.objects.select_for_update().get(id=table.id)
        old_token = locked_table.qr_token
        new_token = locked_table.rotate_qr()
        
        from apps.audit.services import log_audit_event
        log_audit_event(
            actor_user=actor_user,
            actor_role=getattr(actor_user, 'role', 'ADMIN'),
            action='QR_ROTATE',
            entity_type='RestaurantTable',
            entity_id=str(locked_table.id),
            before_data={'qr_token': old_token},
            after_data={'qr_token': new_token},
            request_id=request_id
        )
        return new_token
