import os
import uuid

from django.conf import settings
from django.db import models


def group_image_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower() or ".jpg"
    return f"groups/images/{uuid.uuid4().hex}{ext}"


class Group(models.Model):
    """Group conversation metadata and shareable invite code."""

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    group_image = models.ImageField(upload_to=group_image_upload_path, null=True, blank=True)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_groups",
    )
    invite_code = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class GroupMember(models.Model):
    """Membership and role inside a Group."""

    ROLE_OWNER = "owner"
    ROLE_ADMIN = "admin"
    ROLE_MEMBER = "member"
    ROLE_CHOICES = [
        (ROLE_OWNER, "Owner"),
        (ROLE_ADMIN, "Administrator"),
        (ROLE_MEMBER, "Member"),
    ]

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="group_memberships",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["group", "user"],
                name="unique_group_member",
            )
        ]
        ordering = ["joined_at"]

    def __str__(self):
        return f"{self.user.username} in {self.group.name} ({self.role})"
