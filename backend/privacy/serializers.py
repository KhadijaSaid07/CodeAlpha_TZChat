from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from accounts.models import User
from accounts.validators import normalize_phone_number

from .models import BlockedUser, PrivacySetting


class PrivacySettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrivacySetting
        fields = (
            "profile_visibility",
            "profile_picture_visibility",
            "phone_visibility",
            "phone_discovery",
            "messaging_permission",
            "following_permission",
            "updated_at",
        )
        read_only_fields = ("updated_at",)


class BlockedUserItemSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="blocked.username", read_only=True)
    full_name = serializers.CharField(source="blocked.full_name", read_only=True)

    class Meta:
        model = BlockedUser
        fields = ("id", "username", "full_name", "created_at")


class ContactItemInputSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    contact_name = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_phone_number(self, value):
        try:
            return normalize_phone_number(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)


class ContactSyncSerializer(serializers.Serializer):
    permission_granted = serializers.BooleanField()
    contacts = ContactItemInputSerializer(many=True)

    def validate_permission_granted(self, value):
        if not value:
            raise serializers.ValidationError(
                "Explicit user permission is required to sync contacts."
            )
        return value


class DiscoveredUserSerializer(serializers.ModelSerializer):
    phone_number = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "full_name", "is_verified", "phone_number")

    def get_phone_number(self, obj):
        request = self.context.get("request")
        viewer = request.user if request else None
        if viewer and viewer.pk == obj.pk:
            return obj.phone_number
        privacy, _ = PrivacySetting.objects.get_or_create(user=obj)
        if privacy.phone_visibility == PrivacySetting.VISIBILITY_EVERYONE:
            return obj.phone_number
        if privacy.phone_visibility == PrivacySetting.VISIBILITY_FRIENDS:
            from follows.models import are_friends

            if are_friends(viewer, obj):
                return obj.phone_number
        return None
