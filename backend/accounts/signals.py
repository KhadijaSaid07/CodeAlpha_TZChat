from django.db.models.signals import post_save
from django.dispatch import receiver

from privacy.models import PrivacySetting

from .models import User, UserProfile


@receiver(post_save, sender=User)
def create_user_profile_and_privacy(sender, instance, created, **kwargs):
    """Automatically create a UserProfile and default PrivacySetting for new users."""
    if created:
        UserProfile.objects.get_or_create(user=instance)
        PrivacySetting.objects.get_or_create(user=instance)
