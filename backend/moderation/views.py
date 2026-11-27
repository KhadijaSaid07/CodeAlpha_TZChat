from datetime import timedelta

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count, Q
from django.db.models.functions import TruncDay, TruncMonth
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
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User
from accounts.serializers import LoginSerializer, LogoutSerializer, UserAccountSerializer
from accounts.views import REFRESH_COOKIE_NAME, _clear_refresh_cookie, _set_refresh_cookie
from follows.models import Follow
from groups.models import Group, GroupMember
from groups.serializers import GroupMemberSerializer, GroupSerializer
from messaging.models import Message
from posts.models import Comment, Like, Post
from posts.serializers import PostSerializer

from .audit import record_audit_log
from .models import AdminNotification, AuditLog, Report, SystemSetting, UserActivity
from .pdf_utils import generate_reports_pdf
from .permissions import IsAdminOrSuperAdmin, IsSuperAdmin, has_admin_permission
from .serializers import (
    AdminNotificationSerializer,
    AdminPermissionsUpdateSerializer,
    AdminRoleUpdateSerializer,
    AdminUserSerializer,
    AuditLogSerializer,
    PostModerateSerializer,
    ReportAssignSerializer,
    ReportCreateSerializer,
    ReportDecisionSerializer,
    ReportSerializer,
    SuspendUserSerializer,
    SystemSettingSerializer,
    UserActivitySerializer,
)


def _filter_by_date(qs, request, field="created_at"):
    period = request.query_params.get("period")
    start_str = request.query_params.get("start_date")
    end_str = request.query_params.get("end_date")
    now = timezone.now()

    if period == "day":
        qs = qs.filter(**{f"{field}__gte": now - timedelta(days=1)})
    elif period == "week":
        qs = qs.filter(**{f"{field}__gte": now - timedelta(weeks=1)})
    elif period == "month":
        qs = qs.filter(**{f"{field}__gte": now - timedelta(days=30)})
    elif period == "year":
        qs = qs.filter(**{f"{field}__gte": now - timedelta(days=365)})

    if start_str:
        start_d = parse_date(start_str)
        if start_d:
            qs = qs.filter(**{f"{field}__date__gte": start_d})
    if end_str:
        end_d = parse_date(end_str)
        if end_d:
            qs = qs.filter(**{f"{field}__date__lte": end_d})
    return qs


# ---------------------------------------------------------------------------
# User Reporting Endpoint
# ---------------------------------------------------------------------------


class SubmitReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Reports"],
        summary="Report a user, post, comment, message, or group",
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
        summary="List reports (filterable by category, status, date, and search)",
        parameters=[
            OpenApiParameter(name="category", type=str, required=False),
            OpenApiParameter(name="status", type=str, required=False),
            OpenApiParameter(name="q", type=str, required=False),
            OpenApiParameter(name="period", type=str, required=False),
            OpenApiParameter(name="start_date", type=str, required=False),
            OpenApiParameter(name="end_date", type=str, required=False),
        ],
        responses={200: ReportSerializer(many=True)},
    )
    def get(self, request):
        if not has_admin_permission(request.user, "can_view_reports"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        qs = Report.objects.select_related("reporter", "reported_user", "assigned_to", "reviewed_by")
        qs = _filter_by_date(qs, request)

        category = request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        rep_status = request.query_params.get("status")
        if rep_status:
            qs = qs.filter(status=rep_status)
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(reason__icontains=q)
                | Q(description__icontains=q)
                | Q(reporter__username__icontains=q)
                | Q(reported_user__username__icontains=q)
            )

        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(ReportSerializer(page, many=True).data)


