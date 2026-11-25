from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from follows.models import are_friends
from privacy.models import BlockedUser, PrivacySetting, is_blocked_between

from .models import (
    Conversation,
    ConversationMember,
    Message,
    MessageAttachment,
    MessageRequest,
)
from .serializers import (
    ConversationSerializer,
    MessageRequestCreateSerializer,
    MessageRequestSerializer,
    MessageSerializer,
    SendMessageSerializer,
)


def _get_or_create_direct_conversation(user_a: User, user_b: User) -> Conversation:
    conv = (
        Conversation.objects.filter(conversation_type=Conversation.TYPE_DIRECT)
        .filter(members__user=user_a)
        .filter(members__user=user_b)
        .annotate(num_members=Count("members"))
        .filter(num_members=2)
        .first()
    )
    if conv:
        return conv
    conv = Conversation.objects.create(conversation_type=Conversation.TYPE_DIRECT)
    ConversationMember.objects.create(conversation=conv, user=user_a)
    ConversationMember.objects.create(conversation=conv, user=user_b)
    return conv


def _can_direct_message(sender: User, recipient: User) -> tuple[bool, str]:
    if is_blocked_between(sender, recipient):
        return False, "Messaging is blocked between these users."
    privacy, _ = PrivacySetting.objects.get_or_create(user=recipient)
    if privacy.messaging_permission == PrivacySetting.VISIBILITY_NOBODY:
        return False, "This user does not accept messages."
    if privacy.messaging_permission == PrivacySetting.VISIBILITY_FRIENDS and not are_friends(sender, recipient):
        return False, "Only friends can message this user directly. Send a message request instead."
    return True, ""


class DirectConversationStartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Messaging"],
        summary="Start or retrieve a 1-to-1 conversation with a user",
        request=None,
        responses={200: ConversationSerializer, 403: OpenApiResponse(description="Restricted by privacy or block")},
    )
    def post(self, request, username):
        target = get_object_or_404(User, username=username.strip().lower(), is_active=True, is_suspended=False)
        if target.pk == request.user.pk:
            return Response({"detail": "You cannot message yourself."}, status=status.HTTP_400_BAD_REQUEST)

        allowed, reason = _can_direct_message(request.user, target)
        if not allowed:
            return Response({"detail": reason}, status=status.HTTP_403_FORBIDDEN)

        conv = _get_or_create_direct_conversation(request.user, target)
        return Response(
            ConversationSerializer(conv, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class ConversationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Messaging"],
        summary="List current user's conversations with unread counts",
        responses={200: ConversationSerializer(many=True)},
    )
    def get(self, request):
        convs = (
            Conversation.objects.filter(members__user=request.user)
            .select_related("group")
            .prefetch_related("members__user__profile", "messages")
            .distinct()
            .order_by("-updated_at")
        )
        return Response(ConversationSerializer(convs, many=True, context={"request": request}).data)


class ConversationDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Messaging"],
        summary="Get conversation metadata (participants or group name)",
        responses={200: ConversationSerializer},
    )
    def get(self, request, conversation_id):
        conv = get_object_or_404(Conversation.objects.select_related("group"), pk=conversation_id)
        if not ConversationMember.objects.filter(conversation=conv, user=request.user).exists():
            return Response(
                {"detail": "You are not a participant in this conversation."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(ConversationSerializer(conv, context={"request": request}).data)


class ConversationMessagesView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _get_member_conversation(self, user, conversation_id):
        conv = get_object_or_404(Conversation, pk=conversation_id)
        if not ConversationMember.objects.filter(conversation=conv, user=user).exists():
            return None
        return conv

    @extend_schema(
        tags=["Messaging"],
        summary="Retrieve paginated messages in a conversation",
        responses={200: MessageSerializer(many=True), 403: OpenApiResponse(description="Not a participant")},
    )
    def get(self, request, conversation_id):
        conv = self._get_member_conversation(request.user, conversation_id)
        if not conv:
            return Response({"detail": "You are not a participant in this conversation."}, status=status.HTTP_403_FORBIDDEN)

        # Mark incoming sent messages as delivered
        conv.messages.exclude(sender=request.user).filter(status=Message.STATUS_SENT).update(
            status=Message.STATUS_DELIVERED
        )

        qs = conv.messages.select_related("sender", "sender__profile").prefetch_related("attachments")
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(
            MessageSerializer(page, many=True, context={"request": request}).data
        )

    @extend_schema(
        tags=["Messaging"],
        summary="Send a text or media message to a conversation",
        request=SendMessageSerializer,
        responses={201: MessageSerializer, 403: OpenApiResponse(description="Not a participant")},
    )
    def post(self, request, conversation_id):
        conv = self._get_member_conversation(request.user, conversation_id)
        if not conv:
            return Response({"detail": "You are not a participant in this conversation."}, status=status.HTTP_403_FORBIDDEN)

        if conv.conversation_type == Conversation.TYPE_GROUP and conv.group and conv.group.only_admins_can_send:
            from groups.models import GroupMember

            is_admin = GroupMember.objects.filter(
                group=conv.group,
                user=request.user,
                role__in=[GroupMember.ROLE_OWNER, GroupMember.ROLE_ADMIN],
            ).exists()
            if not is_admin:
                return Response(
                    {"detail": "Only group admins can send messages in this group."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        reply_to = None
        if data.get("reply_to"):
            reply_to = get_object_or_404(Message, pk=data["reply_to"], conversation=conv)

        msg = Message.objects.create(
            conversation=conv,
            sender=request.user,
            content=data.get("content", ""),
            reply_to=reply_to,
        )
        if data.get("attachment"):
            MessageAttachment.objects.create(
                message=msg,
                file=data["attachment"],
                file_type=data.get("file_type", "image"),
            )
        conv.save(update_fields=["updated_at"])

        serialized = MessageSerializer(msg, context={"request": request}).data
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"chat_{conv.id}",
                {"type": "chat_message_event", "message": serialized},
            )
        return Response(serialized, status=status.HTTP_201_CREATED)


class ConversationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Messaging"],
        summary="Mark all incoming messages in a conversation as read",
        request=None,
        responses={200: OpenApiResponse(description="Marked as read")},
    )
    def post(self, request, conversation_id):
        member = get_object_or_404(
            ConversationMember, conversation_id=conversation_id, user=request.user
        )
        Message.objects.filter(conversation_id=conversation_id).exclude(
            sender=request.user
        ).exclude(status=Message.STATUS_READ).update(status=Message.STATUS_READ)
        member.last_read_at = timezone.now()
        member.save(update_fields=["last_read_at"])
        return Response({"message": "Conversation marked as read."})


class MessageDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Messaging"],
        summary="Delete own message",
        responses={200: OpenApiResponse(description="Message deleted")},
    )
    def delete(self, request, message_id):
        msg = get_object_or_404(Message, pk=message_id)
        if msg.sender_id != request.user.id:
            return Response(
                {"detail": "You can only delete your own messages."},
                status=status.HTTP_403_FORBIDDEN,
            )
        msg.is_deleted = True
        msg.content = ""
        msg.save(update_fields=["is_deleted", "content", "updated_at"])
        return Response({"message": "Message deleted."})


# ---------------------------------------------------------------------------
# Message Requests
# ---------------------------------------------------------------------------


class SendMessageRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Messaging"],
        summary="Send a message request to another user",
        request=MessageRequestCreateSerializer,
        responses={201: MessageRequestSerializer},
    )
    def post(self, request, username):
        target = get_object_or_404(User, username=username.strip().lower(), is_active=True, is_suspended=False)
        if target.pk == request.user.pk:
            return Response({"detail": "You cannot send a message request to yourself."}, status=status.HTTP_400_BAD_REQUEST)
        if is_blocked_between(request.user, target):
            return Response({"detail": "You cannot message this user."}, status=status.HTTP_403_FORBIDDEN)

        privacy, _ = PrivacySetting.objects.get_or_create(user=target)
        if privacy.messaging_permission == PrivacySetting.VISIBILITY_NOBODY:
            return Response({"detail": "This user does not accept message requests."}, status=status.HTTP_403_FORBIDDEN)

        if MessageRequest.objects.filter(sender=request.user, receiver=target, status=MessageRequest.STATUS_PENDING).exists():
            return Response({"detail": "A pending message request already exists."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = MessageRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        req, _ = MessageRequest.objects.update_or_create(
            sender=request.user,
            receiver=target,
            defaults={
                "initial_message": serializer.validated_data["initial_message"],
                "status": MessageRequest.STATUS_PENDING,
            },
        )
        return Response(MessageRequestSerializer(req, context={"request": request}).data, status=status.HTTP_201_CREATED)


class IncomingMessageRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Messaging"],
        summary="List incoming pending message requests",
        responses={200: MessageRequestSerializer(many=True)},
    )
    def get(self, request):
        reqs = MessageRequest.objects.filter(receiver=request.user, status=MessageRequest.STATUS_PENDING)
        return Response(MessageRequestSerializer(reqs, many=True, context={"request": request}).data)


class OutgoingMessageRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Messaging"],
        summary="List outgoing pending message requests",
        responses={200: MessageRequestSerializer(many=True)},
    )
    def get(self, request):
        reqs = MessageRequest.objects.filter(sender=request.user, status=MessageRequest.STATUS_PENDING)
        return Response(MessageRequestSerializer(reqs, many=True, context={"request": request}).data)


class AcceptMessageRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Messaging"],
        summary="Accept a message request and open a conversation",
        request=None,
        responses={200: ConversationSerializer},
    )
    def post(self, request, pk):
        msg_req = get_object_or_404(
            MessageRequest, pk=pk, receiver=request.user, status=MessageRequest.STATUS_PENDING
        )
        msg_req.status = MessageRequest.STATUS_ACCEPTED
        msg_req.save(update_fields=["status", "updated_at"])

        conv = _get_or_create_direct_conversation(msg_req.sender, msg_req.receiver)
        Message.objects.create(
            conversation=conv,
            sender=msg_req.sender,
            content=msg_req.initial_message,
        )
        return Response(ConversationSerializer(conv, context={"request": request}).data)


class DeclineMessageRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Messaging"],
        summary="Decline a message request",
        request=None,
        responses={200: MessageRequestSerializer},
    )
    def post(self, request, pk):
        msg_req = get_object_or_404(
            MessageRequest, pk=pk, receiver=request.user, status=MessageRequest.STATUS_PENDING
        )
        msg_req.status = MessageRequest.STATUS_DECLINED
        msg_req.save(update_fields=["status", "updated_at"])
        return Response(MessageRequestSerializer(msg_req, context={"request": request}).data)


class BlockMessageRequestSenderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Messaging"],
        summary="Decline a message request and block the sender",
        request=None,
        responses={200: OpenApiResponse(description="Sender blocked")},
    )
    def post(self, request, pk):
        msg_req = get_object_or_404(
            MessageRequest, pk=pk, receiver=request.user, status=MessageRequest.STATUS_PENDING
        )
        msg_req.status = MessageRequest.STATUS_DECLINED
        msg_req.save(update_fields=["status", "updated_at"])
        BlockedUser.objects.get_or_create(blocker=request.user, blocked=msg_req.sender)
        return Response({"message": "Message request declined and sender blocked."})
