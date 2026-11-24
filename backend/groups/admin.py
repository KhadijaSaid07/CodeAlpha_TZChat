from django.contrib import admin

from .models import Group, GroupMember


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "creator", "invite_code", "created_at")
    search_fields = ("name", "creator__username")


@admin.register(GroupMember)
class GroupMemberAdmin(admin.ModelAdmin):
    list_display = ("id", "group", "user", "role", "joined_at")
    list_filter = ("role",)
    search_fields = ("group__name", "user__username")
