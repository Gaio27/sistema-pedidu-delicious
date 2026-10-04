import secrets
from decimal import Decimal
from typing import Dict, Any
from django.db import models, transaction
from django.utils import timezone
from django.core.exceptions import ValidationError

from apps.tables.models import TableSession, SessionStatus
from apps.ordering.models import Order, OrderStatus
from .models import Payment, PaymentMethod, PaymentStatus
from apps.audit.services import log_audit_event
from apps.outbox.services import create_outbox_event

BILLABLE_ORDER_STATUSES = [
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.SERVED,
    OrderStatus.COMPLETED,
]

def generate_payment_code() -> str:
    today_str = timezone.now().strftime("%Y%m%d")
    random_suffix = secrets.token_hex(3).upper()
    return f"PAY-{today_str}-{random_suffix}"

def calculate_session_bill(session: TableSession) -> Dict[str, Any]:
    """
    Aggregates bill across all approved orders for the session.
    Excludes WAITING_CASHIER_CONFIRMATION, REJECTED, and CANCELLED orders.
    Accurately computes total_paid, remaining_balance, and full payment state.
    """
    orders = Order.objects.filter(
        table_session=session,
        status__in=BILLABLE_ORDER_STATUSES
    ).prefetch_related('items')

    subtotal = sum((o.subtotal for o in orders), Decimal('0.00'))
    tax_total = sum((o.tax_total for o in orders), Decimal('0.00'))
    discount_total = sum((o.discount_total for o in orders), Decimal('0.00'))
    grand_total = sum((o.grand_total for o in orders), Decimal('0.00'))

    # Gather item line details with notes
    all_items = []
    for order in orders:
        for item in order.items.all():
            all_items.append({
                'name': item.menu_name_snapshot,
                'quantity': item.quantity,
                'unit_price': str(item.unit_price),
                'subtotal': str(item.subtotal),
                'note': item.note or '',
                'order_code': order.order_code
            })

    # Calculate completed payments for this session
    total_paid = Payment.objects.filter(
        table_session=session,
        status=PaymentStatus.COMPLETED
    ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')

    remaining_balance = max(Decimal('0.00'), grand_total - total_paid)
    is_fully_paid = (total_paid >= grand_total and grand_total > Decimal('0.00'))

    return {
        'orders_count': orders.count(),
        'subtotal': subtotal.quantize(Decimal('0.01')),
        'tax_total': tax_total.quantize(Decimal('0.01')),
        'discount_total': discount_total.quantize(Decimal('0.01')),
        'grand_total': grand_total.quantize(Decimal('0.01')),
        'total_paid': total_paid.quantize(Decimal('0.01')),
        'remaining_balance': remaining_balance.quantize(Decimal('0.01')),
        'is_fully_paid': is_fully_paid,
        'items': all_items,
        'has_active_unconfirmed_orders': Order.objects.filter(
            table_session=session,
            status=OrderStatus.WAITING_CASHIER_CONFIRMATION
        ).exists()
    }

def record_cash_payment(
    *,
    session: TableSession,
    cashier_user,
    tendered_amount: Decimal,
    method: str = PaymentMethod.CASH,
    idempotency_key: str = "",
    request_id: str = ""
) -> Payment:
    """
    Records payment, computes exact change, marks session PAID and orders COMPLETED.
    Prevents duplicate payments when session balance is already $0.00.
    """
    with transaction.atomic():
        locked_session = TableSession.objects.select_for_update().get(id=session.id)
        
        # Idempotency check
        if idempotency_key:
            existing_payment = Payment.objects.filter(
                table_session=locked_session,
                idempotency_key=idempotency_key
            ).first()
            if existing_payment:
                return existing_payment

        if locked_session.status == SessionStatus.CLOSED:
            raise ValidationError("Cannot process payment for an already closed session.")

        bill = calculate_session_bill(locked_session)
        remaining_balance = bill['remaining_balance']
        
        if bill['grand_total'] <= Decimal('0.00'):
            raise ValidationError("No billable orders found for this table session.")

        # Prevent paying if already fully paid and no new orders exist
        if remaining_balance <= Decimal('0.00') or bill['is_fully_paid']:
            existing_payment = Payment.objects.filter(
                table_session=locked_session,
                status=PaymentStatus.COMPLETED
            ).last()
            if existing_payment:
                return existing_payment
            raise ValidationError("Konta meza ne'e selu hotu ona (All billable orders are already paid).")

        tendered_dec = Decimal(str(tendered_amount)).quantize(Decimal('0.01'))
        
        if method == PaymentMethod.CASH:
            if tendered_dec < remaining_balance:
                raise ValidationError(f"Tendered cash (${tendered_dec}) is less than bill total (${remaining_balance}).")
            change_amount = (tendered_dec - remaining_balance).quantize(Decimal('0.01'))
        else:
            tendered_dec = remaining_balance
            change_amount = Decimal('0.00')

        payment = Payment.objects.create(
            restaurant=locked_session.restaurant,
            table_session=locked_session,
            payment_code=generate_payment_code(),
            method=method,
            amount=remaining_balance,
            tendered_amount=tendered_dec,
            change_amount=change_amount,
            status=PaymentStatus.COMPLETED,
            received_by=cashier_user,
            paid_at=timezone.now(),
            idempotency_key=idempotency_key
        )

        # Update Session state to PAID
        locked_session.status = SessionStatus.PAID
        locked_session.paid_at = timezone.now()
        locked_session.save(update_fields=['status', 'paid_at', 'updated_at'])

        # Mark all billable orders as COMPLETED
        Order.objects.filter(
            table_session=locked_session,
            status__in=BILLABLE_ORDER_STATUSES
        ).update(status=OrderStatus.COMPLETED, updated_at=timezone.now())

        # Audit
        log_audit_event(
            actor_user=cashier_user,
            actor_role=getattr(cashier_user, 'role', 'CASHIER'),
            action='PAYMENT_COMPLETE',
            entity_type='Payment',
            entity_id=str(payment.id),
            after_data={
                'payment_code': payment.payment_code,
                'amount': str(payment.amount),
                'tendered': str(payment.tendered_amount),
                'change': str(payment.change_amount),
            },
            request_id=request_id
        )

        # Outbox event
        create_outbox_event(
            aggregate_type='PAYMENT',
            aggregate_id=payment.id,
            event_type='PAYMENT_COMPLETED',
            payload={
                'payment_id': str(payment.id),
                'payment_code': payment.payment_code,
                'session_id': str(locked_session.id),
                'session_token': locked_session.public_token,
                'table_code': locked_session.table.table_code,
                'table_name': locked_session.table.display_name,
                'amount': str(payment.amount),
                'tendered_amount': str(payment.tendered_amount),
                'change_amount': str(payment.change_amount),
                'paid_at': payment.paid_at.isoformat(),
            }
        )

        return payment
