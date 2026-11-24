from django.conf import settings
from django.db import models


class Notification(models.Model):
    """User activity notification."""

    TYPE_FOLLOW = "follow"
    TYPE_FRIEND_REQUEST = "friend_request"
    TYPE_FRIEND_ACCEPT = "friend_accept"
    TYPE_LIKE = "like"
    TYPE_COMMENT = "comment"
    TYPE_MESSAGE_REQUEST = "message_request"
    TYPE_MESSAGE = "message"
    TYPE_GROUP_INVITE = "group_invite"
    TYPE_GROUP_UPDATE = "group_update"

    TYPE_CHOICES = [
        (TYPE_FOLLOW, "New Follower"),
        (TYPE_FRIEND_REQUEST, "Friend Request"),
        (TYPE_FRIEND_ACCEPT, "Accepted Friend Request"),
        (TYPE_LIKE, "Post Like"),
        (TYPE_COMMENT, "Post Comment"),
        (TYPE_MESSAGE_REQUEST, "Message Request"),
        (TYPE_MESSAGE, "Private Message"),
        (TYPE_GROUP_INVITE, "Group Invitation"),
        (TYPE_GROUP_UPDATE, "Group Update"),
    ]

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="triggered_notifications",
    )
    notification_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    message = models.CharField(max_length=255)
    related_object_id = models.PositiveIntegerField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Notif({self.notification_type} -> {self.recipient.username})"
