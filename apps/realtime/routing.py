from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'^ws/cashier/$', consumers.CashierConsumer.as_asgi()),
    re_path(r'^ws/kitchen/$', consumers.KitchenConsumer.as_asgi()),
    re_path(r'^ws/customer/(?P<session_token>[\w-]+)/$', consumers.CustomerConsumer.as_asgi()),
]
