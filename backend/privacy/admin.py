from django.contrib import admin

from .models import BlockedUser, PrivacySetting, SyncedContact


@admin.register(PrivacySetting)
class PrivacySettingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "profile_visibility",
        "profile_picture_visibility",
        "messaging_permission",
        "following_permission",
    )
    search_fields = ("user__username",)


@admin.register(BlockedUser)
class BlockedUserAdmin(admin.ModelAdmin):
    list_display = ("id", "blocker", "blocked", "created_at")
    search_fields = ("blocker__username", "blocked__username")


@admin.register(SyncedContact)
class SyncedContactAdmin(admin.ModelAdmin):
    list_display = ("id", "owner", "phone_number", "contact_name", "created_at")
    search_fields = ("owner__username", "phone_number")
