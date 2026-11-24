from rest_framework import serializers

from accounts.models import User

from .models import Notification


class NotificationActorSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "full_name")


class NotificationSerializer(serializers.ModelSerializer):
    actor = NotificationActorSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = (
            "id",
            "actor",
            "notification_type",
            "message",
            "related_object_id",
            "is_read",
            "created_at",
        )
