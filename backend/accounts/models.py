import os
import uuid

from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.db import models

from .validators import normalize_phone_number


def avatar_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower() or ".jpg"
    return f"profiles/avatars/{uuid.uuid4().hex}{ext}"


def cover_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower() or ".jpg"
    return f"profiles/covers/{uuid.uuid4().hex}{ext}"


class UserManager(BaseUserManager):
    """Custom manager for TZChat User model."""

    def create_user(self, username, email, phone_number, full_name, password=None, **extra_fields):
        if not username:
            raise ValueError("Username is required.")
        if not email:
            raise ValueError("Email address is required.")
        if not phone_number:
            raise ValueError("Phone number is required.")
        if not full_name:
            raise ValueError("Full name is required.")

        user = self.model(
            username=username.strip().lower(),
            email=self.normalize_email(email).lower(),
            phone_number=normalize_phone_number(phone_number),
            full_name=full_name.strip(),
            **extra_fields,
        )
        user.set_password(password)
        user.full_clean()
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, phone_number, full_name, password=None, **extra_fields):
        extra_fields.setdefault("role", User.ROLE_SUPER_ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_verified", True)
        return self.create_user(username, email, phone_number, full_name, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Core user account for TZChat."""

    ROLE_USER = "user"
    ROLE_ADMIN = "admin"
    ROLE_SUPER_ADMIN = "super_admin"
    ROLE_CHOICES = [
        (ROLE_USER, "User"),
        (ROLE_ADMIN, "Admin"),
        (ROLE_SUPER_ADMIN, "Super Admin"),
    ]

    full_name = models.CharField(max_length=150)
    username = models.CharField(max_length=50, unique=True)
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=20, unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_USER)
    admin_permissions = models.JSONField(default=dict, blank=True)

    is_verified = models.BooleanField(default=False)
    is_suspended = models.BooleanField(default=False)
    suspended_reason = models.TextField(blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email", "phone_number", "full_name"]

    class Meta:
        ordering = ["-date_joined"]

    def save(self, *args, **kwargs):
        self.username = self.username.strip().lower()
        self.email = self.email.strip().lower()
        self.phone_number = normalize_phone_number(self.phone_number)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"@{self.username}"


class UserProfile(models.Model):
    """Extended profile details and media for a TZChat user."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    bio = models.TextField(max_length=500, blank=True)
    location = models.CharField(max_length=100, blank=True)
    profile_picture = models.ImageField(upload_to=avatar_upload_path, null=True, blank=True)
    cover_image = models.ImageField(upload_to=cover_upload_path, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile(@{self.user.username})"
