from typing import List, Optional
from .models import Category, MenuItem, ItemAvailability

def get_categories(active_only: bool = True) -> List[Category]:
    qs = Category.objects.all()
    if active_only:
        qs = qs.filter(is_active=True)
    return qs.order_by('sort_order', 'name')

def get_public_menu(category_slug: Optional[str] = None):
    qs = MenuItem.objects.filter(
        availability__in=[ItemAvailability.AVAILABLE, ItemAvailability.SOLD_OUT],
        category__is_active=True
    ).select_related('category')
    
    if category_slug:
        qs = qs.filter(category__slug=category_slug)
        
    return qs.order_by('category__sort_order', 'sort_order', 'name')

def get_all_menu_items():
    return MenuItem.objects.select_related('category').order_by('category__sort_order', 'sort_order', 'name')
