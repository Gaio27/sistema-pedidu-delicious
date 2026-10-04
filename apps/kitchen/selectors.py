from apps.ordering.models import Order, OrderStatus

def get_kitchen_queue_orders():
    """
    Returns active orders for Kitchen Display System.
    Strictly filters out WAITING_CASHIER_CONFIRMATION and REJECTED orders.
    """
    return Order.objects.filter(
        status__in=[OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY]
    ).select_related('table_session__table', 'table_session').prefetch_related('items').order_by('confirmed_at', 'created_at')
