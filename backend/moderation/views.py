from datetime import timedelta

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User
from accounts.serializers import LoginSerializer, LogoutSerializer, UserAccountSerializer
from accounts.views import REFRESH_COOKIE_NAME, _clear_refresh_cookie, _set_refresh_cookie
from groups.models import Group
from groups.serializers import GroupSerializer
from posts.models import Post

from .audit import record_audit_log
from .models import AuditLog, Report, SystemSetting
from .pdf_utils import generate_reports_pdf
from .permissions import IsAdminOrSuperAdmin, IsSuperAdmin, has_admin_permission
from .serializers import (
    AdminPermissionsUpdateSerializer,
    AdminRoleUpdateSerializer,
    AdminUserSerializer,
    AuditLogSerializer,
    PostModerateSerializer,
    ReportCreateSerializer,
    ReportDecisionSerializer,
    ReportSerializer,
    SuspendUserSerializer,
    SystemSettingSerializer,
)


def _filter_reports_by_date(qs, request):
    period = request.query_params.get("period")
    start_str = request.query_params.get("start_date")
    end_str = request.query_params.get("end_date")
    now = timezone.now()

    if period == "day":
        qs = qs.filter(created_at__gte=now - timedelta(days=1))
    elif period == "week":
        qs = qs.filter(created_at__gte=now - timedelta(weeks=1))
    elif period == "month":
        qs = qs.filter(created_at__gte=now - timedelta(days=30))
    elif period == "year":
        qs = qs.filter(created_at__gte=now - timedelta(days=365))

    if start_str:
        start_d = parse_date(start_str)
        if start_d:
            qs = qs.filter(created_at__date__gte=start_d)
    if end_str:
        end_d = parse_date(end_str)
        if end_d:
            qs = qs.filter(created_at__date__lte=end_d)
    return qs


# ---------------------------------------------------------------------------
# User Reporting Endpoint
# ---------------------------------------------------------------------------


class SubmitReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Reports"],
        summary="Report a user or post",
        request=ReportCreateSerializer,
        responses={201: ReportSerializer},
    )
    def post(self, request):
        serializer = ReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = serializer.save(reporter=request.user)
        return Response(ReportSerializer(report).data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Admin Authentication
# ---------------------------------------------------------------------------


class AdminLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=["Administration"],
        summary="Administrator login (Admin or Super Admin only)",
        request=LoginSerializer,
        responses={200: OpenApiResponse(description="Admin login successful"), 403: OpenApiResponse(description="Not an administrator")},
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)

        user = serializer.validated_data["user"]
        if user.is_suspended or user.role not in (User.ROLE_ADMIN, User.ROLE_SUPER_ADMIN):
            record_audit_log(
                actor=user,
                action="admin_login",
                target_type="User",
                target_id=user.id,
                result=AuditLog.RESULT_FAILURE,
                metadata={"reason": "Unauthorized role or suspended"},
                request=request,
            )
            return Response(
                {"detail": "Administrator privileges required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)
        record_audit_log(
            actor=user,
            action="admin_login",
            target_type="User",
            target_id=user.id,
            result=AuditLog.RESULT_SUCCESS,
            request=request,
        )
        response = Response(
            {
                "message": "Admin login successful.",
                "user": UserAccountSerializer(user).data,
                "access": str(refresh.access_token),
            }
        )
        _set_refresh_cookie(response, str(refresh))
        return response


class AdminLogoutView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Administration"],
        summary="Administrator logout",
        request=LogoutSerializer,
        responses={200: OpenApiResponse(description="Admin logged out")},
    )
    def post(self, request):
        raw_refresh = request.COOKIES.get(REFRESH_COOKIE_NAME) or request.data.get("refresh")
        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()
            except TokenError:
                pass
        record_audit_log(
            actor=request.user,
            action="admin_logout",
            target_type="User",
            target_id=request.user.id,
            result=AuditLog.RESULT_SUCCESS,
            request=request,
        )
        response = Response({"message": "Admin logged out successfully."})
        _clear_refresh_cookie(response)
        return response


# ---------------------------------------------------------------------------
# Reports Management & PDF Export
# ---------------------------------------------------------------------------


class AdminReportListView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Reports"],
        summary="List reports (filterable by day/week/month/year or date range)",
        parameters=[
            OpenApiParameter(name="period", type=str, required=False, description="day, week, month, or year"),
            OpenApiParameter(name="start_date", type=str, required=False, description="YYYY-MM-DD"),
            OpenApiParameter(name="end_date", type=str, required=False, description="YYYY-MM-DD"),
        ],
        responses={200: ReportSerializer(many=True)},
    )
    def get(self, request):
        if not has_admin_permission(request.user, "can_view_reports"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        qs = _filter_reports_by_date(Report.objects.select_related("reporter", "reported_user", "reviewed_by"), request)
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(ReportSerializer(page, many=True).data)


class AdminReportDecisionView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Reports"],
        summary="Review, resolve, or reject a report",
        request=ReportDecisionSerializer,
        responses={200: ReportSerializer},
    )
    def post(self, request, pk):
        if not has_admin_permission(request.user, "can_view_reports"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        report = get_object_or_404(Report, pk=pk)
        serializer = ReportDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        report.status = data["status"]
        report.resolution_note = data.get("resolution_note", "")
        report.reviewed_by = request.user
        if report.status in (Report.STATUS_RESOLVED, Report.STATUS_REJECTED):
            report.resolved_at = timezone.now()
        report.save()

        if data.get("remove_post") and report.reported_post:
            report.reported_post.is_removed = True
            report.reported_post.save(update_fields=["is_removed"])

        record_audit_log(
            actor=request.user,
            action="report_resolution",
            target_type="Report",
            target_id=report.id,
            metadata={"status": report.status, "remove_post": bool(data.get("remove_post"))},
            request=request,
        )
        return Response(ReportSerializer(report).data)


class AdminReportExportPDFView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Reports"],
        summary="Download filtered reports as PDF",
        parameters=[
            OpenApiParameter(name="period", type=str, required=False),
            OpenApiParameter(name="start_date", type=str, required=False),
            OpenApiParameter(name="end_date", type=str, required=False),
        ],
        responses={200: OpenApiResponse(description="PDF file download")},
    )
    def get(self, request):
        if not has_admin_permission(request.user, "can_view_reports"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        qs = _filter_reports_by_date(Report.objects.select_related("reporter", "reported_user"), request)
        lines = [
            f"Total Reports: {qs.count()}",
            "-" * 60,
        ]
        for r in qs[:40]:
            target = r.reported_user.username if r.reported_user else f"Post#{r.reported_post_id}"
            lines.append(
                f"#{r.id} | {r.status.upper()} | {r.reason} | Target: {target} | By: @{r.reporter.username}"
            )
        pdf_bytes = generate_reports_pdf("TZChat Moderation Reports Summary", lines)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = 'attachment; filename="tzchat_reports.pdf"'
        return response


# ---------------------------------------------------------------------------
# User, Post, Group & Stats Administration
# ---------------------------------------------------------------------------


class AdminUserListView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Administration"],
        summary="List platform users",
        responses={200: AdminUserSerializer(many=True)},
    )
    def get(self, request):
        if not has_admin_permission(request.user, "can_manage_users"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        qs = User.objects.all()
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(AdminUserSerializer(page, many=True).data)


class AdminSuspendUserView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Administration"],
        summary="Suspend a user account",
        request=SuspendUserSerializer,
        responses={200: AdminUserSerializer},
    )
    def post(self, request, user_id):
        if not has_admin_permission(request.user, "can_manage_users"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        target = get_object_or_404(User, pk=user_id)
        if target.role == User.ROLE_SUPER_ADMIN:
            return Response({"detail": "Cannot suspend a Super Admin."}, status=status.HTTP_403_FORBIDDEN)
        serializer = SuspendUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target.is_suspended = True
        target.suspended_reason = serializer.validated_data["reason"]
        target.save(update_fields=["is_suspended", "suspended_reason"])
        record_audit_log(
            actor=request.user,
            action="user_suspension",
            target_type="User",
            target_id=target.id,
            metadata={"reason": target.suspended_reason},
            request=request,
        )
        return Response(AdminUserSerializer(target).data)


class AdminReactivateUserView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Administration"],
        summary="Reactivate a suspended user account",
        request=None,
        responses={200: AdminUserSerializer},
    )
    def post(self, request, user_id):
        if not has_admin_permission(request.user, "can_manage_users"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        target = get_object_or_404(User, pk=user_id)
        target.is_suspended = False
        target.suspended_reason = ""
        target.save(update_fields=["is_suspended", "suspended_reason"])
        record_audit_log(
            actor=request.user,
            action="user_reactivation",
            target_type="User",
            target_id=target.id,
            request=request,
        )
        return Response(AdminUserSerializer(target).data)


class AdminPostModerateView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Administration"],
        summary="Moderate (remove or restore) a post",
        request=PostModerateSerializer,
        responses={200: OpenApiResponse(description="Post moderation updated")},
    )
    def post(self, request, post_id):
        if not has_admin_permission(request.user, "can_moderate_posts"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        post = get_object_or_404(Post, pk=post_id)
        serializer = PostModerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        post.is_removed = serializer.validated_data["is_removed"]
        post.save(update_fields=["is_removed"])
        record_audit_log(
            actor=request.user,
            action="post_moderation",
            target_type="Post",
            target_id=post.id,
            metadata={
                "is_removed": post.is_removed,
                "reason": serializer.validated_data.get("reason", ""),
            },
            request=request,
        )
        return Response({"id": post.id, "is_removed": post.is_removed})


class AdminGroupListView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Administration"],
        summary="List groups for authorized administrators",
        responses={200: GroupSerializer(many=True)},
    )
    def get(self, request):
        if not has_admin_permission(request.user, "can_manage_groups"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        groups = Group.objects.all()
        return Response(GroupSerializer(groups, many=True, context={"request": request}).data)


class AdminStatsView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Administration"],
        summary="View platform statistics",
        responses={200: OpenApiResponse(description="Platform statistics")},
    )
    def get(self, request):
        if not has_admin_permission(request.user, "can_view_stats"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        return Response(
            {
                "total_users": User.objects.count(),
                "suspended_users": User.objects.filter(is_suspended=True).count(),
                "total_posts": Post.objects.filter(is_removed=False).count(),
                "total_groups": Group.objects.count(),
                "pending_reports": Report.objects.filter(status=Report.STATUS_PENDING).count(),
            }
        )


# ---------------------------------------------------------------------------
# Super Admin Only: Admin Role Management, System Settings & Audit Logs
# ---------------------------------------------------------------------------


class SuperAdminManageRoleView(APIView):
    permission_classes = [IsSuperAdmin]

    @extend_schema(
        tags=["Administration"],
        summary="Assign or revoke Admin role (Super Admin only)",
        request=AdminRoleUpdateSerializer,
        responses={200: AdminUserSerializer},
    )
    def post(self, request, user_id):
        target = get_object_or_404(User, pk=user_id)
        if target.pk == request.user.pk:
            return Response({"detail": "Cannot modify your own Super Admin role."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = AdminRoleUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target.role = serializer.validated_data["role"]
        target.admin_permissions = serializer.validated_data.get("admin_permissions", {})
        target.save(update_fields=["role", "admin_permissions"])
        record_audit_log(
            actor=request.user,
            action="admin_permission_change",
            target_type="User",
            target_id=target.id,
            metadata={"role": target.role, "admin_permissions": target.admin_permissions},
            request=request,
        )
        return Response(AdminUserSerializer(target).data)


class SuperAdminUpdatePermissionsView(APIView):
    permission_classes = [IsSuperAdmin]

    @extend_schema(
        tags=["Administration"],
        summary="Update an Admin's permissions (Super Admin only)",
        request=AdminPermissionsUpdateSerializer,
        responses={200: AdminUserSerializer},
    )
    def patch(self, request, user_id):
        target = get_object_or_404(User, pk=user_id, role=User.ROLE_ADMIN)
        serializer = AdminPermissionsUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target.admin_permissions = serializer.validated_data["admin_permissions"]
        target.save(update_fields=["admin_permissions"])
        record_audit_log(
            actor=request.user,
            action="admin_permission_change",
            target_type="User",
            target_id=target.id,
            metadata={"admin_permissions": target.admin_permissions},
            request=request,
        )
        return Response(AdminUserSerializer(target).data)


class SuperAdminSystemSettingsView(APIView):
    permission_classes = [IsSuperAdmin]

    @extend_schema(
        tags=["Administration"],
        summary="Get system settings (Super Admin only)",
        responses={200: SystemSettingSerializer},
    )
    def get(self, request):
        settings_obj, _ = SystemSetting.objects.get_or_create(pk=1)
        return Response(SystemSettingSerializer(settings_obj).data)

    @extend_schema(
        tags=["Administration"],
        summary="Update system settings (Super Admin only)",
        request=SystemSettingSerializer,
        responses={200: SystemSettingSerializer},
    )
    def patch(self, request):
        settings_obj, _ = SystemSetting.objects.get_or_create(pk=1)
        serializer = SystemSettingSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        record_audit_log(
            actor=request.user,
            action="system_settings_change",
            target_type="SystemSetting",
            target_id=settings_obj.id,
            metadata=serializer.validated_data,
            request=request,
        )
        return Response(serializer.data)


class AuditLogListView(APIView):
    permission_classes = [IsSuperAdmin]

    @extend_schema(
        tags=["Audit Logs"],
        summary="View immutable audit logs (Super Admin only)",
        responses={200: AuditLogSerializer(many=True)},
    )
    def get(self, request):
        qs = AuditLog.objects.select_related("actor")
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(AuditLogSerializer(page, many=True).data)
