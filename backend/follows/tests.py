from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User

from .models import Follow, Friendship


class FriendsAndFollowersTests(APITestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            username="amina",
            email="amina@example.com",
            phone_number="+255712111111",
            full_name="Amina Hassan",
            password="StrongPassword123!",
        )
        self.user2 = User.objects.create_user(
            username="fatma",
            email="fatma@example.com",
            phone_number="+255712222222",
            full_name="Fatma Ali",
            password="StrongPassword123!",
        )

    def test_follow_unfollow_prevent_self_and_duplicate(self):
        self.client.force_authenticate(user=self.user1)

        # Self-follow rejected
        res_self = self.client.post(reverse("follow-user", kwargs={"username": "amina"}))
        self.assertEqual(res_self.status_code, status.HTTP_400_BAD_REQUEST)

        # Valid follow
        res_follow = self.client.post(reverse("follow-user", kwargs={"username": "fatma"}))
        self.assertEqual(res_follow.status_code, status.HTTP_201_CREATED)

        # Duplicate follow rejected
        res_dup = self.client.post(reverse("follow-user", kwargs={"username": "fatma"}))
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)

        # Following does NOT create a Friendship
        self.assertEqual(Friendship.objects.count(), 0)

        # Unfollow
        res_unfollow = self.client.delete(reverse("unfollow-user", kwargs={"username": "fatma"}))
        self.assertEqual(res_unfollow.status_code, status.HTTP_200_OK)
        self.assertEqual(Follow.objects.count(), 0)

    def test_follow_approval_required(self):
        self.user2.privacy_settings.following_permission = "approval_required"
        self.user2.privacy_settings.save()

        self.client.force_authenticate(user=self.user1)
        res = self.client.post(reverse("follow-user", kwargs={"username": "fatma"}))
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["status"], "pending")

        self.client.force_authenticate(user=self.user2)
        res_approve = self.client.post(reverse("follow-approve", kwargs={"pk": res.data["id"]}))
        self.assertEqual(res_approve.status_code, status.HTTP_200_OK)
        self.assertEqual(res_approve.data["status"], "accepted")

    def test_friend_request_accept_remove_and_no_auto_follow(self):
        self.client.force_authenticate(user=self.user1)

        # Self friend request rejected
        res_self = self.client.post(reverse("friend-request-send", kwargs={"username": "amina"}))
        self.assertEqual(res_self.status_code, status.HTTP_400_BAD_REQUEST)

        # Send request
        res_send = self.client.post(reverse("friend-request-send", kwargs={"username": "fatma"}))
        self.assertEqual(res_send.status_code, status.HTTP_201_CREATED)
        req_id = res_send.data["id"]

        # Reverse duplicate blocked
        self.client.force_authenticate(user=self.user2)
        res_rev = self.client.post(reverse("friend-request-send", kwargs={"username": "amina"}))
        self.assertEqual(res_rev.status_code, status.HTTP_400_BAD_REQUEST)

        # Accept request
        res_acc = self.client.post(reverse("friend-request-accept", kwargs={"pk": req_id}))
        self.assertEqual(res_acc.status_code, status.HTTP_200_OK)
        self.assertEqual(res_acc.data["status"], "accepted")

        # Friendship does NOT create a Follow
        self.assertEqual(Follow.objects.count(), 0)

        # Friends list
        res_list = self.client.get(reverse("friends-me"))
        self.assertEqual(len(res_list.data), 1)
        self.assertEqual(res_list.data[0]["username"], "amina")

        # Remove friend
        res_rem = self.client.delete(reverse("friend-remove", kwargs={"username": "amina"}))
        self.assertEqual(res_rem.status_code, status.HTTP_200_OK)
        self.assertEqual(Friendship.objects.count(), 0)

    def test_reject_and_cancel_friend_request(self):
        self.client.force_authenticate(user=self.user1)
        res1 = self.client.post(reverse("friend-request-send", kwargs={"username": "fatma"}))
        req_id = res1.data["id"]

        # Cancel outgoing
        res_cancel = self.client.delete(reverse("friend-request-cancel", kwargs={"pk": req_id}))
        self.assertEqual(res_cancel.status_code, status.HTTP_200_OK)

        # Send again & reject
        res2 = self.client.post(reverse("friend-request-send", kwargs={"username": "fatma"}))
        self.client.force_authenticate(user=self.user2)
        res_rej = self.client.post(reverse("friend-request-reject", kwargs={"pk": res2.data["id"]}))
        self.assertEqual(res_rej.status_code, status.HTTP_200_OK)
        self.assertEqual(res_rej.data["status"], "rejected")
