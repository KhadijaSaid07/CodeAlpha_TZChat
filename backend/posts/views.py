from django.db.models import Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.profile_permissions import can_view_profile
from follows.models import Follow, Friendship
from privacy.models import BlockedUser

from .models import Comment, Like, Post, PostImage, PostVideo
from .permissions import can_view_post
from .serializers import (
    CommentSerializer,
    LikeSerializer,
    PostAuthorSerializer,
    PostCreateUpdateSerializer,
    PostImageSerializer,
    PostImageUploadSerializer,
    PostSerializer,
    PostVideoSerializer,
    PostVideoUploadSerializer,
)


def _visible_posts_queryset(user):
    """Return posts visible to `user` (own, public, friends, or followers) excluding blocked accounts."""
    friend_ids = list(
        Friendship.objects.filter(
            Q(sender=user) | Q(receiver=user),
            status=Friendship.STATUS_ACCEPTED,
        ).values_list("sender_id", "receiver_id")
    )
    flat_friend_ids = {uid for pair in friend_ids for uid in pair if uid != user.id}

    following_ids = set(
        Follow.objects.filter(
            follower=user,
            status=Follow.STATUS_ACCEPTED,
        ).values_list("following_id", flat=True)
    )

    blocked_pairs = BlockedUser.objects.filter(
        Q(blocker=user) | Q(blocked=user)
    ).values_list("blocker_id", "blocked_id")
    blocked_ids = {uid for pair in blocked_pairs for uid in pair if uid != user.id}

    return (
        Post.objects.filter(is_removed=False, author__is_active=True, author__is_suspended=False)
        .exclude(author_id__in=blocked_ids)
        .filter(
            Q(author=user)
            | Q(visibility=Post.VISIBILITY_PUBLIC)
            | Q(visibility=Post.VISIBILITY_FRIENDS, author_id__in=flat_friend_ids)
            | Q(visibility=Post.VISIBILITY_FOLLOWERS, author_id__in=following_ids)
        )
        .select_related("author", "author__profile")
        .prefetch_related("images", "videos", "likes", "comments")
    )


class PostListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        tags=["Posts"],
        summary="List paginated feed posts from permitted accounts",
        parameters=[
            OpenApiParameter(name="following_only", type=bool, required=False),
            OpenApiParameter(name="username", type=str, required=False),
        ],
        responses={200: PostSerializer(many=True)},
    )
    def get(self, request):
        qs = _visible_posts_queryset(request.user)

        username = request.query_params.get("username")
        if username:
            qs = qs.filter(author__username=username.strip().lower())

        if request.query_params.get("following_only") == "true":
            following_ids = Follow.objects.filter(
                follower=request.user, status=Follow.STATUS_ACCEPTED
            ).values_list("following_id", flat=True)
            qs = qs.filter(Q(author=request.user) | Q(author_id__in=following_ids))

        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = PostSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(
        tags=["Posts"],
        summary="Create a text, image, or video post",
        request=PostCreateUpdateSerializer,
        responses={201: PostSerializer},
    )
    def post(self, request):
        serializer = PostCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        post = serializer.save(author=request.user)
        return Response(
            PostSerializer(post, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class PostDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Posts"],
        summary="View a single post",
        responses={200: PostSerializer, 403: OpenApiResponse(description="Forbidden")},
    )
    def get(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        if not can_view_post(request.user, post):
            return Response(
                {"detail": "You do not have permission to view this post."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(PostSerializer(post, context={"request": request}).data)

    @extend_schema(
        tags=["Posts"],
        summary="Edit own post",
        request=PostCreateUpdateSerializer,
        responses={200: PostSerializer, 403: OpenApiResponse(description="Forbidden")},
    )
    def patch(self, request, pk):
        post = get_object_or_404(Post, pk=pk, is_removed=False)
        if post.author_id != request.user.id:
            return Response(
                {"detail": "You can only edit your own posts."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = PostCreateUpdateSerializer(post, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(PostSerializer(post, context={"request": request}).data)

    @extend_schema(
        tags=["Posts"],
        summary="Delete own post",
        responses={200: OpenApiResponse(description="Post deleted"), 403: OpenApiResponse(description="Forbidden")},
    )
    def delete(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        if post.author_id != request.user.id:
            return Response(
                {"detail": "You can only delete your own posts."},
                status=status.HTTP_403_FORBIDDEN,
            )
        post.delete()
        return Response({"message": "Post deleted successfully."}, status=status.HTTP_200_OK)


class PostImageUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=["Posts"],
        summary="Upload an image to own post",
        request=PostImageUploadSerializer,
        responses={201: PostImageSerializer},
    )
    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk, is_removed=False)
        if post.author_id != request.user.id:
            return Response(
                {"detail": "You can only upload images to your own posts."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = PostImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        post_image = PostImage.objects.create(
            post=post,
            image=serializer.validated_data["image"],
            caption=serializer.validated_data["caption"],
        )
        return Response(PostImageSerializer(post_image).data, status=status.HTTP_201_CREATED)


class PostVideoUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=["Posts"],
        summary="Upload a video with caption to own post",
        request=PostVideoUploadSerializer,
        responses={201: PostVideoSerializer},
    )
    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk, is_removed=False)
        if post.author_id != request.user.id:
            return Response(
                {"detail": "You can only upload videos to your own posts."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = PostVideoUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        post_video = PostVideo.objects.create(
            post=post,
            video=serializer.validated_data["video"],
            caption=serializer.validated_data["caption"],
        )
        return Response(PostVideoSerializer(post_video).data, status=status.HTTP_201_CREATED)


class CommentListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Comments"],
        summary="List comments on a post",
        responses={200: CommentSerializer(many=True)},
    )
    def get(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        if not can_view_post(request.user, post):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        comments = post.comments.select_related("author", "author__profile")
        return Response(CommentSerializer(comments, many=True, context={"request": request}).data)

    @extend_schema(
        tags=["Comments"],
        summary="Add a comment to a post",
        request=CommentSerializer,
        responses={201: CommentSerializer},
    )
    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        if not can_view_post(request.user, post):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        serializer = CommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        parent = serializer.validated_data.get("parent")
        if parent and parent.post_id != post.id:
            return Response(
                {"detail": "Parent comment does not belong to this post."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        comment = Comment.objects.create(
            post=post,
            author=request.user,
            parent=parent,
            content=serializer.validated_data["content"],
        )
        return Response(
            CommentSerializer(comment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class CommentDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Comments"],
        summary="Delete own comment",
        responses={200: OpenApiResponse(description="Comment deleted")},
    )
    def delete(self, request, comment_id):
        comment = get_object_or_404(Comment, pk=comment_id)
        if comment.author_id != request.user.id:
            return Response(
                {"detail": "You can only delete your own comments."},
                status=status.HTTP_403_FORBIDDEN,
            )
        comment.delete()
        return Response({"message": "Comment deleted."}, status=status.HTTP_200_OK)


class PostLikeToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Likes"],
        summary="Like a post",
        request=None,
        responses={201: LikeSerializer, 400: OpenApiResponse(description="Already liked")},
    )
    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        if not can_view_post(request.user, post):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        if Like.objects.filter(post=post, user=request.user).exists():
            return Response({"detail": "You have already liked this post."}, status=status.HTTP_400_BAD_REQUEST)
        like = Like.objects.create(post=post, user=request.user)
        return Response(LikeSerializer(like, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        tags=["Likes"],
        summary="Unlike a post",
        responses={200: OpenApiResponse(description="Unliked")},
    )
    def delete(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        deleted, _ = Like.objects.filter(post=post, user=request.user).delete()
        if not deleted:
            return Response({"detail": "You have not liked this post."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"message": "Post unliked."}, status=status.HTTP_200_OK)


class PostLikesListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Likes"],
        summary="List users who liked a post",
        responses={200: LikeSerializer(many=True)},
    )
    def get(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        if not can_view_post(request.user, post):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        likes = post.likes.select_related("user", "user__profile")
        return Response(LikeSerializer(likes, many=True, context={"request": request}).data)


class ExploreUsersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Posts"],
        summary="Search users by username or full name (respects privacy)",
        parameters=[OpenApiParameter(name="q", type=str, required=False)],
        responses={200: PostAuthorSerializer(many=True)},
    )
    def get(self, request):
        query = (request.query_params.get("q") or "").strip()
        users = User.objects.filter(is_active=True, is_suspended=False).exclude(pk=request.user.pk)
        if query:
            users = users.filter(Q(username__icontains=query) | Q(full_name__icontains=query))
        else:
            users = users.order_by("?")

        visible_users = [u for u in users.select_related("profile")[:50] if can_view_profile(request.user, u)]
        return Response(PostAuthorSerializer(visible_users, many=True, context={"request": request}).data)


class ExplorePostsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Posts"],
        summary="Discover and search public/permitted posts",
        parameters=[OpenApiParameter(name="q", type=str, required=False)],
        responses={200: PostSerializer(many=True)},
    )
    def get(self, request):
        query = (request.query_params.get("q") or "").strip()
        qs = _visible_posts_queryset(request.user).filter(visibility=Post.VISIBILITY_PUBLIC)
        if query:
            qs = qs.filter(Q(content__icontains=query) | Q(author__username__icontains=query))

        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(
            PostSerializer(page, many=True, context={"request": request}).data
        )
