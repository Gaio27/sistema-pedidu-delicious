import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)

class CashierConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = 'cashier_channel'
        user = self.scope.get('user')
        
        # In development / testing, allow connection; if authenticated, verify staff/cashier
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def cashier_message(self, event):
        await self.send(text_data=json.dumps({
            'event': event.get('event'),
            'data': event.get('data'),
        }))


class KitchenConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = 'kitchen_channel'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def kitchen_message(self, event):
        await self.send(text_data=json.dumps({
            'event': event.get('event'),
            'data': event.get('data'),
        }))


class CustomerConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.session_token = self.scope['url_route']['kwargs'].get('session_token')
        self.group_name = f'customer_{self.session_token}'
        
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def customer_message(self, event):
        await self.send(text_data=json.dumps({
            'event': event.get('event'),
            'data': event.get('data'),
        }))
