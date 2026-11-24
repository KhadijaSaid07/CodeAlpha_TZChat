from rest_framework import serializers

from accounts.models import User

from .models import AuditLog, Report, SystemSetting


class ReportCreateSerializer(serializers.ModelSerializer):
    reported_username = serializers.CharField(required=False, write_only=True)

    class Meta:
        model = Report
        fields = ("reported_username", "reported_post", "reason", "description")

    def validate(self, attrs):
        username = attrs.pop("reported_username", None)
        if username:
            user = User.objects.filter(username=username.strip().lower()).first()
            if not user:
                raise serializers.ValidationError({"reported_username": "User not found."})
            attrs["reported_user"] = user
        if not attrs.get("reported_user") and not attrs.get("reported_post"):
            raise serializers.ValidationError(
                "You must specify either reported_username or reported_post."
            )
        return attrs


class ReportSerializer(serializers.ModelSerializer):
    reporter_username = serializers.CharField(source="reporter.username", read_only=True)
    reported_username = serializers.CharField(
        source="reported_user.username", read_only=True, default=None
    )
    reviewed_by_username = serializers.CharField(
        source="reviewed_by.username", read_only=True, default=None
    )

    class Meta:
        model = Report
        fields = (
            "id",
            "reporter_username",
            "reported_username",
            "reported_post",
            "reason",
            "description",
            "status",
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


class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "full_name",
            "email",
            "role",
            "admin_permissions",
            "is_verified",
            "is_suspended",
            "suspended_reason",
            "date_joined",
        )


class SuspendUserSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="Policy violation")


class AdminRoleUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=[User.ROLE_USER, User.ROLE_ADMIN])
    admin_permissions = serializers.JSONField(required=False, default=dict)


class AdminPermissionsUpdateSerializer(serializers.Serializer):
    admin_permissions = serializers.JSONField()


class PostModerateSerializer(serializers.Serializer):
    is_removed = serializers.BooleanField()
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = ("site_name", "allow_registration", "maintenance_mode", "max_upload_mb", "updated_at")
        read_only_fields = ("updated_at",)


class AuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(
        source="actor.username", read_only=True, default=None
    )

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor_username",
            "action",
            "target_type",
            "target_id",
            "result",
            "metadata",
            "ip_address",
            "created_at",
        )
