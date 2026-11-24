import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone

from .models import ConversationMember, Message


class ChatConsumer(AsyncWebsocketConsumer):
    """Real-time WebSocket consumer for 1-to-1 and group conversations."""

    async def connect(self):
        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        self.room_group_name = f"chat_{self.conversation_id}"
        user = self.scope.get("user")

        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        is_member = await self._is_conversation_member(user.id, self.conversation_id)
        if not is_member:
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        event_type = data.get("type", "chat_message")
        user = self.scope["user"]

        if event_type == "typing":
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "typing_event",
                    "username": user.username,
                    "is_typing": bool(data.get("is_typing", False)),
                },
            )
        elif event_type == "read_receipt":
            await self._mark_messages_read(user.id, self.conversation_id)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "read_event",
                    "username": user.username,
                },
            )
        elif event_type == "chat_message":
            content = (data.get("content") or "").strip()
            reply_to_id = data.get("reply_to")
            if not content:
                return
            msg = await self._save_message(
                user.id, self.conversation_id, content, reply_to_id
            )
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message_event",
                    "message": msg,
                },
            )

    async def chat_message_event(self, event):
        await self.send(text_data=json.dumps({"type": "chat_message", "message": event["message"]}))

    async def typing_event(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "typing",
                    "username": event["username"],
                    "is_typing": event["is_typing"],
                }
            )
        )

    async def read_event(self, event):
        await self.send(
            text_data=json.dumps({"type": "read_receipt", "username": event["username"]})
        )

    @database_sync_to_async
    def _is_conversation_member(self, user_id: int, conversation_id: int) -> bool:
        return ConversationMember.objects.filter(
            conversation_id=conversation_id, user_id=user_id
        ).exists()

    @database_sync_to_async
    def _save_message(self, user_id: int, conversation_id: int, content: str, reply_to_id=None):
        reply_to = None
        if reply_to_id:
            reply_to = Message.objects.filter(
                pk=reply_to_id, conversation_id=conversation_id
            ).first()
        msg = Message.objects.create(
            conversation_id=conversation_id,
            sender_id=user_id,
            content=content,
            reply_to=reply_to,
        )
        return {
            "id": msg.id,
            "conversation": msg.conversation_id,
            "sender_id": msg.sender_id,
            "sender_username": msg.sender.username,
            "content": msg.content,
            "reply_to": msg.reply_to_id,
            "status": msg.status,
            "created_at": msg.created_at.isoformat(),
        }

    @database_sync_to_async
    def _mark_messages_read(self, user_id: int, conversation_id: int):
        Message.objects.filter(conversation_id=conversation_id).exclude(
            sender_id=user_id
        ).exclude(status=Message.STATUS_READ).update(status=Message.STATUS_READ)
        ConversationMember.objects.filter(
            conversation_id=conversation_id, user_id=user_id
        ).update(last_read_at=timezone.now())
