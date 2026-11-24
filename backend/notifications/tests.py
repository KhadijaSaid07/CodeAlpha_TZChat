from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from follows.models import Follow, Friendship
from posts.models import Comment, Like, Post

from .models import Notification


class NotificationTests(APITestCase):
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

    def test_notifications_created_and_marked_read(self):
        # Follow, friend request, post like, comment
        Follow.objects.create(follower=self.user2, following=self.user1)
        fr = Friendship.objects.create(sender=self.user2, receiver=self.user1)
        fr.status = Friendship.STATUS_ACCEPTED
        fr.save()

        post = Post.objects.create(author=self.user1, content="Hello!")
        Like.objects.create(post=post, user=self.user2)
        Comment.objects.create(post=post, author=self.user2, content="Awesome!")

        self.client.force_authenticate(user=self.user1)
        res_count = self.client.get(reverse("notification-unread-count"))
        self.assertEqual(res_count.status_code, status.HTTP_200_OK)
        self.assertEqual(res_count.data["unread_count"], 4)

        res_list = self.client.get(reverse("notification-list"))
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        first_id = res_list.data["results"][0]["id"]

        # User2 cannot mark User1's notification read
        self.client.force_authenticate(user=self.user2)
        res_forbid = self.client.post(reverse("notification-read", kwargs={"pk": first_id}))
        self.assertEqual(res_forbid.status_code, status.HTTP_404_NOT_FOUND)

        # User1 marks one read, then all read
        self.client.force_authenticate(user=self.user1)
        self.client.post(reverse("notification-read", kwargs={"pk": first_id}))
        self.assertEqual(
            Notification.objects.filter(recipient=self.user1, is_read=False).count(), 3
        )
        self.client.post(reverse("notification-read-all"))
        self.assertEqual(
            Notification.objects.filter(recipient=self.user1, is_read=False).count(), 0
        )
