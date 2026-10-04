from typing import List, Optional
from .models import Order, OrderStatus

def get_pending_orders_for_cashier():
    return Order.objects.filter(
        status=OrderStatus.WAITING_CASHIER_CONFIRMATION
    ).select_related('table_session__table', 'table_session').prefetch_related('items__menu_item').order_by('created_at')

def get_orders_for_session(table_session_id):
    return Order.objects.filter(
        table_session_id=table_session_id
    ).prefetch_related('items').order_by('-created_at')

def get_order_by_code(order_code: str, session_token: Optional[str] = None) -> Optional[Order]:
    qs = Order.objects.filter(order_code=order_code).select_related('table_session__table').prefetch_related('items')
    if session_token:
        qs = qs.filter(table_session__public_token=session_token)
    return qs.first()
