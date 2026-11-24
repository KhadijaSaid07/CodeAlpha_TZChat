from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from django.db.models import Q

from follows.models import Follow, Friendship

from .models import User, UserProfile
from .profile_permissions import can_view_avatar
from .validators import normalize_phone_number, validate_image_file


class UserAccountSerializer(serializers.ModelSerializer):
    """Public/current-user safe account representation."""

    profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "full_name",
            "username",
            "email",
            "phone_number",
            "role",
            "is_verified",
            "date_joined",
            "profile_picture_url",
        )
        read_only_fields = ("id", "role", "is_verified", "date_joined")

    def get_profile_picture_url(self, obj):
        profile = getattr(obj, "profile", None)
        if not profile or not profile.profile_picture:
            return None
        return f"/api/profiles/{obj.username}/avatar/"


class RegisterSerializer(serializers.ModelSerializer):
    """Validates and creates a new user account with hashed password."""

    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = (
            "full_name",
            "username",
            "email",
            "phone_number",
            "password",
            "confirm_password",
        )

    def validate_username(self, value):
        cleaned = value.strip().lower()
        if User.objects.filter(username=cleaned).exists():
            raise serializers.ValidationError("This username is already taken.")
        return cleaned

    def validate_email(self, value):
        cleaned = value.strip().lower()
        if User.objects.filter(email=cleaned).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return cleaned

    def validate_phone_number(self, value):
        try:
            cleaned = normalize_phone_number(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        if User.objects.filter(phone_number=cleaned).exists():
            raise serializers.ValidationError("An account with this phone number already exists.")
        return cleaned

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        try:
            validate_password(attrs["password"])
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    def create(self, validated_data):
        validated_data.pop("confirm_password")
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    """Authenticates a user by username or email and password."""

    identifier = serializers.CharField(help_text="Username or email address")
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        identifier = attrs["identifier"].strip().lower()
        password = attrs["password"]

        # Allow login with either username or email
        user_obj = (
            User.objects.filter(email=identifier).first()
            or User.objects.filter(username=identifier).first()
        )
        if not user_obj:
            raise serializers.ValidationError({"detail": "Invalid credentials."})

        user = authenticate(username=user_obj.username, password=password)
        if not user:
            raise serializers.ValidationError({"detail": "Invalid credentials."})

        if not user.is_active:
            raise serializers.ValidationError({"detail": "This account is inactive."})

        attrs["user"] = user
        return attrs


class LogoutSerializer(serializers.Serializer):
    """Optional refresh token in body (falls back to HttpOnly cookie)."""

    refresh = serializers.CharField(required=False, allow_blank=True)


class TokenRefreshInputSerializer(serializers.Serializer):
    """Optional refresh token in body (falls back to HttpOnly cookie)."""

    refresh = serializers.CharField(required=False, allow_blank=True)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        try:
            validate_password(attrs["new_password"])
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})
        return attrs


class EmailVerifySerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        try:
            validate_password(attrs["new_password"])
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})
        return attrs


class UserProfileSerializer(serializers.ModelSerializer):
    """Profile serializer that respects profile picture privacy."""

    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    is_verified = serializers.BooleanField(source="user.is_verified", read_only=True)
    profile_picture_url = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()
    profile_picture_visibility = serializers.CharField(
        source="user.privacy_settings.profile_picture_visibility", read_only=True
    )
    follow_status = serializers.SerializerMethodField()
    friend_status = serializers.SerializerMethodField()
    friendship_id = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = (
            "username",
            "full_name",
            "is_verified",
            "bio",
            "location",
            "profile_picture_url",
            "cover_image_url",
            "profile_picture_visibility",
            "follow_status",
            "friend_status",
            "friendship_id",
            "updated_at",
        )

    def get_follow_status(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated or request.user.pk == obj.user_id:
            return "none"
        rel = Follow.objects.filter(follower=request.user, following=obj.user).first()
        return rel.status if rel else "none"

    def _get_friendship(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated or request.user.pk == obj.user_id:
            return None
        return Friendship.objects.filter(
            Q(sender=request.user, receiver=obj.user) | Q(sender=obj.user, receiver=request.user)
        ).first()

    def get_friend_status(self, obj):
        request = self.context.get("request")
        fr = self._get_friendship(obj)
        if not fr:
            return "none"
        if fr.status == Friendship.STATUS_ACCEPTED:
            return "accepted"
        if fr.status == Friendship.STATUS_PENDING:
            return "pending_sent" if fr.sender_id == request.user.pk else "pending_received"
        return "none"

    def get_friendship_id(self, obj):
        fr = self._get_friendship(obj)
        return fr.id if fr else None

    def get_profile_picture_url(self, obj):
        request = self.context.get("request")
        viewer = request.user if request else None
        if not obj.profile_picture or not can_view_avatar(viewer, obj.user):
            return None
        return f"/api/profiles/{obj.user.username}/avatar/"

    def get_cover_image_url(self, obj):
        if not obj.cover_image:
            return None
        return obj.cover_image.url


class ProfileUpdateSerializer(serializers.Serializer):
    """Update basic user & profile fields."""

    full_name = serializers.CharField(max_length=150, required=False)
    username = serializers.CharField(max_length=50, required=False)
    bio = serializers.CharField(max_length=500, required=False, allow_blank=True)
    location = serializers.CharField(max_length=100, required=False, allow_blank=True)
    profile_picture_visibility = serializers.ChoiceField(
        choices=["everyone", "friends", "contacts", "nobody"],
        required=False,
    )

    def validate_username(self, value):
        cleaned = value.strip().lower()
        user = self.context["request"].user
        if User.objects.filter(username=cleaned).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("This username is already taken.")
        return cleaned


class ImageUploadSerializer(serializers.Serializer):
    """Validates an uploaded profile picture or cover image with Pillow."""

    image = serializers.ImageField()

    def validate_image(self, value):
        try:
            validate_image_file(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return value
