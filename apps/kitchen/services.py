from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

from apps.ordering.models import Order, OrderStatus, OrderStatusHistory, ActorType
from apps.audit.services import log_audit_event
from apps.outbox.services import create_outbox_event

def start_preparing_order(*, order: Order, staff_user=None, request_id: str = "") -> Order:
    with transaction.atomic():
        locked_order = Order.objects.select_for_update().get(id=order.id)
        
        if locked_order.status != OrderStatus.CONFIRMED:
            if locked_order.status == OrderStatus.PREPARING:
                return locked_order
            raise ValidationError(f"Order must be CONFIRMED before preparing. Current status: '{locked_order.status}'.")

        old_status = locked_order.status
        locked_order.status = OrderStatus.PREPARING
        locked_order.save(update_fields=['status', 'updated_at'])

        OrderStatusHistory.objects.create(
            order=locked_order,
            from_status=old_status,
            to_status=OrderStatus.PREPARING,
            actor_user=staff_user,
            actor_type=ActorType.STAFF,
            reason="Kitchen started preparation",
            request_id=request_id
        )

        log_audit_event(
            actor_user=staff_user,
            actor_role=getattr(staff_user, 'role', 'KITCHEN') if staff_user else 'KITCHEN',
            action='KITCHEN_START_PREP',
            entity_type='Order',
            entity_id=str(locked_order.id),
            before_data={'status': old_status},
            after_data={'status': OrderStatus.PREPARING},
            request_id=request_id
        )

        create_outbox_event(
            aggregate_type='ORDER',
            aggregate_id=locked_order.id,
            event_type='ORDER_PREPARING',
            payload={
                'order_id': str(locked_order.id),
                'order_code': locked_order.order_code,
                'table_code': locked_order.table_session.table.table_code,
                'status': locked_order.status,
                'session_token': locked_order.table_session.public_token,
            }
        )

        return locked_order

def mark_order_ready(*, order: Order, staff_user=None, request_id: str = "") -> Order:
    with transaction.atomic():
        locked_order = Order.objects.select_for_update().get(id=order.id)
        
        if locked_order.status not in [OrderStatus.CONFIRMED, OrderStatus.PREPARING]:
            if locked_order.status == OrderStatus.READY:
                return locked_order
            raise ValidationError(f"Cannot mark order ready from status '{locked_order.status}'.")

        old_status = locked_order.status
        locked_order.status = OrderStatus.READY
        locked_order.save(update_fields=['status', 'updated_at'])

        OrderStatusHistory.objects.create(
            order=locked_order,
            from_status=old_status,
            to_status=OrderStatus.READY,
            actor_user=staff_user,
            actor_type=ActorType.STAFF,
            reason="Kitchen marked order ready",
            request_id=request_id
        )

        log_audit_event(
            actor_user=staff_user,
            actor_role=getattr(staff_user, 'role', 'KITCHEN') if staff_user else 'KITCHEN',
            action='KITCHEN_MARK_READY',
            entity_type='Order',
            entity_id=str(locked_order.id),
            before_data={'status': old_status},
            after_data={'status': OrderStatus.READY},
            request_id=request_id
        )

        create_outbox_event(
            aggregate_type='ORDER',
            aggregate_id=locked_order.id,
            event_type='ORDER_READY',
            payload={
                'order_id': str(locked_order.id),
                'order_code': locked_order.order_code,
                'table_code': locked_order.table_session.table.table_code,
                'status': locked_order.status,
                'session_token': locked_order.table_session.public_token,
            }
        )

        return locked_order

def mark_order_served(*, order: Order, staff_user=None, request_id: str = "") -> Order:
    with transaction.atomic():
        locked_order = Order.objects.select_for_update().get(id=order.id)
        
        if locked_order.status not in [OrderStatus.PREPARING, OrderStatus.READY]:
            if locked_order.status == OrderStatus.SERVED:
                return locked_order
            raise ValidationError(f"Cannot mark order served from status '{locked_order.status}'.")

        old_status = locked_order.status
        locked_order.status = OrderStatus.SERVED
        locked_order.save(update_fields=['status', 'updated_at'])

        OrderStatusHistory.objects.create(
            order=locked_order,
            from_status=old_status,
            to_status=OrderStatus.SERVED,
            actor_user=staff_user,
            actor_type=ActorType.STAFF,
            reason="Order served to table",
            request_id=request_id
        )

        log_audit_event(
            actor_user=staff_user,
            actor_role=getattr(staff_user, 'role', 'STAFF') if staff_user else 'STAFF',
            action='ORDER_SERVED',
            entity_type='Order',
            entity_id=str(locked_order.id),
            before_data={'status': old_status},
            after_data={'status': OrderStatus.SERVED},
            request_id=request_id
        )

        create_outbox_event(
            aggregate_type='ORDER',
            aggregate_id=locked_order.id,
            event_type='ORDER_SERVED',
            payload={
                'order_id': str(locked_order.id),
                'order_code': locked_order.order_code,
                'table_code': locked_order.table_session.table.table_code,
                'status': locked_order.status,
                'session_token': locked_order.table_session.public_token,
            }
        )

        return locked_order
