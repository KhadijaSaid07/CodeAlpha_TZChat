from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User
from config.asgi import application
from privacy.models import BlockedUser

from .models import Conversation, ConversationMember, Message


class MessagingTests(APITestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            username="amina",
            email="amina@example.com",
            phone_number="+255712111111",
            full_name="Amina Hassan",
            password="StrongPassword123!",
        )
        self.user2 = User.objects.create_user(
            username="david",
            email="david@example.com",
            phone_number="+255712222222",
            full_name="David Mwinyi",
            password="StrongPassword123!",
        )
        self.user3 = User.objects.create_user(
            username="outsider",
            email="outsider@example.com",
            phone_number="+255712333333",
            full_name="Outsider User",
            password="StrongPassword123!",
        )

    def test_direct_messaging_permissions_and_read_counts(self):
        self.client.force_authenticate(user=self.user1)
        res_conv = self.client.post(
            reverse("conversation-direct-start", kwargs={"username": "david"})
        )
        self.assertEqual(res_conv.status_code, status.HTTP_200_OK)
        conv_id = res_conv.data["id"]

        # Send message
        res_msg = self.client.post(
            reverse("conversation-messages", kwargs={"conversation_id": conv_id}),
            {"content": "Hey! How are you?"},
            format="json",
        )
        self.assertEqual(res_msg.status_code, status.HTTP_201_CREATED)

        # Outsider cannot access conversation
        self.client.force_authenticate(user=self.user3)
        res_forbid = self.client.get(
            reverse("conversation-messages", kwargs={"conversation_id": conv_id})
        )
        self.assertEqual(res_forbid.status_code, status.HTTP_403_FORBIDDEN)

        # David sees unread_count == 1, then marks read
        self.client.force_authenticate(user=self.user2)
        res_list = self.client.get(reverse("conversation-list"))
        self.assertEqual(res_list.data[0]["unread_count"], 1)

        self.client.post(reverse("conversation-read", kwargs={"conversation_id": conv_id}))
        res_list2 = self.client.get(reverse("conversation-list"))
        self.assertEqual(res_list2.data[0]["unread_count"], 0)

    def test_message_request_when_friends_only_and_block(self):
        self.user2.privacy_settings.messaging_permission = "friends"
        self.user2.privacy_settings.save()

        self.client.force_authenticate(user=self.user1)
        res_direct = self.client.post(
            reverse("conversation-direct-start", kwargs={"username": "david"})
        )
        self.assertEqual(res_direct.status_code, status.HTTP_403_FORBIDDEN)

        # Send message request
        res_req = self.client.post(
            reverse("message-request-send", kwargs={"username": "david"}),
            {"initial_message": "Hi David, let's connect!"},
            format="json",
        )
        self.assertEqual(res_req.status_code, status.HTTP_201_CREATED)
        req_id = res_req.data["id"]

        # Accept message request
        self.client.force_authenticate(user=self.user2)
        res_acc = self.client.post(
            reverse("message-request-accept", kwargs={"pk": req_id})
        )
        self.assertEqual(res_acc.status_code, status.HTTP_200_OK)
        self.assertEqual(Message.objects.count(), 1)

        # Test block sender on another request
        self.client.force_authenticate(user=self.user3)
        res_req2 = self.client.post(
            reverse("message-request-send", kwargs={"username": "david"}),
            {"initial_message": "Spam"},
            format="json",
        )
        self.client.force_authenticate(user=self.user2)
        self.client.post(
            reverse("message-request-block", kwargs={"pk": res_req2.data["id"]})
        )
        self.assertTrue(BlockedUser.objects.filter(blocker=self.user2, blocked=self.user3).exists())


class WebSocketChatTests(TransactionTestCase):
    async def test_websocket_auth_and_membership(self):
        create_user = database_sync_to_async(User.objects.create_user)
        user1 = await create_user(
            username="ws_user1",
            email="ws1@example.com",
            phone_number="+255712444441",
            full_name="WS One",
            password="StrongPassword123!",
        )
        user2 = await create_user(
            username="ws_user2",
            email="ws2@example.com",
            phone_number="+255712444442",
            full_name="WS Two",
            password="StrongPassword123!",
        )
        outsider = await create_user(
            username="ws_out",
            email="wsout@example.com",
            phone_number="+255712444443",
            full_name="WS Out",
            password="StrongPassword123!",
        )
        conv = await Conversation.objects.acreate(conversation_type=Conversation.TYPE_DIRECT)
        await ConversationMember.objects.acreate(conversation=conv, user=user1)
        await ConversationMember.objects.acreate(conversation=conv, user=user2)

        token1 = str(AccessToken.for_user(user1))
        token_out = str(AccessToken.for_user(outsider))

        # Outsider is rejected
        comm_out = WebsocketCommunicator(
            application, f"/ws/chat/{conv.id}/?token={token_out}"
        )
        connected_out, _ = await comm_out.connect()
        self.assertFalse(connected_out)

        # Member connects and sends message
        comm1 = WebsocketCommunicator(
            application, f"/ws/chat/{conv.id}/?token={token1}"
        )
        connected1, _ = await comm1.connect()
        self.assertTrue(connected1)

        await comm1.send_json_to({"type": "chat_message", "content": "Hello via WS!"})
        response = await comm1.receive_json_from()
        self.assertEqual(response["type"], "chat_message")
        self.assertEqual(response["message"]["content"], "Hello via WS!")
        await comm1.disconnect()
