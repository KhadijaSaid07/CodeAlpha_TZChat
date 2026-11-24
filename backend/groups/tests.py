from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User

from .models import Group, GroupMember


class GroupConversationTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner_u",
            email="owner@example.com",
            phone_number="+255712111001",
            full_name="Owner User",
            password="StrongPassword123!",
        )
        self.member = User.objects.create_user(
            username="member_u",
            email="member@example.com",
            phone_number="+255712111002",
            full_name="Member User",
            password="StrongPassword123!",
        )
        self.joiner = User.objects.create_user(
            username="joiner_u",
            email="joiner@example.com",
            phone_number="+255712111003",
            full_name="Joiner User",
            password="StrongPassword123!",
        )

    def test_create_group_roles_management_and_invite_link(self):
        self.client.force_authenticate(user=self.owner)
        res_create = self.client.post(
            reverse("group-list-create"),
            {"name": "TZChat Developers", "description": "Build together"},
            format="json",
        )
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        group_id = res_create.data["id"]
        conv_id = res_create.data["conversation_id"]
        invite_code = res_create.data["invite_code"]
        self.assertIsNotNone(conv_id)

        # Owner adds member
        res_add = self.client.post(
            reverse("group-members", kwargs={"pk": group_id}),
            {"username": "member_u"},
            format="json",
        )
        self.assertEqual(res_add.status_code, status.HTTP_201_CREATED)

        # Regular member cannot add members or update group
        self.client.force_authenticate(user=self.member)
        res_unauth = self.client.post(
            reverse("group-members", kwargs={"pk": group_id}),
            {"username": "joiner_u"},
            format="json",
        )
        self.assertEqual(res_unauth.status_code, status.HTTP_403_FORBIDDEN)

        # Owner promotes member to admin, then admin can update group
        self.client.force_authenticate(user=self.owner)
        res_promote = self.client.post(
            reverse("group-admin-manage", kwargs={"pk": group_id, "username": "member_u"}),
            {"role": "admin"},
            format="json",
        )
        self.assertEqual(res_promote.status_code, status.HTTP_200_OK)
        self.assertEqual(res_promote.data["role"], "admin")

        self.client.force_authenticate(user=self.member)
        res_patch = self.client.patch(
            reverse("group-detail", kwargs={"pk": group_id}),
            {"description": "Updated by admin"},
            format="json",
        )
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)

        # Join via shareable invite link
        self.client.force_authenticate(user=self.joiner)
        res_join = self.client.post(
            reverse("group-join-invite", kwargs={"invite_code": invite_code})
        )
        self.assertEqual(res_join.status_code, status.HTTP_200_OK)
        self.assertEqual(GroupMember.objects.filter(group_id=group_id).count(), 3)

        # Send group message via conversation endpoint
        res_msg = self.client.post(
            reverse("conversation-messages", kwargs={"conversation_id": conv_id}),
            {"content": "Welcome everyone!"},
            format="json",
        )
        self.assertEqual(res_msg.status_code, status.HTTP_201_CREATED)

        # Leave group
        res_leave = self.client.post(reverse("group-leave", kwargs={"pk": group_id}))
        self.assertEqual(res_leave.status_code, status.HTTP_200_OK)
        self.assertEqual(GroupMember.objects.filter(group_id=group_id).count(), 2)

    def test_transfer_ownership_and_remove_member(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            reverse("group-list-create"), {"name": "Zanzibar Tech"}, format="json"
        )
        group_id = res.data["id"]
        self.client.post(
            reverse("group-members", kwargs={"pk": group_id}),
            {"username": "member_u"},
            format="json",
        )

        # Transfer ownership
        res_tx = self.client.post(
            reverse("group-transfer-ownership", kwargs={"pk": group_id}),
            {"username": "member_u"},
            format="json",
        )
        self.assertEqual(res_tx.status_code, status.HTTP_200_OK)
        self.assertEqual(
            GroupMember.objects.get(group_id=group_id, user=self.member).role,
            GroupMember.ROLE_OWNER,
        )

        # Original owner (now admin) can leave
        res_leave = self.client.post(reverse("group-leave", kwargs={"pk": group_id}))
        self.assertEqual(res_leave.status_code, status.HTTP_200_OK)
