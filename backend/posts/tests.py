import io
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User

from .models import Comment, Like, Post

TEMP_MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TEMP_MEDIA_ROOT)
class PostsCommentsLikesTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(TEMP_MEDIA_ROOT, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.user1 = User.objects.create_user(
            username="amina",
            email="amina@example.com",
            phone_number="+255712111111",
            full_name="Amina Hassan",
            password="StrongPassword123!",
        )
        self.user2 = User.objects.create_user(
            username="hassan",
            email="hassan@example.com",
            phone_number="+255712333333",
            full_name="Hassan Juma",
            password="StrongPassword123!",
        )

    def _make_image(self):
        buf = io.BytesIO()
        Image.new("RGB", (40, 40), color="green").save(buf, format="PNG")
        buf.seek(0)
        return SimpleUploadedFile("pic.png", buf.read(), content_type="image/png")

    def test_create_text_image_and_video_posts(self):
        self.client.force_authenticate(user=self.user1)

        res_text = self.client.post(
            reverse("post-list-create"),
            {"content": "TZChat is amazing!", "feeling": "happy"},
            format="json",
        )
        self.assertEqual(res_text.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_text.data["feeling"], "happy")

        res_img = self.client.post(
            reverse("post-list-create"),
            {"content": "Beach view", "image": self._make_image(), "image_caption": "Zanzibar"},
            format="multipart",
        )
        self.assertEqual(res_img.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(res_img.data["images"]), 1)

        video_file = SimpleUploadedFile("clip.mp4", b"fake-mp4-bytes", content_type="video/mp4")
        res_vid = self.client.post(
            reverse("post-list-create"),
            {"content": "Video post", "video": video_file, "video_caption": "My clip"},
            format="multipart",
        )
        self.assertEqual(res_vid.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_vid.data["videos"][0]["caption"], "My clip")

    def test_edit_and_delete_permissions(self):
        post = Post.objects.create(author=self.user1, content="Original")

        # User 2 cannot edit or delete User 1's post
        self.client.force_authenticate(user=self.user2)
        res_edit = self.client.patch(
            reverse("post-detail", kwargs={"pk": post.id}),
            {"content": "Hacked"},
            format="json",
        )
        self.assertEqual(res_edit.status_code, status.HTTP_403_FORBIDDEN)
        res_del = self.client.delete(reverse("post-detail", kwargs={"pk": post.id}))
        self.assertEqual(res_del.status_code, status.HTTP_403_FORBIDDEN)

        # User 1 can edit and delete
        self.client.force_authenticate(user=self.user1)
        res_ok = self.client.patch(
            reverse("post-detail", kwargs={"pk": post.id}),
            {"content": "Updated"},
            format="json",
        )
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(res_ok.data["content"], "Updated")

    def test_likes_and_comments(self):
        post = Post.objects.create(author=self.user1, content="Hello TZChat")
        self.client.force_authenticate(user=self.user2)

        # Like & prevent duplicate
        res_like = self.client.post(reverse("post-like", kwargs={"pk": post.id}))
        self.assertEqual(res_like.status_code, status.HTTP_201_CREATED)
        res_dup = self.client.post(reverse("post-like", kwargs={"pk": post.id}))
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Like.objects.count(), 1)

        # Unlike
        res_unlike = self.client.delete(reverse("post-like", kwargs={"pk": post.id}))
        self.assertEqual(res_unlike.status_code, status.HTTP_200_OK)
        self.assertEqual(Like.objects.count(), 0)

        # Comment & ownership on delete
        res_comment = self.client.post(
            reverse("post-comments", kwargs={"pk": post.id}),
            {"content": "Nice post!"},
            format="json",
        )
        self.assertEqual(res_comment.status_code, status.HTTP_201_CREATED)
        comment_id = res_comment.data["id"]

        self.client.force_authenticate(user=self.user1)
        res_bad_del = self.client.delete(reverse("comment-delete", kwargs={"comment_id": comment_id}))
        self.assertEqual(res_bad_del.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.user2)
        res_del = self.client.delete(reverse("comment-delete", kwargs={"comment_id": comment_id}))
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        self.assertEqual(Comment.objects.count(), 0)

    def test_explore_respects_private_profiles_and_hides_sensitive_fields(self):
        self.user1.privacy_settings.profile_visibility = "private"
        self.user1.privacy_settings.save()
        Post.objects.create(author=self.user1, content="Public post about Zanzibar", visibility="public")
        Post.objects.create(author=self.user1, content="Secret note", visibility="private")

        self.client.force_authenticate(user=self.user2)
        res_users = self.client.get(reverse("explore-users"), {"q": "amina"})
        self.assertEqual(res_users.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_users.data), 0)

        res_posts = self.client.get(reverse("explore-posts"), {"q": "Zanzibar"})
        self.assertEqual(res_posts.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_posts.data["results"]), 1)
        self.assertNotIn("email", res_posts.data["results"][0]["author"])
        self.assertNotIn("phone_number", res_posts.data["results"][0]["author"])
