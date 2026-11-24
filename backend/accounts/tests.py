import io
import shutil
import tempfile

from django.contrib.auth.tokens import default_token_generator
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from privacy.models import PrivacySetting

from .models import User, UserProfile


class AuthenticationTests(APITestCase):
    def setUp(self):
        self.register_url = reverse("auth-register")
        self.login_url = reverse("auth-login")
        self.refresh_url = reverse("auth-refresh")
        self.logout_url = reverse("auth-logout")
        self.me_url = reverse("auth-me")
        self.valid_payload = {
            "full_name": "Amina Hassan",
            "username": "amina_tz",
            "email": "amina@example.com",
            "phone_number": "+255712345678",
            "password": "StrongPassword123!",
            "confirm_password": "StrongPassword123!",
        }

    def test_register_valid_user_and_hash_password(self):
        res = self.client.post(self.register_url, self.valid_payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", res.data)
        self.assertIn("tzchat_refresh_token", res.cookies)
        user = User.objects.get(username="amina_tz")
        self.assertNotEqual(user.password, "StrongPassword123!")
        self.assertTrue(user.check_password("StrongPassword123!"))

    def test_reject_duplicate_username_email_and_phone(self):
        self.client.post(self.register_url, self.valid_payload, format="json")

        dup_username = {**self.valid_payload, "email": "other@example.com", "phone_number": "+255712345679"}
        res1 = self.client.post(self.register_url, dup_username, format="json")
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)

        dup_email = {**self.valid_payload, "username": "other_user", "phone_number": "+255712345679"}
        res2 = self.client.post(self.register_url, dup_email, format="json")
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

        dup_phone = {**self.valid_payload, "username": "other_user2", "email": "other2@example.com"}
        res3 = self.client.post(self.register_url, dup_phone, format="json")
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_with_username_and_email_and_reject_wrong_password(self):
        self.client.post(self.register_url, self.valid_payload, format="json")

        res_user = self.client.post(
            self.login_url,
            {"identifier": "amina_tz", "password": "StrongPassword123!"},
            format="json",
        )
        self.assertEqual(res_user.status_code, status.HTTP_200_OK)
        self.assertIn("access", res_user.data)

        res_email = self.client.post(
            self.login_url,
            {"identifier": "amina@example.com", "password": "StrongPassword123!"},
            format="json",
        )
        self.assertEqual(res_email.status_code, status.HTTP_200_OK)

        res_bad = self.client.post(
            self.login_url,
            {"identifier": "amina_tz", "password": "WrongPassword!"},
            format="json",
        )
        self.assertEqual(res_bad.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_protected_me_endpoint_and_suspended_user(self):
        res_unauth = self.client.get(self.me_url)
        self.assertEqual(res_unauth.status_code, status.HTTP_401_UNAUTHORIZED)

        reg = self.client.post(self.register_url, self.valid_payload, format="json")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {reg.data['access']}")
        res_auth = self.client.get(self.me_url)
        self.assertEqual(res_auth.status_code, status.HTTP_200_OK)
        self.assertEqual(res_auth.data["username"], "amina_tz")

        user = User.objects.get(username="amina_tz")
        user.is_suspended = True
        user.save()
        res_susp = self.client.post(
            self.login_url,
            {"identifier": "amina_tz", "password": "StrongPassword123!"},
            format="json",
        )
        self.assertEqual(res_susp.status_code, status.HTTP_403_FORBIDDEN)

    def test_refresh_and_logout_behavior(self):
        reg = self.client.post(self.register_url, self.valid_payload, format="json")
        access = reg.data["access"]

        res_refresh = self.client.post(self.refresh_url, {}, format="json")
        self.assertEqual(res_refresh.status_code, status.HTTP_200_OK)
        self.assertIn("access", res_refresh.data)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        res_logout = self.client.post(self.logout_url, {}, format="json")
        self.assertEqual(res_logout.status_code, status.HTTP_200_OK)

        # Refreshing after logout must fail
        res_after = self.client.post(self.refresh_url, {}, format="json")
        self.assertEqual(res_after.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_password_reset_and_email_verification(self):
        self.client.post(self.register_url, self.valid_payload, format="json")
        user = User.objects.get(username="amina_tz")
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        # Email verification
        verify_token = default_token_generator.make_token(user)
        res_verify = self.client.post(
            reverse("auth-verify-email"),
            {"uid": uid, "token": verify_token},
            format="json",
        )
        self.assertEqual(res_verify.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.is_verified)

        # Password reset
        reset_token = default_token_generator.make_token(user)
        res_reset = self.client.post(
            reverse("auth-password-reset-confirm"),
            {
                "uid": uid,
                "token": reset_token,
                "new_password": "NewStrongPassword456!",
                "confirm_password": "NewStrongPassword456!",
            },
            format="json",
        )
        self.assertEqual(res_reset.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.check_password("NewStrongPassword456!"))


TEMP_MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class UserProfileTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.user1 = User.objects.create_user(
            username="khalisa360",
            email="khalisa@example.com",
            phone_number="+255712000001",
            full_name="Khalisa Said",
            password="StrongPassword123!",
        )
        self.user2 = User.objects.create_user(
            username="david_tz",
            email="david@example.com",
            phone_number="+255712000002",
            full_name="David Mwinyi",
            password="StrongPassword123!",
        )

    def _make_test_image(self, name="avatar.png"):
        buf = io.BytesIO()
        Image.new("RGB", (50, 50), color="blue").save(buf, format="PNG")
        buf.seek(0)
        return SimpleUploadedFile(name, buf.read(), content_type="image/png")

    def test_profile_and_privacy_auto_created(self):
        self.assertTrue(UserProfile.objects.filter(user=self.user1).exists())
        self.assertTrue(PrivacySetting.objects.filter(user=self.user1).exists())

    def test_update_profile_fields(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.patch(
            reverse("profile-me"),
            {
                "full_name": "Khalisa S.",
                "bio": "Web & Mobile Developer | Zanzibar",
                "location": "Zanzibar, Tanzania",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["full_name"], "Khalisa S.")
        self.assertEqual(res.data["bio"], "Web & Mobile Developer | Zanzibar")
        self.assertEqual(res.data["location"], "Zanzibar, Tanzania")

    def test_upload_invalid_and_valid_avatar_and_delete(self):
        self.client.force_authenticate(user=self.user1)

        bad_file = SimpleUploadedFile("fake.png", b"not-an-image", content_type="image/png")
        res_bad = self.client.post(reverse("profile-avatar"), {"image": bad_file}, format="multipart")
        self.assertEqual(res_bad.status_code, status.HTTP_400_BAD_REQUEST)

        res_ok = self.client.post(
            reverse("profile-avatar"), {"image": self._make_test_image()}, format="multipart"
        )
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(res_ok.data["profile_picture_url"])

        res_del = self.client.delete(reverse("profile-avatar"))
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        self.assertIsNone(res_del.data["profile_picture_url"])

    def test_upload_and_remove_cover_image(self):
        self.client.force_authenticate(user=self.user1)
        res_ok = self.client.post(
            reverse("profile-cover"), {"image": self._make_test_image("cover.png")}, format="multipart"
        )
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(res_ok.data["cover_image_url"])

        res_del = self.client.delete(reverse("profile-cover"))
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        self.assertIsNone(res_del.data["cover_image_url"])

    def test_avatar_privacy_blocks_unauthorized_access(self):
        self.client.force_authenticate(user=self.user1)
        self.client.post(
            reverse("profile-avatar"), {"image": self._make_test_image()}, format="multipart"
        )
        self.client.patch(
            reverse("profile-me"),
            {"profile_picture_visibility": "nobody"},
            format="json",
        )

        # User 2 cannot access user 1's avatar
        self.client.force_authenticate(user=self.user2)
        res_profile = self.client.get(reverse("profile-detail", kwargs={"username": "khalisa360"}))
        self.assertEqual(res_profile.status_code, status.HTTP_200_OK)
        self.assertIsNone(res_profile.data["profile_picture_url"])

        res_avatar = self.client.get(reverse("profile-avatar-view", kwargs={"username": "khalisa360"}))
        self.assertEqual(res_avatar.status_code, status.HTTP_403_FORBIDDEN)
