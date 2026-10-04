import pytest
from apps.ordering.services import submit_customer_order, confirm_order_by_cashier, reject_order_by_cashier
from apps.kitchen.selectors import get_kitchen_queue_orders

@pytest.mark.django_db
def test_cashier_gate_strictly_excludes_unconfirmed_orders(active_session, menu_item_fish, cashier_user):
    # Customer submits order
    order = submit_customer_order(
        table_session=active_session,
        items_data=[{'menu_item_id': menu_item_fish.id, 'quantity': 1}],
        idempotency_key="gate-test-1"
    )

    # Kitchen queue MUST NOT include this order while it is in WAITING_CASHIER_CONFIRMATION
    queue = get_kitchen_queue_orders()
    assert order not in queue
    assert queue.count() == 0

    # Cashier approves order
    confirm_order_by_cashier(order=order, confirmed_by=cashier_user)

    # NOW order MUST appear in kitchen queue
    queue_after_confirm = get_kitchen_queue_orders()
    assert order in queue_after_confirm
    assert queue_after_confirm.count() == 1

@pytest.mark.django_db
def test_cashier_gate_strictly_excludes_rejected_orders(active_session, menu_item_fish, cashier_user):
    order = submit_customer_order(
        table_session=active_session,
        items_data=[{'menu_item_id': menu_item_fish.id, 'quantity': 1}],
        idempotency_key="gate-test-2"
    )

    # Cashier rejects order
    reject_order_by_cashier(order=order, rejected_by=cashier_user, reason="Fake order suspected")

    # Kitchen queue MUST NOT have this order
    queue = get_kitchen_queue_orders()
    assert order not in queue
    assert queue.count() == 0