class AdminReportAssignView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Reports"],
        summary="Assign a report to an administrator",
        request=ReportAssignSerializer,
        responses={200: ReportSerializer},
    )
    def post(self, request, pk):
        if not has_admin_permission(request.user, "can_view_reports"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        report = get_object_or_404(Report, pk=pk)
        serializer = ReportAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignee = get_object_or_404(
            User,
            pk=serializer.validated_data["admin_id"],
            role__in=[User.ROLE_ADMIN, User.ROLE_SUPER_ADMIN],
        )
        report.assigned_to = assignee
        if report.status == Report.STATUS_PENDING:
            report.status = Report.STATUS_UNDER_REVIEW
        report.save(update_fields=["assigned_to", "status"])
        record_audit_log(
            actor=request.user,
            action="report_assigned",
            target_type="Report",
            target_id=report.id,
            metadata={"assigned_to": assignee.username},
            request=request,
        )
        return Response(ReportSerializer(report).data)


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

        action_name = "report_rejection" if report.status == Report.STATUS_REJECTED else "report_resolution"
        record_audit_log(
            actor=request.user,
            action=action_name,
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
        responses={200: OpenApiResponse(description="PDF file download")},
    )
    def get(self, request):
        if not has_admin_permission(request.user, "can_view_reports"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        qs = _filter_by_date(Report.objects.select_related("reporter", "reported_user"), request)
        category = request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        rep_status = request.query_params.get("status")
        if rep_status:
            qs = qs.filter(status=rep_status)

        lines = [
            f"Generated By: @{request.user.username} | Total Matching Reports: {qs.count()}",
            f"Pending: {qs.filter(status=Report.STATUS_PENDING).count()} | Resolved: {qs.filter(status=Report.STATUS_RESOLVED).count()} | Rejected: {qs.filter(status=Report.STATUS_REJECTED).count()}",
            "-" * 70,
        ]
        for r in qs[:40]:
            target = r.reported_user.username if r.reported_user else f"{r.category}#{r.reported_post_id or r.reported_group_id or r.id}"
            lines.append(
                f"#{r.id} [{r.category.upper()}] {r.status.upper()} | {r.reason} | Target: {target} | By: @{r.reporter.username}"
            )
        pdf_bytes = generate_reports_pdf("TZChat Moderation Reports Summary", lines)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = 'attachment; filename="tzchat_reports.pdf"'
        return response


# ---------------------------------------------------------------------------
# User Management
# ---------------------------------------------------------------------------


class AdminUserListView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Administration"],
        summary="List, search, filter, sort, or create platform users",
        responses={200: AdminUserSerializer(many=True)},
    )
    def get(self, request):
        if not has_admin_permission(request.user, "can_manage_users"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        qs = User.objects.select_related("profile")
        qs = _filter_by_date(qs, request, field="date_joined")

        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(username__icontains=q) | Q(full_name__icontains=q) | Q(email__icontains=q)
            )
        status_filter = request.query_params.get("status")
        if status_filter == "active":
            qs = qs.filter(is_suspended=False, is_active=True)
        elif status_filter == "suspended":
            qs = qs.filter(is_suspended=True)
        elif status_filter == "admins":
            qs = qs.filter(role__in=[User.ROLE_ADMIN, User.ROLE_SUPER_ADMIN])

        sort = request.query_params.get("sort", "newest")
        if sort == "oldest":
            qs = qs.order_by("date_joined")
        elif sort == "username":
            qs = qs.order_by("username")
        else:
            qs = qs.order_by("-date_joined")

        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(AdminUserSerializer(page, many=True).data)

    @extend_schema(
        tags=["Administration"],
        summary="Create a new user or admin (Super Admin for admin roles)",
        responses={201: AdminUserSerializer},
    )
    def post(self, request):
        if not has_admin_permission(request.user, "can_manage_users"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        data = request.data
        role = data.get("role", User.ROLE_USER)
        if role != User.ROLE_USER and request.user.role != User.ROLE_SUPER_ADMIN:
            return Response({"detail": "Only Super Admin can create admin accounts."}, status=status.HTTP_403_FORBIDDEN)
        user = User.objects.create_user(
            username=data["username"],
            email=data["email"],
            phone_number=data["phone_number"],
            full_name=data["full_name"],
            password=data["password"],
            role=role,
            admin_permissions=data.get("admin_permissions", {}),
        )
        record_audit_log(
            actor=request.user,
            action="admin_create_user",
            target_type="User",
            target_id=user.id,
            metadata={"role": role},
            request=request,
        )
        return Response(AdminUserSerializer(user).data, status=status.HTTP_201_CREATED)


class AdminUserDetailManageView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Administration"],
        summary="View complete user details, posts, reports, and recent activities",
        responses={200: OpenApiResponse(description="Detailed user info")},
    )
    def get(self, request, user_id):
        if not has_admin_permission(request.user, "can_manage_users"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        target = get_object_or_404(User, pk=user_id)
        profile = getattr(target, "profile", None)
        recent_posts = Post.objects.filter(author=target).order_by("-created_at")[:10]
        recent_activities = UserActivity.objects.filter(user=target)[:15]
        reports_against = Report.objects.filter(reported_user=target)[:10]
        return Response(
            {
                "user": AdminUserSerializer(target).data,
                "bio": profile.bio if profile else "",
                "location": profile.location if profile else "",
                "posts_count": Post.objects.filter(author=target).count(),
                "recent_posts": PostSerializer(recent_posts, many=True, context={"request": request}).data,
                "recent_activities": UserActivitySerializer(recent_activities, many=True).data,
                "reports_against": ReportSerializer(reports_against, many=True).data,
            }
        )

    @extend_schema(
        tags=["Administration"],
        summary="Edit a user's details",
        responses={200: AdminUserSerializer},
    )
    def patch(self, request, user_id):
        if not has_admin_permission(request.user, "can_manage_users"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        target = get_object_or_404(User, pk=user_id)
        if target.role == User.ROLE_SUPER_ADMIN and request.user.pk != target.pk:
            return Response({"detail": "Cannot modify a Super Admin."}, status=status.HTTP_403_FORBIDDEN)
        for field in ("full_name", "email", "username"):
            if field in request.data:
                setattr(target, field, request.data[field])
        target.save()
        record_audit_log(
            actor=request.user,
            action="admin_edit_user",
            target_type="User",
            target_id=target.id,
            request=request,
        )
        return Response(AdminUserSerializer(target).data)

    @extend_schema(
        tags=["Administration"],
        summary="Delete a user account",
        responses={200: OpenApiResponse(description="User deleted")},
    )
    def delete(self, request, user_id):
        if not has_admin_permission(request.user, "can_manage_users"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        target = get_object_or_404(User, pk=user_id)
        if target.role == User.ROLE_SUPER_ADMIN:
            return Response({"detail": "Cannot delete a Super Admin."}, status=status.HTTP_403_FORBIDDEN)
        target_username = target.username
        target.delete()
        record_audit_log(
            actor=request.user,
            action="admin_delete_user",
            target_type="User",
            target_id=user_id,
            metadata={"username": target_username},
            request=request,
        )
        return Response({"message": f"User @{target_username} deleted."})


class AdminSuspendUserView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Administration"],
        summary="Suspend a user account (requires reason)",
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


# ---------------------------------------------------------------------------
# Post & Group Moderation
# ---------------------------------------------------------------------------


class AdminPostListView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Administration"],
        summary="List, search, and filter all posts for moderation",
        responses={200: PostSerializer(many=True)},
    )
    def get(self, request):
        if not has_admin_permission(request.user, "can_moderate_posts"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        qs = Post.objects.select_related("author", "author__profile").prefetch_related("images", "videos")
        qs = _filter_by_date(qs, request)

        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(content__icontains=q) | Q(author__username__icontains=q))
        visibility = request.query_params.get("visibility")
        if visibility:
            qs = qs.filter(visibility=visibility)
        mod_status = request.query_params.get("status")
        if mod_status == "removed":
            qs = qs.filter(is_removed=True)
        elif mod_status == "active":
            qs = qs.filter(is_removed=False)

        post_type = request.query_params.get("post_type")
        if post_type == "image":
            qs = qs.filter(images__isnull=False).distinct()
        elif post_type == "video":
            qs = qs.filter(videos__isnull=False).distinct()
        elif post_type == "text":
            qs = qs.filter(images__isnull=True, videos__isnull=True)

        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        data = []
        for p in page:
            item = PostSerializer(p, context={"request": request}).data
            item["is_removed"] = p.is_removed
            item["post_type"] = "video" if item["videos"] else ("image" if item["images"] else "text")
            data.append(item)
        return paginator.get_paginated_response(data)


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
        action_name = "post_removal" if post.is_removed else "post_restoration"
        record_audit_log(
            actor=request.user,
            action=action_name,
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
        summary="List and search groups for authorized administrators",
        responses={200: GroupSerializer(many=True)},
    )
    def get(self, request):
        if not has_admin_permission(request.user, "can_manage_groups"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        qs = Group.objects.select_related("creator", "conversation")
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(description__icontains=q))
        return Response(GroupSerializer(qs, many=True, context={"request": request}).data)


class AdminGroupDetailView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Administration"],
        summary="View group details and members",
        responses={200: OpenApiResponse(description="Group details and members")},
    )
    def get(self, request, group_id):
        if not has_admin_permission(request.user, "can_manage_groups"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        group = get_object_or_404(Group, pk=group_id)
        members = group.memberships.select_related("user")
        return Response(
            {
                "group": GroupSerializer(group, context={"request": request}).data,
                "members": GroupMemberSerializer(members, many=True).data,
            }
        )

    @extend_schema(
        tags=["Administration"],
        summary="Delete a group (Admin)",
        responses={200: OpenApiResponse(description="Group deleted")},
    )
    def delete(self, request, group_id):
        if not has_admin_permission(request.user, "can_manage_groups"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        group = get_object_or_404(Group, pk=group_id)
        name = group.name
        group.delete()
        record_audit_log(
            actor=request.user,
            action="admin_delete_group",
            target_type="Group",
            target_id=group_id,
            metadata={"name": name},
            request=request,
        )
        return Response({"message": f"Group '{name}' deleted."})


# ---------------------------------------------------------------------------
# User Activities, Stats & Analytics
# ---------------------------------------------------------------------------


class UserActivityListView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Administration"],
        summary="List platform user activities (separate from Audit Logs)",
        responses={200: UserActivitySerializer(many=True)},
    )
    def get(self, request):
        if not has_admin_permission(request.user, "can_view_activities"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        qs = UserActivity.objects.select_related("user", "user__profile")
        qs = _filter_by_date(qs, request)

        category = request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        act_type = request.query_params.get("activity_type")
        if act_type:
            qs = qs.filter(activity_type=act_type)
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(user__username__icontains=q)
                | Q(user__full_name__icontains=q)
                | Q(description__icontains=q)
            )

        sort = request.query_params.get("sort", "newest")
        qs = qs.order_by("created_at" if sort == "oldest" else "-created_at")

        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(UserActivitySerializer(page, many=True).data)


class AdminStatsView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Administration"],
        summary="View complete platform dashboard statistics",
        responses={200: OpenApiResponse(description="Platform statistics")},
    )
    def get(self, request):
        if not has_admin_permission(request.user, "can_view_stats"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        prefix_map = {
            "+255": "Tanzania",
            "+254": "Kenya",
            "+256": "Uganda",
            "+1": "USA/Canada",
            "+44": "UK",
            "+91": "India",
        }
        country_counts = {}
        for phone in User.objects.values_list("phone_number", flat=True):
            label = "Others"
            for prefix, name in prefix_map.items():
                if phone.startswith(prefix):
                    label = name
                    break
            country_counts[label] = country_counts.get(label, 0) + 1

        total_users = User.objects.count()
        suspended_users = User.objects.filter(is_suspended=True).count()
        active_users = User.objects.filter(is_suspended=False, is_active=True).count()

        return Response(
            {
                "total_users": total_users,
                "active_users": active_users,
                "suspended_users": suspended_users,
                "total_admins": User.objects.filter(
                    role__in=[User.ROLE_ADMIN, User.ROLE_SUPER_ADMIN]
                ).count(),
                "total_posts": Post.objects.filter(is_removed=False).count(),
                "removed_posts": Post.objects.filter(is_removed=True).count(),
                "image_posts": Post.objects.filter(images__isnull=False).distinct().count(),
                "video_posts": Post.objects.filter(videos__isnull=False).distinct().count(),
                "total_comments": Comment.objects.count(),
                "total_likes": Like.objects.count(),
                "total_followers": Follow.objects.filter(status=Follow.STATUS_ACCEPTED).count(),
                "total_messages": Message.objects.count(),
                "total_groups": Group.objects.count(),
                "total_group_members": GroupMember.objects.count(),
                "pending_reports": Report.objects.filter(status=Report.STATUS_PENDING).count(),
                "under_review_reports": Report.objects.filter(status=Report.STATUS_UNDER_REVIEW).count(),
                "resolved_reports": Report.objects.filter(status=Report.STATUS_RESOLVED).count(),
                "rejected_reports": Report.objects.filter(status=Report.STATUS_REJECTED).count(),
                "top_countries": [
                    {"country": k, "count": v}
                    for k, v in sorted(country_counts.items(), key=lambda x: -x[1])
                ],
                "recent_user_activities": UserActivitySerializer(
                    UserActivity.objects.select_related("user", "user__profile")[:6], many=True
                ).data,
            }
        )


class AdminAnalyticsView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Administration"],
        summary="Time-series growth analytics for users, posts, groups, and activities",
        parameters=[OpenApiParameter(name="period", type=str, required=False)],
        responses={200: OpenApiResponse(description="Time-series analytics")},
    )
    def get(self, request):
        if not has_admin_permission(request.user, "can_view_stats"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        period = request.query_params.get("period", "month")
        trunc_fn = TruncMonth if period == "year" else TruncDay

        user_growth = [
            {"date": row["bucket"].date().isoformat(), "count": row["count"]}
            for row in User.objects.annotate(bucket=trunc_fn("date_joined"))
            .values("bucket")
            .annotate(count=Count("id"))
            .order_by("bucket")[:30]
        ]
        post_trends = [
            {"date": row["bucket"].date().isoformat(), "count": row["count"]}
            for row in Post.objects.annotate(bucket=trunc_fn("created_at"))
            .values("bucket")
            .annotate(count=Count("id"))
            .order_by("bucket")[:30]
        ]
        group_trends = [
            {"date": row["bucket"].date().isoformat(), "count": row["count"]}
            for row in Group.objects.annotate(bucket=trunc_fn("created_at"))
            .values("bucket")
            .annotate(count=Count("id"))
            .order_by("bucket")[:30]
        ]
        activity_trends = [
            {"date": row["bucket"].date().isoformat(), "count": row["count"]}
            for row in UserActivity.objects.annotate(bucket=trunc_fn("created_at"))
            .values("bucket")
            .annotate(count=Count("id"))
            .order_by("bucket")[:30]
        ]

        return Response(
            {
                "period": period,
                "user_growth": user_growth,
                "post_trends": post_trends,
                "group_trends": group_trends,
                "activity_trends": activity_trends,
            }
        )


# ---------------------------------------------------------------------------
# Admin Notifications & Security Settings
# ---------------------------------------------------------------------------


class AdminNotificationListView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(tags=["Administration"], summary="List admin notifications")
    def get(self, request):
        qs = AdminNotification.objects.filter(recipient=request.user)
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(AdminNotificationSerializer(page, many=True).data)


class AdminNotificationUnreadCountView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(tags=["Administration"], summary="Unread admin notification count")
    def get(self, request):
        count = AdminNotification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({"unread_count": count})


class AdminNotificationMarkReadView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(tags=["Administration"], summary="Mark admin notification as read", request=None)
    def post(self, request, pk):
        notif = get_object_or_404(AdminNotification, pk=pk, recipient=request.user)
        notif.is_read = True
        notif.save(update_fields=["is_read"])
        return Response(AdminNotificationSerializer(notif).data)


class AdminNotificationMarkAllReadView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(tags=["Administration"], summary="Mark all admin notifications as read", request=None)
    def post(self, request):
        updated = AdminNotification.objects.filter(recipient=request.user, is_read=False).update(
            is_read=True
        )
        return Response({"message": f"Marked {updated} notifications as read."})


class PublicContactMessageView(APIView):
    """Public landing-page contact form that notifies all active Admins & Super Admins."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=["Administration"],
        summary="Submit a contact message from the landing page (notifies admins)",
        responses={201: OpenApiResponse(description="Message sent to administrators")},
    )
    def post(self, request):
        email = (request.data.get("email") or "").strip()
        contact = (request.data.get("contact") or request.data.get("phone") or "").strip()
        description = (request.data.get("description") or request.data.get("message") or "").strip()

        if not email or "@" not in email:
            return Response({"detail": "Please enter a valid email address."}, status=status.HTTP_400_BAD_REQUEST)
        if not description:
            return Response({"detail": "Please write your message or description."}, status=status.HTTP_400_BAD_REQUEST)

        contact_part = f" ({contact})" if contact else ""
        full_msg = f"Contact from {email}{contact_part}: {description}"[:255]

        admins = User.objects.filter(
            role__in=[User.ROLE_ADMIN, User.ROLE_SUPER_ADMIN],
            is_active=True,
        )
        AdminNotification.objects.bulk_create(
            [
                AdminNotification(
                    recipient=admin_user,
                    notification_type=AdminNotification.TYPE_SYSTEM,
                    message=full_msg,
                )
                for admin_user in admins
            ]
        )
        return Response(
            {"message": "Thank you! Your message has been sent to the TZChat team."},
            status=status.HTTP_201_CREATED,
        )


class AdminChangePasswordView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(tags=["Administration"], summary="Change own administrator password")
    def post(self, request):
        current_password = request.data.get("current_password", "")
        new_password = request.data.get("new_password", "")
        if not request.user.check_password(current_password):
            return Response({"detail": "Current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_password(new_password, user=request.user)
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(new_password)
        request.user.save(update_fields=["password"])
        record_audit_log(
            actor=request.user,
            action="admin_password_change",
            target_type="User",
            target_id=request.user.id,
            request=request,
        )
        return Response({"message": "Password updated successfully."})


class AdminLogoutOtherDevicesView(APIView):
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(tags=["Administration"], summary="Blacklist all refresh tokens for current admin", request=None)
    def post(self, request):
        tokens = OutstandingToken.objects.filter(user=request.user)
        for t in tokens:
            BlacklistedToken.objects.get_or_create(token=t)
        record_audit_log(
            actor=request.user,
            action="admin_logout_other_devices",
            target_type="User",
            target_id=request.user.id,
            request=request,
        )
        return Response({"message": "All other sessions have been invalidated."})


# ---------------------------------------------------------------------------
# Super Admin Only: Admin Accounts, Permissions, System Settings & Audit Logs
# ---------------------------------------------------------------------------


class SuperAdminAdminsListView(APIView):
    permission_classes = [IsSuperAdmin]

    @extend_schema(tags=["Administration"], summary="List all Admin and Super Admin accounts")
    def get(self, request):
        admins = User.objects.filter(role__in=[User.ROLE_ADMIN, User.ROLE_SUPER_ADMIN])
        return Response(AdminUserSerializer(admins, many=True).data)


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
            action="admin_role_change",
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
    permission_classes = [IsAdminOrSuperAdmin]

    @extend_schema(
        tags=["Audit Logs"],
        summary="View immutable audit logs (Super Admin or permitted Admin)",
        responses={200: AuditLogSerializer(many=True)},
    )
    def get(self, request):
        if not has_admin_permission(request.user, "can_view_audit_logs"):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        qs = AuditLog.objects.select_related("actor")
        qs = _filter_by_date(qs, request)

        action = request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)
        actor = request.query_params.get("actor")
        if actor:
            qs = qs.filter(actor__username=actor.strip().lower())
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(actor__username__icontains=q)
                | Q(action__icontains=q)
                | Q(target_type__icontains=q)
                | Q(ip_address__icontains=q)
            )

        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(AuditLogSerializer(page, many=True).data)
