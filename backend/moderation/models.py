from django.conf import settings
from django.db import models


class Report(models.Model):
    """User-submitted report against a user, post, comment, message, or group."""

    CATEGORY_USER = "user"
    CATEGORY_POST = "post"
    CATEGORY_COMMENT = "comment"
    CATEGORY_MESSAGE = "message"
    CATEGORY_GROUP = "group"
    CATEGORY_CHOICES = [
        (CATEGORY_USER, "User"),
        (CATEGORY_POST, "Post"),
        (CATEGORY_COMMENT, "Comment"),
        (CATEGORY_MESSAGE, "Message"),
        (CATEGORY_GROUP, "Group"),
    ]

    STATUS_PENDING = "pending"
    STATUS_UNDER_REVIEW = "under_review"
    STATUS_RESOLVED = "resolved"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_UNDER_REVIEW, "Under Review"),
        (STATUS_RESOLVED, "Resolved"),
        (STATUS_REJECTED, "Rejected"),
    ]

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="submitted_reports",
    )
    category = models.CharField(
        max_length=20, choices=CATEGORY_CHOICES, default=CATEGORY_POST
    )
    reported_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reports_against",
    )
    reported_post = models.ForeignKey(
        "posts.Post",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reports",
    )
    reported_comment = models.ForeignKey(
        "posts.Comment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reports",
    )
    reported_group = models.ForeignKey(
        "groups.Group",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reports",
    )
    reason = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    evidence_summary = models.TextField(blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_reports",
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_reports",
    )
    resolution_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Report({self.id}, {self.category}, {self.status})"


class UserActivity(models.Model):
    """Backend-generated log of user activities across TZChat (separate from AuditLog)."""

    CAT_ACCOUNT = "account"
    CAT_SOCIAL = "social"
    CAT_MESSAGING = "messaging"
    CAT_GROUP = "group"
    CAT_SECURITY = "security"
    CATEGORY_CHOICES = [
        (CAT_ACCOUNT, "Account"),
        (CAT_SOCIAL, "Social"),
        (CAT_MESSAGING, "Messaging"),
        (CAT_GROUP, "Group"),
        (CAT_SECURITY, "Security"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="activities",
    )
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    activity_type = models.CharField(max_length=60)
    description = models.CharField(max_length=255)
    related_object_type = models.CharField(max_length=50, blank=True)
    related_object_id = models.CharField(max_length=50, blank=True)
    status = models.CharField(max_length=20, default="completed")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Activity({self.user_id}, {self.activity_type})"


class AuditLog(models.Model):
    """Immutable backend-generated audit trail of administrative actions."""

    RESULT_SUCCESS = "success"
    RESULT_FAILURE = "failure"
    RESULT_CHOICES = [
        (RESULT_SUCCESS, "Success"),
        (RESULT_FAILURE, "Failure"),
    ]

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=100)
    target_type = models.CharField(max_length=50)
    target_id = models.CharField(max_length=50, blank=True)
    result = models.CharField(
        max_length=20, choices=RESULT_CHOICES, default=RESULT_SUCCESS
    )
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Audit({self.action} by {self.actor_id} -> {self.result})"


class AdminNotification(models.Model):
    """Administrative notifications for reports, registrations, and security events."""

    TYPE_NEW_REPORT = "new_report"
    TYPE_NEW_USER = "new_user"
    TYPE_ADMIN_CHANGE = "admin_change"
    TYPE_SECURITY = "security"
    TYPE_SYSTEM = "system"
    TYPE_CHOICES = [
        (TYPE_NEW_REPORT, "New Report"),
        (TYPE_NEW_USER, "New Registration"),
        (TYPE_ADMIN_CHANGE, "Admin Account Change"),
        (TYPE_SECURITY, "Security Alert"),
        (TYPE_SYSTEM, "System Notification"),
    ]

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="admin_notifications",
    )
    notification_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    message = models.CharField(max_length=255)
    related_path = models.CharField(max_length=120, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"AdminNotif({self.notification_type} -> {self.recipient_id})"


class SystemSetting(models.Model):
    """Platform-wide configuration managed by Super Admins."""

    site_name = models.CharField(max_length=100, default="TZChat")
    platform_description = models.CharField(max_length=255, default="Connect. Chat. Share.")
    allow_registration = models.BooleanField(default=True)
    require_post_moderation = models.BooleanField(default=False)
    notify_on_new_user = models.BooleanField(default=True)
    maintenance_mode = models.BooleanField(default=False)
    max_upload_mb = models.PositiveIntegerField(default=5)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"SystemSetting({self.site_name})"
