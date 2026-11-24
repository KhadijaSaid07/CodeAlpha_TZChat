from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from accounts.models import User
from accounts.profile_permissions import can_view_avatar
from accounts.validators import validate_image_file

from .models import Comment, Like, Post, PostImage, PostVideo
from .validators import validate_video_file


class PostAuthorSerializer(serializers.ModelSerializer):
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
        fields = ("id", "post", "author", "content", "created_at", "updated_at")
        read_only_fields = ("id", "post", "author", "created_at", "updated_at")


class LikeSerializer(serializers.ModelSerializer):
    user = PostAuthorSerializer(read_only=True)

    class Meta:
        model = Like
        fields = ("id", "user", "created_at")
