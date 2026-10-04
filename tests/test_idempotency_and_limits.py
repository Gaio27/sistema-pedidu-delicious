import pytest
from django.core.exceptions import ValidationError
from apps.ordering.services import submit_customer_order, confirm_order_by_cashier

@pytest.mark.django_db
def test_idempotent_order_submission(active_session, menu_item_fish):
    key = "idem-unique-abc-123"

    order1 = submit_customer_order(
        table_session=active_session,
        items_data=[{'menu_item_id': menu_item_fish.id, 'quantity': 2}],
        idempotency_key=key
    )

    # Submit again with same key
    order2 = submit_customer_order(
        table_session=active_session,
        items_data=[{'menu_item_id': menu_item_fish.id, 'quantity': 2}],
        idempotency_key=key
    )

    # Must return exact same order instance without duplicate creation
    assert order1.id == order2.id
    assert order1.order_code == order2.order_code

@pytest.mark.django_db
def test_pending_order_limit_per_session(active_session, menu_item_fish, menu_item_corn, cashier_user):
    # First order
    submit_customer_order(
        table_session=active_session,
        items_data=[{'menu_item_id': menu_item_fish.id, 'quantity': 1}],
        idempotency_key="batch-1"
    )

    # Attempt to submit second order while first is still WAITING_CASHIER_CONFIRMATION
    with pytest.raises(ValidationError) as exc:
        submit_customer_order(
            table_session=active_session,
            items_data=[{'menu_item_id': menu_item_corn.id, 'quantity': 1}],
            idempotency_key="batch-2"
        )
    assert "waiting for cashier verification" in str(exc.value)
