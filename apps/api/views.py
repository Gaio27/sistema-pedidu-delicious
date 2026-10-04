import uuid
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authentication import SessionAuthentication, BasicAuthentication

from apps.accounts.permissions import IsCashierRole, IsKitchenRole, IsAdminRole, IsCashierOrAdmin, IsKitchenOrAdmin
from apps.tables.models import RestaurantTable, TableSession
from apps.tables.selectors import get_table_by_qr_token, get_session_by_public_token, list_tables_with_status
from apps.tables.services import open_table_session, close_table_session, request_bill_for_session, rotate_table_qr
from apps.catalog.selectors import get_categories, get_public_menu
from apps.catalog.models import MenuItem
from apps.catalog.services import set_menu_item_availability, update_menu_item_price
from apps.ordering.models import Order, OrderStatus
from apps.ordering.services import submit_customer_order, confirm_order_by_cashier, reject_order_by_cashier, cancel_order_by_staff
from apps.ordering.selectors import get_pending_orders_for_cashier, get_orders_for_session, get_order_by_code
from apps.kitchen.services import start_preparing_order, mark_order_ready, mark_order_served
from apps.kitchen.selectors import get_kitchen_queue_orders
from apps.payments.models import Payment, PaymentStatus
from apps.payments.services import calculate_session_bill, record_cash_payment
from apps.payments.selectors import get_completed_payment_for_session

from .serializers import (
    RestaurantTableSerializer, CategorySerializer, MenuItemSerializer,
    OrderSerializer, OrderSubmitRequestSerializer, CashPaymentRequestSerializer
)

def api_response(data=None, success=True, error=None, http_status=status.HTTP_200_OK, request_id=None):
    if request_id is None:
        request_id = str(uuid.uuid4())
    body = {
        "success": success,
        "meta": {
            "request_id": request_id,
            "timestamp": timezone.now().isoformat()
        }
    }
    if success:
        body["data"] = data
    else:
        body["error"] = error or {
            "code": "GENERAL_ERROR",
            "message": "An error occurred."
        }
    return Response(body, status=http_status)

def api_error(code, message, details=None, http_status=status.HTTP_400_BAD_REQUEST, request_id=None):
    return api_response(
        success=False,
        error={
            "code": code,
            "message": message,
            "details": details or {}
        },
        http_status=http_status,
        request_id=request_id
    )

# ==========================================
# PUBLIC API (Customer Dine-In PWA)
# ==========================================

class PublicTableResolveAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, qr_token):
        table = get_table_by_qr_token(qr_token)
        if not table:
            return api_error("TABLE_NOT_FOUND", "Meza ho QR code ne'e la hetan.", http_status=status.HTTP_404_NOT_FOUND)
        
        from apps.tables.selectors import get_active_session_for_table
        active_session = get_active_session_for_table(table)

        return api_response({
            "table": {
                "id": str(table.id),
                "table_code": table.table_code,
                "display_name": table.display_name,
                "capacity": table.capacity,
                "status": table.status,
            },
            "session": {
                "has_active_session": active_session is not None,
                "available_for_ordering": active_session is not None and active_session.is_active,
                "public_token": active_session.public_token if active_session else None,
                "status": active_session.status if active_session else None,
            }
        })


class PublicMenuAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        categories = get_categories(active_only=True)
        serializer = CategorySerializer(categories, many=True)
        return api_response(serializer.data)


class PublicOrderSubmitAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, session_token):
        session = get_session_by_public_token(session_token)
        if not session:
            return api_error("TABLE_SESSION_NOT_OPEN", "Sesi meza la hetan ka taka tiha ona.", http_status=status.HTTP_404_NOT_FOUND)

        # Device locking verification
        device_token = (
            request.headers.get('X-Device-Token') or
            request.COOKIES.get('celvass_device_id') or
            request.data.get('device_token')
        )
        if session.primary_device_token:
            if device_token and device_token != session.primary_device_token:
                return api_error("DEVICE_LOCKED", "Meza ne'e okupadu hela hosi telemóvel seluk. Ita-boot labele aumenta pedidu ba meza ne'e.", http_status=status.HTTP_403_FORBIDDEN)
        elif device_token:
            session.primary_device_token = device_token
            session.authorized_device_tokens = [device_token]
            session.save(update_fields=['primary_device_token', 'authorized_device_tokens'])

        idempotency_key = request.headers.get('Idempotency-Key') or request.data.get('idempotency_key')
        if not idempotency_key:
            return api_error("IDEMPOTENCY_KEY_REQUIRED", "Header 'Idempotency-Key' obrigatóriu atu haruka pedidu.", http_status=status.HTTP_400_BAD_REQUEST)

        serializer = OrderSubmitRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return api_error("INVALID_INPUT", "Formatu pedidu la válidu.", details=serializer.errors, http_status=status.HTTP_400_BAD_REQUEST)

        try:
            order = submit_customer_order(
                table_session=session,
                items_data=serializer.validated_data['items'],
                idempotency_key=idempotency_key,
                customer_note=serializer.validated_data.get('customer_note', ''),
                source='CUSTOMER'
            )
            order_data = OrderSerializer(order).data
            return api_response(order_data, http_status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return api_error("ORDER_VALIDATION_ERROR", str(e.message if hasattr(e, 'message') else e), http_status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return api_error("SERVER_ERROR", str(e), http_status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PublicOrderListAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, session_token):
        session = get_session_by_public_token(session_token)
        if not session:
            return api_error("TABLE_SESSION_NOT_OPEN", "Sesi meza la hetan.", http_status=status.HTTP_404_NOT_FOUND)
        
        orders = get_orders_for_session(session.id)
        serializer = OrderSerializer(orders, many=True)
        return api_response(serializer.data)


class PublicOrderDetailAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, session_token, order_code):
        order = get_order_by_code(order_code, session_token=session_token)
        if not order:
            return api_error("RESOURCE_NOT_FOUND", "Pedidu la hetan.", http_status=status.HTTP_404_NOT_FOUND)
        return api_response(OrderSerializer(order).data)


class PublicRequestBillAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, session_token):
        session = get_session_by_public_token(session_token)
        if not session:
            return api_error("TABLE_SESSION_NOT_OPEN", "Sesi meza la hetan ka taka tiha ona.", http_status=status.HTTP_404_NOT_FOUND)

        # Device locking verification
        device_token = (
            request.headers.get('X-Device-Token') or
            request.COOKIES.get('celvass_device_id') or
            request.data.get('device_token')
        )
        if session.primary_device_token and device_token and device_token != session.primary_device_token:
            return api_error("DEVICE_LOCKED", "Meza ne'e okupadu hela hosi telemóvel seluk.", http_status=status.HTTP_403_FORBIDDEN)
        
        if session.status == SessionStatus.PAID:
            bill = calculate_session_bill(session)
            return api_response({
                "status": "PAID",
                "message": "Konta ba meza ne'e selu tiha ona.",
                "bill": bill
            })

        if session.status == SessionStatus.BILL_REQUESTED:
            bill = calculate_session_bill(session)
            return api_response({
                "status": "BILL_REQUESTED",
                "message": "Konta husu tiha ona, favor hein kaixa.",
                "bill_requested_at": session.bill_requested_at,
                "bill": bill
            })

        try:
            updated_session = request_bill_for_session(session=session)
            bill = calculate_session_bill(updated_session)
            return api_response({
                "status": updated_session.status,
                "message": "Konta haruka tiha ona ba kaixa.",
                "bill_requested_at": updated_session.bill_requested_at,
                "bill": bill
            })
        except ValidationError as e:
            return api_error("BILL_REQUEST_INVALID", str(e.message if hasattr(e, 'message') else e), http_status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return api_error("SERVER_ERROR", str(e), http_status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PublicBillDetailAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, session_token):
        session = get_session_by_public_token(session_token)
        if not session:
            return api_error("TABLE_SESSION_NOT_OPEN", "Sesi meza la hetan.", http_status=status.HTTP_404_NOT_FOUND)
        
        bill = calculate_session_bill(session)
        payment = get_completed_payment_for_session(session)
        
        return api_response({
            "session_status": session.status,
            "bill": bill,
            "payment": {
                "payment_code": payment.payment_code,
                "amount": str(payment.amount),
                "tendered_amount": str(payment.tendered_amount),
                "change_amount": str(payment.change_amount),
                "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
            } if payment else None
        })


# ==========================================
# CASHIER API
# ==========================================

class CashierPendingOrdersAPIView(APIView):
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated, IsCashierOrAdmin]

    def get(self, request):
        pending_orders = get_pending_orders_for_cashier()
        serializer = OrderSerializer(pending_orders, many=True)
        return api_response(serializer.data)


