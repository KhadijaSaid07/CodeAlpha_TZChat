import os
import uuid

from django.conf import settings
from django.db import models
from django.db.models import F, Q


def message_attachment_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower() or ".bin"
    return f"messages/attachments/{uuid.uuid4().hex}{ext}"


class Conversation(models.Model):
    """Container for 1-to-1 direct chats or group chats."""

    TYPE_DIRECT = "direct"
    TYPE_GROUP = "group"
    TYPE_CHOICES = [
        (TYPE_DIRECT, "Direct"),
        (TYPE_GROUP, "Group"),
    ]

    conversation_type = models.CharField(
        max_length=20, choices=TYPE_CHOICES, default=TYPE_DIRECT
    )
    group = models.OneToOneField(
        "groups.Group",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="conversation",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Conversation({self.id}, {self.conversation_type})"


class ConversationMember(models.Model):
    """Participant in a Conversation."""

    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="members"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conversation_memberships",
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["conversation", "user"],
                name="unique_conversation_member",
            )
        ]

    def __str__(self):
        return f"{self.user.username} in Conv({self.conversation_id})"


class Message(models.Model):
    """Message inside a Conversation."""

    STATUS_SENT = "sent"
    STATUS_DELIVERED = "delivered"
    STATUS_READ = "read"
    STATUS_CHOICES = [
        (STATUS_SENT, "Sent"),
        (STATUS_DELIVERED, "Delivered"),
        (STATUS_READ, "Read"),
    ]

    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_messages",
    )
    reply_to = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replies",
    )
    content = models.TextField(blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_SENT
    )
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Msg({self.id}) by {self.sender.username}"


class MessageAttachment(models.Model):
    """Image or file attached to a Message."""

    TYPE_IMAGE = "image"
    TYPE_VIDEO = "video"
    TYPE_AUDIO = "audio"
    TYPE_FILE = "file"
    TYPE_CHOICES = [
        (TYPE_IMAGE, "Image"),
        (TYPE_VIDEO, "Video"),
        (TYPE_AUDIO, "Audio"),
        (TYPE_FILE, "File"),
    ]

    message = models.ForeignKey(
        Message, on_delete=models.CASCADE, related_name="attachments"
    )
    file = models.FileField(upload_to=message_attachment_upload_path)
    file_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_IMAGE)
    uploaded_at = models.DateTimeField(auto_now_add=True)


class MessageRequest(models.Model):
    """Message request from a user who cannot directly message the recipient."""

    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_DECLINED = "declined"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_DECLINED, "Declined"),
    ]

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_message_requests",
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_message_requests",
    )
    initial_message = models.TextField()
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=~Q(sender=F("receiver")),
                name="prevent_self_message_request",
            ),
            models.UniqueConstraint(
                fields=["sender", "receiver"],
                name="unique_message_request_pair",
            ),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"MsgReq({self.sender.username} -> {self.receiver.username}: {self.status})"
