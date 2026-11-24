from follows.models import are_friends
from privacy.models import PrivacySetting, SyncedContact, is_blocked_between


def _get_privacy(user) -> PrivacySetting:
    privacy, _ = PrivacySetting.objects.get_or_create(user=user)
    return privacy


def can_view_profile(viewer, target_user) -> bool:
    """Check whether `viewer` is allowed to view `target_user`'s profile."""
    if viewer and viewer.is_authenticated and viewer.pk == target_user.pk:
        return True
    if is_blocked_between(viewer, target_user):
        return False

    privacy = _get_privacy(target_user)
    if privacy.profile_visibility == PrivacySetting.VISIBILITY_EVERYONE:
        return True
    if privacy.profile_visibility == PrivacySetting.VISIBILITY_FRIENDS:
        return are_friends(viewer, target_user)
    return False


def can_view_avatar(viewer, target_user) -> bool:
    """Check whether `viewer` is allowed to view `target_user`'s profile picture."""
    if viewer and viewer.is_authenticated and viewer.pk == target_user.pk:
        return True
    if is_blocked_between(viewer, target_user):
        return False

    privacy = _get_privacy(target_user)
    if privacy.profile_picture_visibility == PrivacySetting.VISIBILITY_EVERYONE:
        return True
    if privacy.profile_picture_visibility == PrivacySetting.VISIBILITY_FRIENDS:
        return are_friends(viewer, target_user)
    if privacy.profile_picture_visibility == PrivacySetting.VISIBILITY_CONTACTS:
        if not viewer or not viewer.is_authenticated:
            return False
        return SyncedContact.objects.filter(
            owner=target_user, phone_number=viewer.phone_number
        ).exists()
    return False
