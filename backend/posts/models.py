import os
import uuid

from django.conf import settings
from django.db import models


def post_image_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower() or ".jpg"
    return f"posts/images/{uuid.uuid4().hex}{ext}"


def post_video_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower() or ".mp4"
    return f"posts/videos/{uuid.uuid4().hex}{ext}"


class Post(models.Model):
    """User post supporting text, feelings, images, and videos."""

    VISIBILITY_PUBLIC = "public"
    VISIBILITY_FRIENDS = "friends"
    VISIBILITY_PRIVATE = "private"
    VISIBILITY_CHOICES = [
        (VISIBILITY_PUBLIC, "Public"),
        (VISIBILITY_FRIENDS, "Friends"),
        (VISIBILITY_PRIVATE, "Private"),
    ]

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="posts",
    )
    content = models.TextField(blank=True)
    feeling = models.CharField(max_length=50, blank=True)
    visibility = models.CharField(
        max_length=20, choices=VISIBILITY_CHOICES, default=VISIBILITY_PUBLIC
    )
    is_removed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Post({self.id}) by @{self.author.username}"


class PostImage(models.Model):
    """Image attached to a Post."""

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to=post_image_upload_path)
    caption = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)


class PostVideo(models.Model):
    """Video with caption attached to a Post."""

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="videos")
    video = models.FileField(upload_to=post_video_upload_path)
    caption = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)


class Comment(models.Model):
    """Comment or reply on a Post."""

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="replies",
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment({self.id}) on Post({self.post_id})"


class Like(models.Model):
    """Like on a Post (one per user per post)."""

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="likes",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["post", "user"],
                name="unique_post_like",
            )
        ]

    def __str__(self):
        return f"Like({self.user.username} -> Post {self.post_id})"
