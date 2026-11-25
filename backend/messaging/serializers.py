from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from accounts.models import User
from accounts.profile_permissions import can_view_avatar
from accounts.validators import validate_image_file

from .models import (
    Conversation,
    ConversationMember,
    Message,
    MessageAttachment,
    MessageRequest,
)


class ChatUserSerializer(serializers.ModelSerializer):
    profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "full_name", "is_verified", "profile_picture_url")

    def get_profile_picture_url(self, obj):
        request = self.context.get("request")
        viewer = request.user if request else None
        profile = getattr(obj, "profile", None)
        if not profile or not profile.profile_picture or not can_view_avatar(viewer, obj):
            return None
        url = f"/api/profiles/{obj.username}/avatar/"
        return request.build_absolute_uri(url) if request else url


class MessageAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageAttachment
        fields = ("id", "file", "file_type", "uploaded_at")


class MessageSerializer(serializers.ModelSerializer):
    sender = ChatUserSerializer(read_only=True)
    attachments = MessageAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Message
        fields = (
            "id",
            "conversation",
            "sender",
            "reply_to",
            "content",
            "status",
            "is_deleted",
            "attachments",
            "created_at",
            "updated_at",
        )


class SendMessageSerializer(serializers.Serializer):
    content = serializers.CharField(required=False, allow_blank=True, default="")
    reply_to = serializers.IntegerField(required=False, allow_null=True)
    attachment = serializers.FileField(required=False)
    file_type = serializers.ChoiceField(
        choices=["image", "video", "file"], required=False, default="image"
    )

    def validate(self, attrs):
        if not (attrs.get("content") or "").strip() and not attrs.get("attachment"):
            raise serializers.ValidationError("Message must contain text or an attachment.")
        if attrs.get("attachment") and attrs.get("file_type") == "image":
            try:
                validate_image_file(attrs["attachment"])
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"attachment": exc.messages})
        return attrs


class ConversationSerializer(serializers.ModelSerializer):
    participants = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    group_id = serializers.IntegerField(source="group.id", read_only=True, default=None)
    group_name = serializers.CharField(source="group.name", read_only=True, default=None)
    group_image = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = (
            "id",
            "conversation_type",
            "group_id",
            "group_name",
            "group_image",
            "participants",
            "last_message",
            "unread_count",
            "created_at",
            "updated_at",
        )

    def get_group_image(self, obj):
        if not obj.group or not obj.group.group_image:
            return None
        request = self.context.get("request")
        url = obj.group.group_image.url
        return request.build_absolute_uri(url) if request else url

    def get_participants(self, obj):
        users = [m.user for m in obj.members.select_related("user", "user__profile")]
        return ChatUserSerializer(users, many=True, context=self.context).data

    def get_last_message(self, obj):
        msg = obj.messages.order_by("-created_at").first()
        return MessageSerializer(msg, context=self.context).data if msg else None

    def get_unread_count(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 0
        return (
            obj.messages.exclude(sender=request.user)
            .exclude(status=Message.STATUS_READ)
            .count()
        )


class MessageRequestCreateSerializer(serializers.Serializer):
    initial_message = serializers.CharField(min_length=1)


class MessageRequestSerializer(serializers.ModelSerializer):
    sender = ChatUserSerializer(read_only=True)
    receiver = ChatUserSerializer(read_only=True)

    class Meta:
        model = MessageRequest
        fields = (
            "id",
            "sender",
            "receiver",
            "initial_message",
            "status",
            "created_at",
            "updated_at",
        )
