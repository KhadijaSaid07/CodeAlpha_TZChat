from rest_framework import serializers

from accounts.models import User

from .models import Follow, Friendship


class RelationshipUserSerializer(serializers.ModelSerializer):
    """Minimal user info for followers, following, and friends lists."""

    class Meta:
        model = User
        fields = ("id", "username", "full_name", "is_verified")


class FollowSerializer(serializers.ModelSerializer):
    follower = RelationshipUserSerializer(read_only=True)
    following = RelationshipUserSerializer(read_only=True)

    class Meta:
        model = Follow
        fields = ("id", "follower", "following", "status", "created_at")


class FriendshipSerializer(serializers.ModelSerializer):
    sender = RelationshipUserSerializer(read_only=True)
    receiver = RelationshipUserSerializer(read_only=True)

    class Meta:
        model = Friendship
        fields = ("id", "sender", "receiver", "status", "created_at", "updated_at")
