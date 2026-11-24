from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User


class PrivacyAndDiscoveryTests(APITestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            username="amina",
            email="amina@example.com",
            phone_number="+255712111111",
            full_name="Amina Hassan",
            password="StrongPassword123!",
        )
        self.user2 = User.objects.create_user(
            username="david",
            email="david@example.com",
            phone_number="+255712222222",
            full_name="David Mwinyi",
            password="StrongPassword123!",
        )

    def test_update_privacy_settings_and_block_user(self):
        self.client.force_authenticate(user=self.user1)

        res_patch = self.client.patch(
            reverse("privacy-settings"),
            {
                "profile_visibility": "friends",
                "phone_visibility": "nobody",
                "phone_discovery": "everyone",
            },
            format="json",
        )
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        self.assertEqual(res_patch.data["profile_visibility"], "friends")

        # User2 discovers User1 by phone, but phone_number is NOT revealed (phone_visibility=nobody)
        self.client.force_authenticate(user=self.user2)
        res_phone = self.client.get(
            reverse("privacy-discover-phone"), {"phone": "+255712111111"}
        )
        self.assertEqual(res_phone.status_code, status.HTTP_200_OK)
        self.assertTrue(res_phone.data["registered"])
        self.assertIsNone(res_phone.data["user"]["phone_number"])

        # Unregistered phone returns invite link
        res_unreg = self.client.get(
            reverse("privacy-discover-phone"), {"phone": "+255799999999"}
        )
        self.assertFalse(res_unreg.data["registered"])
        self.assertIn("invite_link", res_unreg.data)

        # User1 blocks User2 -> User2 can no longer view User1's profile
        self.client.force_authenticate(user=self.user1)
        res_block = self.client.post(
            reverse("privacy-block", kwargs={"username": "david"})
        )
        self.assertEqual(res_block.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(user=self.user2)
        res_prof = self.client.get(
            reverse("profile-detail", kwargs={"username": "amina"})
        )
        self.assertEqual(res_prof.status_code, status.HTTP_403_FORBIDDEN)

        # User1 unblocks User2
        self.client.force_authenticate(user=self.user1)
        res_unblock = self.client.delete(
            reverse("privacy-unblock", kwargs={"username": "david"})
        )
        self.assertEqual(res_unblock.status_code, status.HTTP_200_OK)

    def test_contact_sync_requires_explicit_permission(self):
        self.client.force_authenticate(user=self.user1)
        res_denied = self.client.post(
            reverse("privacy-contacts-sync"),
            {"permission_granted": False, "contacts": [{"phone_number": "+255712222222"}]},
            format="json",
        )
        self.assertEqual(res_denied.status_code, status.HTTP_400_BAD_REQUEST)

        res_ok = self.client.post(
            reverse("privacy-contacts-sync"),
            {
                "permission_granted": True,
                "contacts": [{"phone_number": "+255 712 222 222", "contact_name": "David"}],
            },
            format="json",
        )
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(res_ok.data["synced_count"], 1)