class CashierConfirmOrderAPIView(APIView):
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated, IsCashierRole | IsAdminRole]

    def post(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id)
            user = request.user if request.user.is_authenticated else None
            confirmed_order = confirm_order_by_cashier(order=order, confirmed_by=user)
            return api_response(OrderSerializer(confirmed_order).data)
        except Order.DoesNotExist:
            return api_error("RESOURCE_NOT_FOUND", "Pedidu la hetan.", http_status=status.HTTP_404_NOT_FOUND)
        except ValidationError as e:
            return api_error("ORDER_INVALID_STATE", str(e.message if hasattr(e, 'message') else e), http_status=status.HTTP_400_BAD_REQUEST)


class CashierRejectOrderAPIView(APIView):
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated, IsCashierRole | IsAdminRole]

    def post(self, request, order_id):
        reason = request.data.get('reason', '').strip()
        if not reason:
            return api_error("INVALID_INPUT", "Razaun rekuza pedidu obrigatóriu atu preenxe.", http_status=status.HTTP_400_BAD_REQUEST)
        
        try:
            order = Order.objects.get(id=order_id)
            user = request.user if request.user.is_authenticated else None
            rejected_order = reject_order_by_cashier(order=order, rejected_by=user, reason=reason)
            return api_response(OrderSerializer(rejected_order).data)
        except Order.DoesNotExist:
            return api_error("RESOURCE_NOT_FOUND", "Pedidu la hetan.", http_status=status.HTTP_404_NOT_FOUND)
        except ValidationError as e:
            return api_error("ORDER_INVALID_STATE", str(e.message if hasattr(e, 'message') else e), http_status=status.HTTP_400_BAD_REQUEST)


class CashierTablesListAPIView(APIView):
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated, IsCashierRole | IsAdminRole]

    def get(self, request):
        tables = list_tables_with_status()
        serializer = RestaurantTableSerializer(tables, many=True)
        return api_response(serializer.data)


class CashierOpenTableSessionAPIView(APIView):
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated, IsCashierRole | IsAdminRole]

    def post(self, request, table_id):
        guest_count = int(request.data.get('guest_count', 1))
        try:
            table = RestaurantTable.objects.get(id=table_id)
            user = request.user if request.user.is_authenticated else None
            session = open_table_session(table=table, opened_by=user, guest_count=guest_count)
            return api_response({
                "session_id": str(session.id),
                "public_token": session.public_token,
                "status": session.status,
                "table_code": table.table_code,
                "guest_count": session.guest_count,
            }, http_status=status.HTTP_201_CREATED)
        except RestaurantTable.DoesNotExist:
            return api_error("RESOURCE_NOT_FOUND", "Meza la hetan.", http_status=status.HTTP_404_NOT_FOUND)
        except ValidationError as e:
            return api_error("TABLE_SESSION_ALREADY_OPEN", str(e.message if hasattr(e, 'message') else e), http_status=status.HTTP_400_BAD_REQUEST)


class CashierCloseTableSessionAPIView(APIView):
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated, IsCashierRole | IsAdminRole]

    def post(self, request, session_id):
        reason = request.data.get('reason', 'Completed')
        try:
            session = TableSession.objects.get(id=session_id)
            user = request.user if request.user.is_authenticated else None
            closed_session = close_table_session(session=session, closed_by=user, reason=reason)
            return api_response({
                "session_id": str(closed_session.id),
                "status": closed_session.status,
                "closed_at": closed_session.closed_at,
            })
        except TableSession.DoesNotExist:
            return api_error("RESOURCE_NOT_FOUND", "Sesi meza la hetan.", http_status=status.HTTP_404_NOT_FOUND)


