from decimal import Decimal
from rest_framework import serializers
from apps.accounts.models import User
from apps.restaurants.models import Restaurant
from apps.tables.models import RestaurantTable, TableSession
from apps.catalog.models import Category, MenuItem
from apps.ordering.models import Order, OrderItem
from apps.payments.models import Payment

class RestaurantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Restaurant
        fields = ['id', 'name', 'legal_name', 'phone', 'address', 'currency', 'timezone', 'tax_percentage']

class MenuItemSerializer(serializers.ModelSerializer):
    display_image = serializers.ReadOnlyField()
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True)

    class Meta:
        model = MenuItem
        fields = [
            'id', 'name', 'slug', 'sku', 'description', 'price',
            'display_image', 'availability', 'is_featured', 'sort_order',
            'preparation_note', 'category_name', 'category_slug'
        ]

class CategorySerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'icon_name', 'sort_order', 'items']

    def get_items(self, obj):
        items = obj.items.filter(availability__in=['AVAILABLE', 'SOLD_OUT']).order_by('sort_order', 'name')
        return MenuItemSerializer(items, many=True).data

class RestaurantTableSerializer(serializers.ModelSerializer):
    active_session = serializers.SerializerMethodField()

    class Meta:
        model = RestaurantTable
        fields = ['id', 'table_code', 'display_name', 'capacity', 'qr_token', 'status', 'sort_order', 'active_session']

    def get_active_session(self, obj):
        from apps.tables.selectors import get_active_session_for_table
        from apps.payments.services import calculate_session_bill
        session = get_active_session_for_table(obj)
        if not session:
            return None
        bill = calculate_session_bill(session)
        return {
            'id': str(session.id),
            'public_token': session.public_token,
            'status': session.status,
            'guest_count': session.guest_count,
            'opened_at': session.opened_at,
            'bill_total': str(bill['grand_total']),
            'orders_count': bill['orders_count'],
            'has_unconfirmed': bill['has_active_unconfirmed_orders'],
        }

class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ['id', 'menu_name_snapshot', 'sku_snapshot', 'unit_price', 'quantity', 'subtotal', 'note']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    table_code = serializers.CharField(source='table_session.table.table_code', read_only=True)
    table_name = serializers.CharField(source='table_session.table.display_name', read_only=True)
    session_token = serializers.CharField(source='table_session.public_token', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'order_code', 'source', 'status', 'subtotal',
            'tax_total', 'discount_total', 'grand_total', 'customer_note',
            'rejection_reason', 'submitted_at', 'confirmed_at', 'created_at',
            'table_code', 'table_name', 'session_token', 'items'
        ]

class OrderSubmitItemSerializer(serializers.Serializer):
    menu_item_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1, max_value=99)
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)

class OrderSubmitRequestSerializer(serializers.Serializer):
    items = OrderSubmitItemSerializer(many=True)
    customer_note = serializers.CharField(required=False, allow_blank=True, max_length=1000)

class CashPaymentRequestSerializer(serializers.Serializer):
    tendered_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    method = serializers.ChoiceField(choices=['CASH', 'MANUAL_OTHER'], default='CASH')
