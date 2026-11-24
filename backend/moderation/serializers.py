from rest_framework import serializers

from accounts.models import User

from .models import AdminNotification, AuditLog, Report, SystemSetting, UserActivity


class ReportCreateSerializer(serializers.ModelSerializer):
    reported_username = serializers.CharField(required=False, write_only=True)

    class Meta:
        model = Report
        fields = (
            "category",
            "reported_username",
            "reported_post",
            "reported_comment",
            "reported_group",
            "reason",
            "description",
            "evidence_summary",
        )

    def validate(self, attrs):
        username = attrs.pop("reported_username", None)
        if username:
            user = User.objects.filter(username=username.strip().lower()).first()
            if not user:
                raise serializers.ValidationError({"reported_username": "User not found."})
            attrs["reported_user"] = user
        if not any(
            [
                attrs.get("reported_user"),
                attrs.get("reported_post"),
                attrs.get("reported_comment"),
                attrs.get("reported_group"),
            ]
        ):
            raise serializers.ValidationError(
                "You must specify a reported user, post, comment, or group."
            )
        return attrs


class ReportSerializer(serializers.ModelSerializer):
    reporter_username = serializers.CharField(source="reporter.username", read_only=True)
    reported_username = serializers.CharField(
        source="reported_user.username", read_only=True, default=None
    )
    assigned_to_username = serializers.CharField(
        source="assigned_to.username", read_only=True, default=None
    )
    reviewed_by_username = serializers.CharField(
        source="reviewed_by.username", read_only=True, default=None
    )

    class Meta:
        model = Report
        fields = (
            "id",
            "category",
            "reporter_username",
            "reported_username",
            "reported_post",
            "reported_comment",
            "reported_group",
            "reason",
            "description",
            "evidence_summary",
            "status",
            "assigned_to",
            "assigned_to_username",
            "reviewed_by_username",
            "resolution_note",
            "created_at",
            "resolved_at",
        )


class ReportDecisionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[Report.STATUS_UNDER_REVIEW, Report.STATUS_RESOLVED, Report.STATUS_REJECTED]
    )
    resolution_note = serializers.CharField(required=False, allow_blank=True, default="")
    remove_post = serializers.BooleanField(required=False, default=False)


class ReportAssignSerializer(serializers.Serializer):
    admin_id = serializers.IntegerField()


class AdminUserSerializer(serializers.ModelSerializer):
    profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "full_name",
            "email",
            "phone_number",
            "role",
            "admin_permissions",
            "is_verified",
            "is_active",
            "is_suspended",
            "suspended_reason",
            "date_joined",
            "last_login",
            "profile_picture_url",
        )

    def get_profile_picture_url(self, obj):
        profile = getattr(obj, "profile", None)
        if not profile or not profile.profile_picture:
            return None
        return f"/api/profiles/{obj.username}/avatar/"


class SuspendUserSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True, min_length=3)


class AdminRoleUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=[User.ROLE_USER, User.ROLE_ADMIN])
    admin_permissions = serializers.JSONField(required=False, default=dict)


class AdminPermissionsUpdateSerializer(serializers.Serializer):
    admin_permissions = serializers.JSONField()


class PostModerateSerializer(serializers.Serializer):
    is_removed = serializers.BooleanField()
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class UserActivitySerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    profile_picture_url = serializers.SerializerMethodField()

    class Meta:
        model = UserActivity
        fields = (
            "id",
            "username",
            "full_name",
            "profile_picture_url",
            "category",
            "activity_type",
            "description",
            "related_object_type",
            "related_object_id",
            "status",
            "created_at",
        )

    def get_profile_picture_url(self, obj):
        profile = getattr(obj.user, "profile", None)
        if not profile or not profile.profile_picture:
            return None
        return f"/api/profiles/{obj.user.username}/avatar/"


class AdminNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminNotification
        fields = ("id", "notification_type", "message", "related_path", "is_read", "created_at")


class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = (
            "site_name",
            "platform_description",
            "allow_registration",
            "require_post_moderation",
            "notify_on_new_user",
            "maintenance_mode",
            "max_upload_mb",
            "updated_at",
        )
        read_only_fields = ("updated_at",)


class AuditLogSerializer(serializers.ModelSerializer):
    actor_id = serializers.IntegerField(source="actor.id", read_only=True, default=None)
    actor_username = serializers.CharField(source="actor.username", read_only=True, default=None)
    actor_full_name = serializers.CharField(source="actor.full_name", read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor_id",
            "actor_username",
            "actor_full_name",
            "action",
            "target_type",
            "target_id",
            "result",
            "metadata",
            "ip_address",
            "created_at",
        )