class CashierPaymentAPIView(APIView):
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated, IsCashierRole | IsAdminRole]

    def get(self, request, session_id):
        try:
            session = TableSession.objects.get(id=session_id)
            bill = calculate_session_bill(session)
            last_payment = Payment.objects.filter(table_session=session, status=PaymentStatus.COMPLETED).last()
            if not last_payment:
                return api_error("NO_PAYMENT_FOUND", "Seidauk iha pagamentu ba sesi ne'e.", http_status=status.HTTP_404_NOT_FOUND)
            return api_response({
                "payment_code": last_payment.payment_code,
                "amount": str(last_payment.amount),
                "tendered_amount": str(last_payment.tendered_amount),
                "change_amount": str(last_payment.change_amount),
                "paid_at": last_payment.paid_at,
                "table_name": session.table.display_name,
                "table_code": session.table.table_code,
                "items": bill.get("items", []),
                "subtotal": str(bill.get("subtotal", last_payment.amount)),
            })
        except TableSession.DoesNotExist:
            return api_error("RESOURCE_NOT_FOUND", "Sesi meza la hetan.", http_status=status.HTTP_404_NOT_FOUND)

    def post(self, request, session_id):
        serializer = CashPaymentRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return api_error("INVALID_INPUT", "Formatu pagamentu la válidu.", details=serializer.errors)

        idempotency_key = request.headers.get('Idempotency-Key') or request.data.get('idempotency_key', '')

        try:
            session = TableSession.objects.get(id=session_id)
            user = request.user if request.user.is_authenticated else None
            payment = record_cash_payment(
                session=session,
                cashier_user=user,
                tendered_amount=serializer.validated_data['tendered_amount'],
                method=serializer.validated_data['method'],
                idempotency_key=idempotency_key
            )
            bill = calculate_session_bill(session)
            return api_response({
                "payment_code": payment.payment_code,
                "amount": str(payment.amount),
                "tendered_amount": str(payment.tendered_amount),
                "change_amount": str(payment.change_amount),
                "status": payment.status,
                "paid_at": payment.paid_at,
                "table_name": session.table.display_name,
                "table_code": session.table.table_code,
                "items": bill.get("items", []),
                "subtotal": str(bill.get("subtotal", payment.amount)),
            }, http_status=status.HTTP_201_CREATED)
        except TableSession.DoesNotExist:
            return api_error("RESOURCE_NOT_FOUND", "Sesi meza la hetan.", http_status=status.HTTP_404_NOT_FOUND)
        except ValidationError as e:
            return api_error("PAYMENT_ERROR", str(e.message if hasattr(e, 'message') else e), http_status=status.HTTP_400_BAD_REQUEST)


# ==========================================
# KITCHEN API
# ==========================================

class KitchenQueueAPIView(APIView):
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated, IsKitchenOrAdmin | IsCashierRole]

    def get(self, request):
        queue = get_kitchen_queue_orders()
        serializer = OrderSerializer(queue, many=True)
        return api_response(serializer.data)


class KitchenStartOrderAPIView(APIView):
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated, IsKitchenOrAdmin]

    def post(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id)
            user = request.user if request.user.is_authenticated else None
            prep_order = start_preparing_order(order=order, staff_user=user)
            return api_response(OrderSerializer(prep_order).data)
        except Order.DoesNotExist:
            return api_error("RESOURCE_NOT_FOUND", "Pedidu la hetan.", http_status=status.HTTP_404_NOT_FOUND)
        except ValidationError as e:
            return api_error("ORDER_INVALID_STATE", str(e.message if hasattr(e, 'message') else e), http_status=status.HTTP_400_BAD_REQUEST)


class KitchenReadyOrderAPIView(APIView):
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated, IsKitchenRole | IsAdminRole]

    def post(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id)
            user = request.user if request.user.is_authenticated else None
            ready_order = mark_order_ready(order=order, staff_user=user)
            return api_response(OrderSerializer(ready_order).data)
        except Order.DoesNotExist:
            return api_error("RESOURCE_NOT_FOUND", "Pedidu la hetan.", http_status=status.HTTP_404_NOT_FOUND)
        except ValidationError as e:
            return api_error("ORDER_INVALID_STATE", str(e.message if hasattr(e, 'message') else e), http_status=status.HTTP_400_BAD_REQUEST)


class KitchenServedOrderAPIView(APIView):
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated, IsKitchenRole | IsAdminRole]

    def post(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id)
            user = request.user if request.user.is_authenticated else None
            served_order = mark_order_served(order=order, staff_user=user)
            return api_response(OrderSerializer(served_order).data)
        except Order.DoesNotExist:
            return api_error("RESOURCE_NOT_FOUND", "Pedidu la hetan.", http_status=status.HTTP_404_NOT_FOUND)
        except ValidationError as e:
            return api_error("ORDER_INVALID_STATE", str(e.message if hasattr(e, 'message') else e), http_status=status.HTTP_400_BAD_REQUEST)


