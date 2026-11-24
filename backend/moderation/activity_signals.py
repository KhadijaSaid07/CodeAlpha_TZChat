from django.db.models.signals import post_save
from django.dispatch import receiver

from accounts.models import User, UserProfile
from follows.models import Follow, Friendship
from groups.models import Group, GroupMember
from messaging.models import Message
from posts.models import Comment, Like, Post
from privacy.models import BlockedUser

from .models import AdminNotification, Report, UserActivity


def _notify_admins(notification_type: str, message: str, related_path: str = ""):
    admins = User.objects.filter(role__in=[User.ROLE_ADMIN, User.ROLE_SUPER_ADMIN], is_suspended=False)
    for adm in admins:
        AdminNotification.objects.create(
            recipient=adm,
            notification_type=notification_type,
            message=message,
            related_path=related_path,
        )


@receiver(post_save, sender=User)
def log_user_registration(sender, instance, created, **kwargs):
    if created:
        UserActivity.objects.create(
            user=instance,
            category=UserActivity.CAT_ACCOUNT,
            activity_type="user_registered",
            description=f"{instance.full_name} registered a new account.",
            related_object_type="User",
            related_object_id=str(instance.id),
        )
        _notify_admins(
            AdminNotification.TYPE_NEW_USER,
            f"New user registered: @{instance.username}",
            "/admin/users",
        )


@receiver(post_save, sender=UserProfile)
def log_profile_update(sender, instance, created, **kwargs):
    if not created:
        UserActivity.objects.create(
            user=instance.user,
            category=UserActivity.CAT_ACCOUNT,
            activity_type="profile_updated",
            description=f"@{instance.user.username} updated their profile.",
            related_object_type="UserProfile",
            related_object_id=str(instance.id),
        )


@receiver(post_save, sender=Post)
def log_post_created(sender, instance, created, **kwargs):
    if created:
        UserActivity.objects.create(
            user=instance.author,
            category=UserActivity.CAT_SOCIAL,
            activity_type="post_created",
            description=f"@{instance.author.username} created a new post.",
            related_object_type="Post",
            related_object_id=str(instance.id),
        )


@receiver(post_save, sender=Like)
def log_post_like(sender, instance, created, **kwargs):
    if created:
        UserActivity.objects.create(
            user=instance.user,
            category=UserActivity.CAT_SOCIAL,
            activity_type="post_liked",
            description=f"@{instance.user.username} liked Post #{instance.post_id}.",
            related_object_type="Post",
            related_object_id=str(instance.post_id),
        )


@receiver(post_save, sender=Comment)
def log_post_comment(sender, instance, created, **kwargs):
    if created:
        UserActivity.objects.create(
            user=instance.author,
            category=UserActivity.CAT_SOCIAL,
            activity_type="comment_added",
            description=f"@{instance.author.username} commented on Post #{instance.post_id}.",
            related_object_type="Post",
            related_object_id=str(instance.post_id),
        )


@receiver(post_save, sender=Follow)
def log_follow(sender, instance, created, **kwargs):
    if created:
        UserActivity.objects.create(
            user=instance.follower,
            category=UserActivity.CAT_SOCIAL,
            activity_type="user_followed",
            description=f"@{instance.follower.username} followed @{instance.following.username}.",
            related_object_type="User",
            related_object_id=str(instance.following_id),
        )


@receiver(post_save, sender=Friendship)
def log_friendship(sender, instance, created, **kwargs):
    if created:
        UserActivity.objects.create(
            user=instance.sender,
            category=UserActivity.CAT_SOCIAL,
            activity_type="friend_request_sent",
            description=f"@{instance.sender.username} sent a friend request to @{instance.receiver.username}.",
            related_object_type="Friendship",
            related_object_id=str(instance.id),
        )
    elif instance.status == Friendship.STATUS_ACCEPTED:
        UserActivity.objects.create(
            user=instance.receiver,
            category=UserActivity.CAT_SOCIAL,
            activity_type="friend_request_accepted",
            description=f"@{instance.receiver.username} accepted @{instance.sender.username}'s friend request.",
            related_object_type="Friendship",
            related_object_id=str(instance.id),
        )


@receiver(post_save, sender=Message)
def log_message_activity(sender, instance, created, **kwargs):
    # Record metadata count/event only — NEVER private message contents!
    if created:
        UserActivity.objects.create(
            user=instance.sender,
            category=UserActivity.CAT_MESSAGING,
            activity_type="message_sent",
            description=f"@{instance.sender.username} sent a message in Conversation #{instance.conversation_id}.",
            related_object_type="Conversation",
            related_object_id=str(instance.conversation_id),
        )


@receiver(post_save, sender=Group)
def log_group_created(sender, instance, created, **kwargs):
    if created and instance.creator:
        UserActivity.objects.create(
            user=instance.creator,
            category=UserActivity.CAT_GROUP,
            activity_type="group_created",
            description=f"@{instance.creator.username} created group '{instance.name}'.",
            related_object_type="Group",
            related_object_id=str(instance.id),
        )


@receiver(post_save, sender=GroupMember)
def log_group_joined(sender, instance, created, **kwargs):
    if created and instance.role != GroupMember.ROLE_OWNER:
        UserActivity.objects.create(
            user=instance.user,
            category=UserActivity.CAT_GROUP,
            activity_type="group_joined",
            description=f"@{instance.user.username} joined group '{instance.group.name}'.",
            related_object_type="Group",
            related_object_id=str(instance.group_id),
        )


@receiver(post_save, sender=BlockedUser)
def log_user_blocked(sender, instance, created, **kwargs):
    if created:
        UserActivity.objects.create(
            user=instance.blocker,
            category=UserActivity.CAT_SECURITY,
            activity_type="user_blocked",
            description=f"@{instance.blocker.username} blocked @{instance.blocked.username}.",
            related_object_type="User",
            related_object_id=str(instance.blocked_id),
        )


@receiver(post_save, sender=Report)
def log_report_submitted(sender, instance, created, **kwargs):
    if created:
        UserActivity.objects.create(
            user=instance.reporter,
            category=UserActivity.CAT_SECURITY,
            activity_type="report_submitted",
            description=f"@{instance.reporter.username} submitted a {instance.category} report.",
            related_object_type="Report",
            related_object_id=str(instance.id),
        )
        _notify_admins(
            AdminNotification.TYPE_NEW_REPORT,
            f"New {instance.category} report (#{instance.id}): {instance.reason}",
            "/admin/reports",
        )
