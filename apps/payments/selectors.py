from typing import Optional
from apps.tables.models import TableSession
from .models import Payment, PaymentStatus

def get_completed_payment_for_session(session: TableSession) -> Optional[Payment]:
    return Payment.objects.filter(
        table_session=session,
        status=PaymentStatus.COMPLETED
    ).first()

def get_payment_by_code(payment_code: str) -> Optional[Payment]:
    return Payment.objects.filter(payment_code=payment_code).select_related('table_session__table', 'received_by').first()