# ==========================================
# ADMIN API
# ==========================================

class AdminToggleMenuItemAvailabilityAPIView(APIView):
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request, item_id):
        try:
            item = MenuItem.objects.get(id=item_id)
            target = request.data.get('availability')
            if not target:
                target = 'SOLD_OUT' if item.availability == 'AVAILABLE' else 'AVAILABLE'
            
            user = request.user if request.user.is_authenticated else None
            updated = set_menu_item_availability(item=item, availability=target, actor_user=user)
            return api_response(MenuItemSerializer(updated).data)
        except MenuItem.DoesNotExist:
            return api_error("RESOURCE_NOT_FOUND", "Item menu la hetan.", http_status=status.HTTP_404_NOT_FOUND)


class AdminRotateTableQRAPIView(APIView):
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request, table_id):
        try:
            table = RestaurantTable.objects.get(id=table_id)
            user = request.user if request.user.is_authenticated else None
            new_token = rotate_table_qr(table=table, actor_user=user)
            return api_response({"new_qr_token": new_token, "table_code": table.table_code})
        except RestaurantTable.DoesNotExist:
            return api_error("RESOURCE_NOT_FOUND", "Meza la hetan.", http_status=status.HTTP_404_NOT_FOUND)


class CashierOrdersHistoryAPIView(APIView):
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated, IsCashierOrAdmin]

    def get(self, request):
        today = timezone.localdate()
        orders = Order.objects.filter(
            created_at__date=today
        ).select_related('table_session__table').prefetch_related('items').order_by('-created_at')[:100]

        data = []
        for o in orders:
            data.append({
                'id': str(o.id),
                'order_code': o.order_code,
                'table_name': o.table_session.table.display_name,
                'table_code': o.table_session.table.table_code,
                'status': o.status,
                'grand_total': str(o.grand_total),
                'items_summary': ", ".join([f"{item.quantity}x {item.menu_name_snapshot}" for item in o.items.all()]),
                'created_at': o.created_at.strftime("%H:%M"),
            })
        return api_response(data)


class CashierShiftSummaryAPIView(APIView):
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated, IsCashierOrAdmin]

    def get(self, request):
        from django.db import models
        today = timezone.localdate()
        from apps.payments.models import Payment, PaymentMethod, PaymentStatus
        payments_today = Payment.objects.filter(paid_at__date=today, status=PaymentStatus.COMPLETED)

        cash_total = payments_today.filter(method=PaymentMethod.CASH).aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')
        other_total = payments_today.exclude(method=PaymentMethod.CASH).aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')
        grand_total = cash_total + other_total

        completed_orders_count = Order.objects.filter(created_at__date=today, status=OrderStatus.COMPLETED).count()
        paid_sessions_count = TableSession.objects.filter(paid_at__date=today).count()

        return api_response({
            'cash_total': str(cash_total.quantize(Decimal('0.01'))),
            'other_total': str(other_total.quantize(Decimal('0.01'))),
            'grand_total': str(grand_total.quantize(Decimal('0.01'))),
            'payments_count': payments_today.count(),
            'paid_sessions_count': paid_sessions_count,
            'completed_orders_count': completed_orders_count,
            'timestamp': timezone.now().strftime("%d/%m/%Y %H:%M"),
        })


class AdminUserCreateAPIView(APIView):
    authentication_classes = [SessionAuthentication, BasicAuthentication]
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '').strip()
        role = request.data.get('role', 'CASHIER').upper()
        first_name = request.data.get('first_name', '').strip()

        if not username or not password:
            return api_error("INVALID_INPUT", "Naran-uzuáriu no liafuan xave obrigatóriu.")

        if role not in ['CASHIER', 'KITCHEN', 'ADMIN']:
            return api_error("INVALID_ROLE", "Papél la válidu.")

        from apps.accounts.models import User
        if User.objects.filter(username=username).exists():
            return api_error("USER_EXISTS", "Naran-uzuáriu ne'e eziste ona.")

        user = User.objects.create_user(
            username=username,
            password=password,
            role=role,
            first_name=first_name,
            restaurant=getattr(request.user, 'restaurant', None)
        )
        return api_response({
            'id': str(user.id),
            'username': user.username,
            'role': user.role,
            'first_name': user.first_name,
        }, http_status=status.HTTP_201_CREATED)
