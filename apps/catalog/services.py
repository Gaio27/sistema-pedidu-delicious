from decimal import Decimal
from django.db import transaction
from .models import MenuItem, ItemAvailability

def set_menu_item_availability(*, item: MenuItem, availability: str, actor_user=None, request_id: str = "") -> MenuItem:
    with transaction.atomic():
        locked_item = MenuItem.objects.select_for_update().get(id=item.id)
        old_val = locked_item.availability
        locked_item.availability = availability
        locked_item.save(update_fields=['availability', 'updated_at'])
        
        from apps.audit.services import log_audit_event
        log_audit_event(
            actor_user=actor_user,
            actor_role=getattr(actor_user, 'role', 'ADMIN') if actor_user else 'STAFF',
            action='MENU_AVAILABILITY_CHANGE',
            entity_type='MenuItem',
            entity_id=str(locked_item.id),
            before_data={'availability': old_val},
            after_data={'availability': availability},
            request_id=request_id
        )
        return locked_item

def update_menu_item_price(*, item: MenuItem, new_price: Decimal, actor_user=None, request_id: str = "") -> MenuItem:
    with transaction.atomic():
        locked_item = MenuItem.objects.select_for_update().get(id=item.id)
        old_price = str(locked_item.price)
        locked_item.price = new_price
        locked_item.save(update_fields=['price', 'updated_at'])
        
        from apps.audit.services import log_audit_event
        log_audit_event(
            actor_user=actor_user,
            actor_role=getattr(actor_user, 'role', 'ADMIN') if actor_user else 'ADMIN',
            action='MENU_PRICE_CHANGE',
            entity_type='MenuItem',
            entity_id=str(locked_item.id),
            before_data={'price': old_price},
            after_data={'price': str(new_price)},
            request_id=request_id
        )
        return locked_item
