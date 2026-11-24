from django.conf import settings
from django.db import models
from django.db.models import F, Q


class Follow(models.Model):
    """One-way follow relationship between users."""

    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
    ]

    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="following_relations",
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="follower_relations",
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_ACCEPTED
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=~Q(follower=F("following")),
                name="prevent_self_follow",
            ),
            models.UniqueConstraint(
                fields=["follower", "following"],
                name="unique_follow_pair",
            ),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.follower.username} -> {self.following.username} ({self.status})"


class Friendship(models.Model):
    """Mutual friendship relationship requiring receiver acceptance."""

    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_REJECTED, "Rejected"),
    ]

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_friend_requests",
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_friend_requests",
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=~Q(sender=F("receiver")),
                name="prevent_self_friend_request",
            ),
            models.UniqueConstraint(
                fields=["sender", "receiver"],
                name="unique_friendship_pair",
            ),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.sender.username} <-> {self.receiver.username} ({self.status})"


def are_friends(user_a, user_b) -> bool:
    """Return True if two users have an accepted mutual friendship."""
    if not user_a or not user_b or not user_a.is_authenticated:
        return False
    if user_a.pk == user_b.pk:
        return True
    return Friendship.objects.filter(
        Q(sender=user_a, receiver=user_b) | Q(sender=user_b, receiver=user_a),
        status=Friendship.STATUS_ACCEPTED,
    ).exists()
