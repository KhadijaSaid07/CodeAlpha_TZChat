from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from posts.models import Post

from .models import AuditLog, Report


class ModerationAndAdminTests(APITestCase):
    def setUp(self):
        self.super_admin = User.objects.create_superuser(
            username="superadmin",
            email="super@example.com",
            phone_number="+255712000000",
            full_name="Super Admin",
            password="StrongPassword123!",
        )
        self.admin_user = User.objects.create_user(
            username="mod_admin",
            email="mod@example.com",
            phone_number="+255712000001",
            full_name="Moderator Admin",
            password="StrongPassword123!",
            role=User.ROLE_ADMIN,
            admin_permissions={"can_view_reports": True, "can_manage_users": True},
        )
        self.regular_user = User.objects.create_user(
            username="amina",
            email="amina@example.com",
            phone_number="+255712000002",
            full_name="Amina Hassan",
            password="StrongPassword123!",
        )

    def test_admin_login_rbac_and_audit_log_protection(self):
        # Regular user rejected from admin login
        res_reg = self.client.post(
            reverse("admin-login"),
            {"identifier": "amina", "password": "StrongPassword123!"},
            format="json",
        )
        self.assertEqual(res_reg.status_code, status.HTTP_403_FORBIDDEN)

        # Admin login succeeds and creates AuditLog
        res_admin = self.client.post(
            reverse("admin-login"),
            {"identifier": "mod_admin", "password": "StrongPassword123!"},
            format="json",
        )
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        self.assertTrue(AuditLog.objects.filter(action="admin_login", result="success").exists())

        # Ordinary admin cannot view audit logs or system settings
        self.client.force_authenticate(user=self.admin_user)
        res_logs = self.client.get(reverse("admin-audit-logs"))
        self.assertEqual(res_logs.status_code, status.HTTP_403_FORBIDDEN)

        res_settings = self.client.get(reverse("superadmin-settings"))
        self.assertEqual(res_settings.status_code, status.HTTP_403_FORBIDDEN)

        # Super Admin can view audit logs and update settings
        self.client.force_authenticate(user=self.super_admin)
        res_logs_ok = self.client.get(reverse("admin-audit-logs"))
        self.assertEqual(res_logs_ok.status_code, status.HTTP_200_OK)

        res_set_ok = self.client.patch(
            reverse("superadmin-settings"), {"allow_registration": False}, format="json"
        )
        self.assertEqual(res_set_ok.status_code, status.HTTP_200_OK)

    def test_report_submission_filtering_decision_pdf_and_user_suspension(self):
        post = Post.objects.create(author=self.regular_user, content="Spam post")

        self.client.force_authenticate(user=self.regular_user)
        res_rep = self.client.post(
            reverse("report-submit"),
            {"reported_post": post.id, "reason": "Spam", "description": "Repeated spam"},
            format="json",
        )
        self.assertEqual(res_rep.status_code, status.HTTP_201_CREATED)
        report_id = res_rep.data["id"]

        # Admin lists reports with period filter & resolves report
        self.client.force_authenticate(user=self.admin_user)
        res_list = self.client.get(reverse("admin-reports"), {"period": "week"})
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertEqual(res_list.data["count"], 1)

        res_dec = self.client.post(
            reverse("admin-report-decision", kwargs={"pk": report_id}),
            {"status": "resolved", "resolution_note": "Removed spam", "remove_post": True},
            format="json",
        )
        self.assertEqual(res_dec.status_code, status.HTTP_200_OK)
        post.refresh_from_db()
        self.assertTrue(post.is_removed)

        # Export PDF
        res_pdf = self.client.get(reverse("admin-reports-pdf"), {"period": "month"})
        self.assertEqual(res_pdf.status_code, status.HTTP_200_OK)
        self.assertEqual(res_pdf["Content-Type"], "application/pdf")
        self.assertTrue(res_pdf.content.startswith(b"%PDF-1.4"))

        # Suspend & reactivate user
        self.client.post(
            reverse("admin-user-suspend", kwargs={"user_id": self.regular_user.id}),
            {"reason": "Spamming"},
            format="json",
        )
        self.regular_user.refresh_from_db()
        self.assertTrue(self.regular_user.is_suspended)

        self.client.post(
            reverse("admin-user-reactivate", kwargs={"user_id": self.regular_user.id})
        )
        self.regular_user.refresh_from_db()
        self.assertFalse(self.regular_user.is_suspended)
        self.assertTrue(AuditLog.objects.filter(action="user_suspension").exists())
        self.assertTrue(AuditLog.objects.filter(action="user_reactivation").exists())
