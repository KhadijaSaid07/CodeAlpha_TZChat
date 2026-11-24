from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from accounts.models import User
from accounts.validators import validate_image_file

from .models import Group, GroupMember


class GroupMemberUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "full_name", "is_verified")


class GroupMemberSerializer(serializers.ModelSerializer):
    user = GroupMemberUserSerializer(read_only=True)

    class Meta:
        model = GroupMember
        fields = ("id", "user", "role", "joined_at")


class GroupSerializer(serializers.ModelSerializer):
    creator = GroupMemberUserSerializer(read_only=True)
    members_count = serializers.IntegerField(source="memberships.count", read_only=True)
    conversation_id = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = (
            "id",
            "name",
            "description",
            "group_image",
            "creator",
            "invite_code",
            "members_count",
            "conversation_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "creator", "invite_code", "created_at", "updated_at")

    def get_conversation_id(self, obj):
        conv = getattr(obj, "conversation", None)
        return conv.id if conv else None


class GroupCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ("name", "description", "group_image")

    def validate_group_image(self, value):
        if value:
            try:
                validate_image_file(value)
            except DjangoValidationError as exc:
                raise serializers.ValidationError(exc.messages)
        return value


class AddGroupMemberSerializer(serializers.Serializer):
    username = serializers.CharField()


class ManageAdminSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=[GroupMember.ROLE_ADMIN, GroupMember.ROLE_MEMBER])


class TransferOwnershipSerializer(serializers.Serializer):
    username = serializers.CharField()
