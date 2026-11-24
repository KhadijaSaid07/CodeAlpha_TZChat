from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User, UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "location", "updated_at")
    search_fields = ("user__username", "user__full_name", "location")


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("id", "username", "full_name", "email", "phone_number", "role", "is_verified", "is_suspended")
    list_filter = ("role", "is_verified", "is_suspended", "is_active")
    search_fields = ("username", "full_name", "email", "phone_number")
    ordering = ("-date_joined",)
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Personal Info", {"fields": ("full_name", "email", "phone_number")}),
        ("Role & Permissions", {"fields": ("role", "admin_permissions", "is_active", "is_staff", "is_superuser", "is_verified", "is_suspended", "suspended_reason")}),
        ("Important Dates", {"fields": ("last_login", "date_joined")}),
    )
    readonly_fields = ("date_joined", "last_login")
