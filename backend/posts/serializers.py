from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from rest_framework import serializers

from accounts.models import User
from accounts.profile_permissions import can_view_avatar
from accounts.validators import validate_image_file
from follows.models import Follow, Friendship

from .models import Comment, Like, Post, PostImage, PostVideo
from .validators import validate_video_file


class PostAuthorSerializer(serializers.ModelSerializer):
    profile_picture_url = serializers.SerializerMethodField()
    follow_status = serializers.SerializerMethodField()
    friend_status = serializers.SerializerMethodField()
    friendship_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "full_name",
            "is_verified",
            "profile_picture_url",
            "follow_status",
            "friend_status",
            "friendship_id",
        )

    def get_follow_status(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated or request.user.pk == obj.pk:
            return "none"
        rel = Follow.objects.filter(follower=request.user, following=obj).first()
        return rel.status if rel else "none"

    def _get_friendship(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated or request.user.pk == obj.pk:
            return None
        return Friendship.objects.filter(
            Q(sender=request.user, receiver=obj) | Q(sender=obj, receiver=request.user)
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
        profile = getattr(obj, "profile", None)
        if not profile or not profile.profile_picture or not can_view_avatar(viewer, obj):
            return None
        return f"/api/profiles/{obj.username}/avatar/"


class PostImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostImage
        fields = ("id", "image", "caption", "uploaded_at")


class PostVideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostVideo
        fields = ("id", "video", "caption", "uploaded_at")


class PostSerializer(serializers.ModelSerializer):
    author = PostAuthorSerializer(read_only=True)
    images = PostImageSerializer(many=True, read_only=True)
    videos = PostVideoSerializer(many=True, read_only=True)
    likes_count = serializers.IntegerField(source="likes.count", read_only=True)
    comments_count = serializers.IntegerField(source="comments.count", read_only=True)
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = (
            "id",
            "author",
            "content",
            "feeling",
            "visibility",
            "images",
            "videos",
            "likes_count",
            "comments_count",
            "is_liked",
            "created_at",
            "updated_at",
        )

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.likes.filter(user=request.user).exists()


class PostCreateUpdateSerializer(serializers.ModelSerializer):
    """Create or update a post (supports optional initial image or video)."""

    image = serializers.ImageField(required=False, write_only=True)
    image_caption = serializers.CharField(max_length=255, required=False, allow_blank=True, write_only=True)
    video = serializers.FileField(required=False, write_only=True)
    video_caption = serializers.CharField(max_length=255, required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Post
        fields = (
            "content",
            "feeling",
            "visibility",
            "image",
            "image_caption",
            "video",
            "video_caption",
        )

    def validate_image(self, value):
        try:
            validate_image_file(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return value

    def validate_video(self, value):
        try:
            validate_video_file(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return value

    def validate(self, attrs):
        if not self.instance:
            has_content = bool((attrs.get("content") or "").strip())
            has_media = bool(attrs.get("image") or attrs.get("video"))
            if not has_content and not has_media:
                raise serializers.ValidationError(
                    "A post must contain text content, an image, or a video."
                )
        return attrs

    def create(self, validated_data):
        image = validated_data.pop("image", None)
        image_caption = validated_data.pop("image_caption", "")
        video = validated_data.pop("video", None)
        video_caption = validated_data.pop("video_caption", "")

        post = Post.objects.create(**validated_data)
        if image:
            PostImage.objects.create(post=post, image=image, caption=image_caption)
        if video:
            PostVideo.objects.create(post=post, video=video, caption=video_caption)
        return post


class PostImageUploadSerializer(serializers.Serializer):
    image = serializers.ImageField()
    caption = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")

    def validate_image(self, value):
        try:
            validate_image_file(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return value


class PostVideoUploadSerializer(serializers.Serializer):
    video = serializers.FileField()
    caption = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")

    def validate_video(self, value):
        try:
            validate_video_file(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return value


class CommentSerializer(serializers.ModelSerializer):
    author = PostAuthorSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ("id", "post", "author", "parent", "content", "created_at", "updated_at")
        read_only_fields = ("id", "post", "author", "created_at", "updated_at")


class LikeSerializer(serializers.ModelSerializer):
    user = PostAuthorSerializer(read_only=True)

    class Meta:
        model = Like
        fields = ("id", "user", "created_at")
