from django.urls import path

from .views import (
    AdminGroupListView,
    AdminLoginView,
    AdminLogoutView,
    AdminPostModerateView,
    AdminReactivateUserView,
    AdminReportDecisionView,
    AdminReportExportPDFView,
    AdminReportListView,
    AdminStatsView,
    AdminSuspendUserView,
    AdminUserListView,
    AuditLogListView,
    SuperAdminManageRoleView,
    SuperAdminSystemSettingsView,
    SuperAdminUpdatePermissionsView,
)

urlpatterns = [
    path("login/", AdminLoginView.as_view(), name="admin-login"),
    path("logout/", AdminLogoutView.as_view(), name="admin-logout"),
    path("stats/", AdminStatsView.as_view(), name="admin-stats"),
    path("users/", AdminUserListView.as_view(), name="admin-users"),
    path("users/<int:user_id>/suspend/", AdminSuspendUserView.as_view(), name="admin-user-suspend"),
    path("users/<int:user_id>/reactivate/", AdminReactivateUserView.as_view(), name="admin-user-reactivate"),
    path("posts/<int:post_id>/moderate/", AdminPostModerateView.as_view(), name="admin-post-moderate"),
    path("groups/", AdminGroupListView.as_view(), name="admin-groups"),
    path("reports/", AdminReportListView.as_view(), name="admin-reports"),
    path("reports/export-pdf/", AdminReportExportPDFView.as_view(), name="admin-reports-pdf"),
    path("reports/<int:pk>/decision/", AdminReportDecisionView.as_view(), name="admin-report-decision"),
    path("admins/<int:user_id>/role/", SuperAdminManageRoleView.as_view(), name="superadmin-role"),
    path("admins/<int:user_id>/permissions/", SuperAdminUpdatePermissionsView.as_view(), name="superadmin-permissions"),
    path("settings/", SuperAdminSystemSettingsView.as_view(), name="superadmin-settings"),
    path("audit-logs/", AuditLogListView.as_view(), name="admin-audit-logs"),
]
