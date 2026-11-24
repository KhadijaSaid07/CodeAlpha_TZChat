from django.db.models import Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from privacy.models import PrivacySetting

from .models import Follow, Friendship
from .serializers import (
    FollowSerializer,
    FriendshipSerializer,
    RelationshipUserSerializer,
)


def _get_target_user(username: str) -> User:
    return get_object_or_404(
        User, username=username.strip().lower(), is_active=True, is_suspended=False
    )


# ---------------------------------------------------------------------------
# Followers Endpoints
# ---------------------------------------------------------------------------


class FollowUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Followers"],
        summary="Follow a user",
        request=None,
        responses={
            201: FollowSerializer,
            400: OpenApiResponse(description="Self-follow or duplicate follow"),
        },
    )
    def post(self, request, username):
        target = _get_target_user(username)
        if target.pk == request.user.pk:
            return Response(
                {"detail": "You cannot follow yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if Follow.objects.filter(follower=request.user, following=target).exists():
            return Response(
                {"detail": "You already follow or requested to follow this user."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        privacy, _ = PrivacySetting.objects.get_or_create(user=target)
        follow_status = (
            Follow.STATUS_PENDING
            if privacy.following_permission == "approval_required"
            else Follow.STATUS_ACCEPTED
        )
        follow = Follow.objects.create(
            follower=request.user, following=target, status=follow_status
        )
        return Response(FollowSerializer(follow).data, status=status.HTTP_201_CREATED)


class UnfollowUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Followers"],
        summary="Unfollow a user",
        responses={200: OpenApiResponse(description="Unfollowed successfully")},
    )
    def delete(self, request, username):
        target = _get_target_user(username)
        deleted, _ = Follow.objects.filter(follower=request.user, following=target).delete()
        if not deleted:
            return Response(
                {"detail": "You are not following this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({"message": "Unfollowed successfully."}, status=status.HTTP_200_OK)


class FollowersListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Followers"],
        summary="List followers of a user (defaults to current user)",
        responses={200: RelationshipUserSerializer(many=True)},
    )
    def get(self, request, username=None):
        target = _get_target_user(username) if username else request.user
        followers = User.objects.filter(
            following_relations__following=target,
            following_relations__status=Follow.STATUS_ACCEPTED,
        )
        return Response(RelationshipUserSerializer(followers, many=True).data)


class FollowingListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Followers"],
        summary="List accounts a user is following (defaults to current user)",
        responses={200: RelationshipUserSerializer(many=True)},
    )
    def get(self, request, username=None):
        target = _get_target_user(username) if username else request.user
        following = User.objects.filter(
            follower_relations__follower=target,
            follower_relations__status=Follow.STATUS_ACCEPTED,
        )
        return Response(RelationshipUserSerializer(following, many=True).data)


class PendingFollowRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Followers"],
        summary="List pending incoming follow requests",
        responses={200: FollowSerializer(many=True)},
    )
    def get(self, request):
        pending = Follow.objects.filter(
            following=request.user, status=Follow.STATUS_PENDING
        )
        return Response(FollowSerializer(pending, many=True).data)


class ApproveFollowRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Followers"],
        summary="Approve a pending follow request",
        request=None,
        responses={200: FollowSerializer},
    )
    def post(self, request, pk):
        follow = get_object_or_404(
            Follow, pk=pk, following=request.user, status=Follow.STATUS_PENDING
        )
        follow.status = Follow.STATUS_ACCEPTED
        follow.save(update_fields=["status"])
        return Response(FollowSerializer(follow).data, status=status.HTTP_200_OK)


class RejectFollowRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Followers"],
        summary="Reject a pending follow request",
        request=None,
        responses={200: OpenApiResponse(description="Follow request rejected")},
    )
    def post(self, request, pk):
        follow = get_object_or_404(
            Follow, pk=pk, following=request.user, status=Follow.STATUS_PENDING
        )
        follow.delete()
        return Response({"message": "Follow request rejected."}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Friends Endpoints (Mutual Acceptance)
# ---------------------------------------------------------------------------


class SendFriendRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Friends"],
        summary="Send a friend request",
        request=None,
        responses={
            201: FriendshipSerializer,
            400: OpenApiResponse(description="Self-request or existing friendship/request"),
        },
    )
    def post(self, request, username):
        target = _get_target_user(username)
        if target.pk == request.user.pk:
            return Response(
                {"detail": "You cannot send a friend request to yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = Friendship.objects.filter(
            Q(sender=request.user, receiver=target) | Q(sender=target, receiver=request.user)
        ).first()

        if existing:
            if existing.status == Friendship.STATUS_ACCEPTED:
                return Response(
                    {"detail": "You are already friends."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if existing.status == Friendship.STATUS_PENDING:
                return Response(
                    {"detail": "A pending friend request already exists."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Re-open a previously rejected request
            existing.sender = request.user
            existing.receiver = target
            existing.status = Friendship.STATUS_PENDING
            existing.save(update_fields=["sender", "receiver", "status", "updated_at"])
            return Response(FriendshipSerializer(existing).data, status=status.HTTP_201_CREATED)

        friendship = Friendship.objects.create(sender=request.user, receiver=target)
        return Response(FriendshipSerializer(friendship).data, status=status.HTTP_201_CREATED)


class AcceptFriendRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Friends"],
        summary="Accept an incoming friend request",
        request=None,
        responses={200: FriendshipSerializer},
    )
    def post(self, request, pk):
        friendship = get_object_or_404(
            Friendship, pk=pk, receiver=request.user, status=Friendship.STATUS_PENDING
        )
        friendship.status = Friendship.STATUS_ACCEPTED
        friendship.save(update_fields=["status", "updated_at"])
        return Response(FriendshipSerializer(friendship).data, status=status.HTTP_200_OK)


class RejectFriendRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Friends"],
        summary="Reject an incoming friend request",
        request=None,
        responses={200: FriendshipSerializer},
    )
    def post(self, request, pk):
        friendship = get_object_or_404(
            Friendship, pk=pk, receiver=request.user, status=Friendship.STATUS_PENDING
        )
        friendship.status = Friendship.STATUS_REJECTED
        friendship.save(update_fields=["status", "updated_at"])
        return Response(FriendshipSerializer(friendship).data, status=status.HTTP_200_OK)


class CancelFriendRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Friends"],
        summary="Cancel an outgoing friend request",
        responses={200: OpenApiResponse(description="Friend request cancelled")},
    )
    def delete(self, request, pk):
        friendship = get_object_or_404(
            Friendship, pk=pk, sender=request.user, status=Friendship.STATUS_PENDING
        )
        friendship.delete()
        return Response({"message": "Friend request cancelled."}, status=status.HTTP_200_OK)


class IncomingFriendRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Friends"],
        summary="List pending incoming friend requests",
        responses={200: FriendshipSerializer(many=True)},
    )
    def get(self, request):
        pending = Friendship.objects.filter(
            receiver=request.user, status=Friendship.STATUS_PENDING
        )
        return Response(FriendshipSerializer(pending, many=True).data)


class OutgoingFriendRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Friends"],
        summary="List pending outgoing friend requests",
        responses={200: FriendshipSerializer(many=True)},
    )
    def get(self, request):
        pending = Friendship.objects.filter(
            sender=request.user, status=Friendship.STATUS_PENDING
        )
        return Response(FriendshipSerializer(pending, many=True).data)


class RemoveFriendView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Friends"],
        summary="Remove an existing friend",
        responses={200: OpenApiResponse(description="Friend removed")},
    )
    def delete(self, request, username):
        target = _get_target_user(username)
        deleted, _ = Friendship.objects.filter(
            Q(sender=request.user, receiver=target) | Q(sender=target, receiver=request.user),
            status=Friendship.STATUS_ACCEPTED,
        ).delete()
        if not deleted:
            return Response(
                {"detail": "You are not friends with this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({"message": "Friend removed."}, status=status.HTTP_200_OK)


class FriendsListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Friends"],
        summary="List accepted friends of a user (defaults to current user)",
        responses={200: RelationshipUserSerializer(many=True)},
    )
    def get(self, request, username=None):
        target = _get_target_user(username) if username else request.user
        friendships = Friendship.objects.filter(
            Q(sender=target) | Q(receiver=target),
            status=Friendship.STATUS_ACCEPTED,
        ).select_related("sender", "receiver")

        friends = [
            f.receiver if f.sender_id == target.id else f.sender
            for f in friendships
        ]
        return Response(RelationshipUserSerializer(friends, many=True).data)
