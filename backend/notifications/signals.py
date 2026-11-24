from django.db.models.signals import post_save
from django.dispatch import receiver

from follows.models import Follow, Friendship
from groups.models import Group, GroupMember
from messaging.models import ConversationMember, Message, MessageRequest
from posts.models import Comment, Like

from .models import Notification


@receiver(post_save, sender=Follow)
def notify_on_follow(sender, instance, created, **kwargs):
    if created:
        text = (
            f"@{instance.follower.username} requested to follow you."
            if instance.status == Follow.STATUS_PENDING
            else f"@{instance.follower.username} started following you."
        )
        Notification.objects.create(
            recipient=instance.following,
            actor=instance.follower,
            notification_type=Notification.TYPE_FOLLOW,
            message=text,
            related_object_id=instance.id,
        )


@receiver(post_save, sender=Friendship)
def notify_on_friendship(sender, instance, created, **kwargs):
    if created and instance.status == Friendship.STATUS_PENDING:
        Notification.objects.create(
            recipient=instance.receiver,
            actor=instance.sender,
            notification_type=Notification.TYPE_FRIEND_REQUEST,
            message=f"@{instance.sender.username} sent you a friend request.",
            related_object_id=instance.id,
        )
    elif not created and instance.status == Friendship.STATUS_ACCEPTED:
        Notification.objects.create(
            recipient=instance.sender,
            actor=instance.receiver,
            notification_type=Notification.TYPE_FRIEND_ACCEPT,
            message=f"@{instance.receiver.username} accepted your friend request.",
            related_object_id=instance.id,
        )


@receiver(post_save, sender=Like)
def notify_on_like(sender, instance, created, **kwargs):
    if created and instance.user_id != instance.post.author_id:
        Notification.objects.create(
            recipient=instance.post.author,
            actor=instance.user,
            notification_type=Notification.TYPE_LIKE,
            message=f"@{instance.user.username} liked your post.",
            related_object_id=instance.post_id,
        )


@receiver(post_save, sender=Comment)
def notify_on_comment(sender, instance, created, **kwargs):
    if created and instance.author_id != instance.post.author_id:
        Notification.objects.create(
            recipient=instance.post.author,
            actor=instance.author,
            notification_type=Notification.TYPE_COMMENT,
            message=f"@{instance.author.username} commented on your post.",
            related_object_id=instance.post_id,
        )


@receiver(post_save, sender=MessageRequest)
def notify_on_message_request(sender, instance, created, **kwargs):
    if instance.status == MessageRequest.STATUS_PENDING:
        Notification.objects.create(
            recipient=instance.receiver,
            actor=instance.sender,
            notification_type=Notification.TYPE_MESSAGE_REQUEST,
            message=f"@{instance.sender.username} sent you a message request.",
            related_object_id=instance.id,
        )


@receiver(post_save, sender=Message)
def notify_on_message(sender, instance, created, **kwargs):
    if created:
        members = ConversationMember.objects.filter(
            conversation_id=instance.conversation_id
        ).exclude(user_id=instance.sender_id)
        for member in members:
            Notification.objects.create(
                recipient=member.user,
                actor=instance.sender,
                notification_type=Notification.TYPE_MESSAGE,
                message=f"New message from @{instance.sender.username}.",
                related_object_id=instance.conversation_id,
            )


@receiver(post_save, sender=GroupMember)
def notify_on_group_member(sender, instance, created, **kwargs):
    if created and instance.role != GroupMember.ROLE_OWNER:
        Notification.objects.create(
            recipient=instance.user,
            actor=instance.group.creator,
            notification_type=Notification.TYPE_GROUP_INVITE,
            message=f"You were added to {instance.group.name}.",
            related_object_id=instance.group_id,
        )


@receiver(post_save, sender=Group)
def notify_on_group_update(sender, instance, created, **kwargs):
    if not created:
        members = GroupMember.objects.filter(group=instance).select_related("user")
        for member in members:
            Notification.objects.create(
                recipient=member.user,
                notification_type=Notification.TYPE_GROUP_UPDATE,
                message=f"Group '{instance.name}' was updated.",
                related_object_id=instance.id,
            )
