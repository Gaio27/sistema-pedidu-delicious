from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from apps.accounts.permissions import role_required
from apps.tables.models import RestaurantTable, TableSession, SessionStatus
from apps.tables.selectors import get_table_by_qr_token, get_active_session_for_table, list_tables_with_status
from apps.catalog.selectors import get_categories, get_all_menu_items
from apps.ordering.models import Order
from apps.reporting.selectors import get_dashboard_metrics
from apps.audit.selectors import get_recent_audit_events

def customer_dine_in_view(request, qr_token=None):
    table = None
    session = None
    all_tables = list_tables_with_status()

    # Find active sessions currently opened by cashier
    open_sessions = TableSession.objects.filter(
        status__in=[SessionStatus.OPEN, SessionStatus.BILL_REQUESTED, SessionStatus.PAYMENT_PENDING]
    ).select_related('table').order_by('-opened_at')
    
    active_open_tables = [s.table for s in open_sessions]

    if qr_token:
        table = get_table_by_qr_token(qr_token)
        if table:
            session = get_active_session_for_table(table)

    # If no QR code specified in URL:
    if not table:
        # 1. Automatically connect to the table opened by cashier!
        if open_sessions.exists():
            session = open_sessions.first()
            table = session.table
            qr_token = table.qr_token
        # 2. Or fallback to the first restaurant table
        elif all_tables.exists():
            table = all_tables.first()
            session = get_active_session_for_table(table)
            qr_token = table.qr_token

    categories = get_categories(active_only=True)
    
    return render(request, 'customer/index.html', {
        'table': table,
        'session': session,
        'qr_token': qr_token,
        'all_tables': all_tables,
        'active_open_tables': active_open_tables,
        'categories': categories,
    })

def customer_tracker_view(request, qr_token, order_code):
    table = get_table_by_qr_token(qr_token)
    order = get_object_or_404(Order, order_code=order_code)
    
    return render(request, 'customer/tracker.html', {
        'table': table,
        'order': order,
        'qr_token': qr_token,
    })

def cashier_portal_view(request):
    tables = list_tables_with_status()
    categories = get_categories(active_only=True)
    return render(request, 'cashier/dashboard.html', {
        'tables': tables,
        'categories': categories,
    })

def kitchen_portal_view(request):
    return render(request, 'kitchen/kds.html')

def admin_portal_view(request):
    metrics = get_dashboard_metrics()
    menu_items = get_all_menu_items()
    categories = get_categories(active_only=False)
    tables = list_tables_with_status()
    audit_events = get_recent_audit_events(limit=50)

    return render(request, 'admin_custom/dashboard.html', {
        'metrics': metrics,
        'menu_items': menu_items,
        'categories': categories,
        'tables': tables,
        'audit_events': audit_events,
    })

def qr_print_sheet_view(request):
    tables = list_tables_with_status()
    return render(request, 'admin_custom/qr_sheet.html', {
        'tables': tables,
        'host': request.get_host(),
        'scheme': request.scheme,
    })
