from rest_framework.permissions import BasePermission

from accounts.models import User


class IsSuperAdmin(BasePermission):
    """Allow access only to Super Admins."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and not request.user.is_suspended
            and request.user.role == User.ROLE_SUPER_ADMIN
        )


class IsAdminOrSuperAdmin(BasePermission):
    """Allow access to Admins and Super Admins."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and not request.user.is_suspended
            and request.user.role in (User.ROLE_ADMIN, User.ROLE_SUPER_ADMIN)
        )


def has_admin_permission(user, perm_key: str) -> bool:
    """Check whether an admin has a specific permission flag (Super Admins have all)."""
    if not user or not user.is_authenticated or user.is_suspended:
        return False
    if user.role == User.ROLE_SUPER_ADMIN:
        return True
    if user.role != User.ROLE_ADMIN:
        return False
    return bool((user.admin_permissions or {}).get(perm_key, False))
