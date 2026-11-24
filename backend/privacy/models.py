from django.conf import settings
from django.db import models
from django.db.models import F, Q


class PrivacySetting(models.Model):
    """Per-user privacy controls for profile, avatar, phone, messaging, and following."""

    VISIBILITY_EVERYONE = "everyone"
    VISIBILITY_FRIENDS = "friends"
    VISIBILITY_CONTACTS = "contacts"
    VISIBILITY_PRIVATE = "private"
    VISIBILITY_NOBODY = "nobody"

    PROFILE_VISIBILITY_CHOICES = [
        (VISIBILITY_EVERYONE, "Everyone"),
        (VISIBILITY_FRIENDS, "Friends only"),
        (VISIBILITY_PRIVATE, "Private"),
    ]

    AVATAR_VISIBILITY_CHOICES = [
        (VISIBILITY_EVERYONE, "Everyone"),
        (VISIBILITY_FRIENDS, "Friends only"),
        (VISIBILITY_CONTACTS, "My contacts"),
        (VISIBILITY_NOBODY, "Nobody except me"),
    ]

    PHONE_VISIBILITY_CHOICES = [
        (VISIBILITY_EVERYONE, "Everyone"),
        (VISIBILITY_FRIENDS, "Friends only"),
        (VISIBILITY_NOBODY, "Nobody"),
    ]

    PHONE_DISCOVERY_CHOICES = [
        (VISIBILITY_EVERYONE, "Everyone"),
        (VISIBILITY_CONTACTS, "My contacts"),
        (VISIBILITY_NOBODY, "Nobody"),
    ]

    MESSAGING_PERMISSION_CHOICES = [
        (VISIBILITY_EVERYONE, "Everyone"),
        (VISIBILITY_FRIENDS, "Friends only"),
        (VISIBILITY_NOBODY, "Nobody"),
    ]

    FOLLOW_PERMISSION_CHOICES = [
        (VISIBILITY_EVERYONE, "Everyone"),
        ("approval_required", "Approval required"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="privacy_settings",
    )
    profile_visibility = models.CharField(
        max_length=20, choices=PROFILE_VISIBILITY_CHOICES, default=VISIBILITY_EVERYONE
    )
    profile_picture_visibility = models.CharField(
        max_length=20, choices=AVATAR_VISIBILITY_CHOICES, default=VISIBILITY_EVERYONE
    )
    phone_visibility = models.CharField(
        max_length=20, choices=PHONE_VISIBILITY_CHOICES, default=VISIBILITY_FRIENDS
    )
    phone_discovery = models.CharField(
        max_length=20, choices=PHONE_DISCOVERY_CHOICES, default=VISIBILITY_CONTACTS
    )
    messaging_permission = models.CharField(
        max_length=20, choices=MESSAGING_PERMISSION_CHOICES, default=VISIBILITY_EVERYONE
    )
    following_permission = models.CharField(
        max_length=20, choices=FOLLOW_PERMISSION_CHOICES, default=VISIBILITY_EVERYONE
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"PrivacySetting({self.user.username})"


class BlockedUser(models.Model):
    """Represents a user blocking another user."""

    blocker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="blocked_users",
    )
    blocked = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="blocked_by",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=~Q(blocker=F("blocked")),
                name="prevent_self_block",
            ),
            models.UniqueConstraint(
                fields=["blocker", "blocked"],
                name="unique_block_pair",
            ),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.blocker.username} blocked {self.blocked.username}"


def is_blocked_between(user_a, user_b) -> bool:
    """Return True if either user has blocked the other."""
    if not user_a or not user_b or not user_a.is_authenticated:
        return False
    return BlockedUser.objects.filter(
        Q(blocker=user_a, blocked=user_b) | Q(blocker=user_b, blocked=user_a)
    ).exists()


class SyncedContact(models.Model):
    """Contact explicitly synced by a user for contact discovery and 'My contacts' privacy."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="synced_contacts",
    )
    phone_number = models.CharField(max_length=20)
    contact_name = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "phone_number"],
                name="unique_synced_contact",
            )
        ]

    def __str__(self):
        return f"{self.owner.username} -> {self.phone_number}"
