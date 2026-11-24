from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from messaging.models import Conversation, ConversationMember

from .models import Group, GroupMember
from .serializers import (
    AddGroupMemberSerializer,
    GroupCreateUpdateSerializer,
    GroupMemberSerializer,
    GroupSerializer,
    ManageAdminSerializer,
    TransferOwnershipSerializer,
)


def _get_membership(group: Group, user: User):
    return GroupMember.objects.filter(group=group, user=user).first()


def _is_owner_or_admin(membership: GroupMember) -> bool:
    return bool(
        membership and membership.role in (GroupMember.ROLE_OWNER, GroupMember.ROLE_ADMIN)
    )


def _add_user_to_group(group: Group, user: User, role: str = GroupMember.ROLE_MEMBER):
    membership, created = GroupMember.objects.get_or_create(
        group=group, user=user, defaults={"role": role}
    )
    conv = getattr(group, "conversation", None)
    if conv:
        ConversationMember.objects.get_or_create(conversation=conv, user=user)
    return membership, created


class GroupListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        tags=["Groups"],
        summary="List groups current user belongs to",
        responses={200: GroupSerializer(many=True)},
    )
    def get(self, request):
        groups = Group.objects.filter(memberships__user=request.user).select_related(
            "creator", "conversation"
        )
        return Response(GroupSerializer(groups, many=True, context={"request": request}).data)

    @extend_schema(
        tags=["Groups"],
        summary="Create a new group conversation",
        request=GroupCreateUpdateSerializer,
        responses={201: GroupSerializer},
    )
    def post(self, request):
        serializer = GroupCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = serializer.save(creator=request.user)
        Conversation.objects.create(conversation_type=Conversation.TYPE_GROUP, group=group)
        _add_user_to_group(group, request.user, role=GroupMember.ROLE_OWNER)
        return Response(
            GroupSerializer(group, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class GroupDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        tags=["Groups"],
        summary="View group details",
        responses={200: GroupSerializer, 403: OpenApiResponse(description="Not a member")},
    )
    def get(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        if not _get_membership(group, request.user):
            return Response({"detail": "You are not a member of this group."}, status=status.HTTP_403_FORBIDDEN)
        return Response(GroupSerializer(group, context={"request": request}).data)

    @extend_schema(
        tags=["Groups"],
        summary="Update group information (Owner or Admin only)",
        request=GroupCreateUpdateSerializer,
        responses={200: GroupSerializer, 403: OpenApiResponse(description="Forbidden")},
    )
    def patch(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        membership = _get_membership(group, request.user)
        if not _is_owner_or_admin(membership):
            return Response(
                {"detail": "Only group owners and administrators can update group settings."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = GroupCreateUpdateSerializer(group, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(GroupSerializer(group, context={"request": request}).data)


class GroupMembersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Groups"],
        summary="List group members",
        responses={200: GroupMemberSerializer(many=True)},
    )
    def get(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        if not _get_membership(group, request.user):
            return Response({"detail": "You are not a member of this group."}, status=status.HTTP_403_FORBIDDEN)
        members = group.memberships.select_related("user")
        return Response(GroupMemberSerializer(members, many=True).data)

    @extend_schema(
        tags=["Groups"],
        summary="Add a member to the group (Owner or Admin only)",
        request=AddGroupMemberSerializer,
        responses={201: GroupMemberSerializer, 403: OpenApiResponse(description="Forbidden")},
    )
    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        actor_membership = _get_membership(group, request.user)
        if not _is_owner_or_admin(actor_membership):
            return Response(
                {"detail": "Only group owners and administrators can add members."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = AddGroupMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target = get_object_or_404(
            User,
            username=serializer.validated_data["username"].strip().lower(),
            is_active=True,
            is_suspended=False,
        )
        membership, created = _add_user_to_group(group, target)
        if not created:
            return Response({"detail": "User is already a group member."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(GroupMemberSerializer(membership).data, status=status.HTTP_201_CREATED)


class GroupMemberRemoveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Groups"],
        summary="Remove a member from the group (Owner or Admin only)",
        responses={200: OpenApiResponse(description="Member removed")},
    )
    def delete(self, request, pk, username):
        group = get_object_or_404(Group, pk=pk)
        actor_membership = _get_membership(group, request.user)
        if not _is_owner_or_admin(actor_membership):
            return Response(
                {"detail": "Only group owners and administrators can remove members."},
                status=status.HTTP_403_FORBIDDEN,
            )
        target_membership = get_object_or_404(
            GroupMember, group=group, user__username=username.strip().lower()
        )
        if target_membership.role == GroupMember.ROLE_OWNER:
            return Response(
                {"detail": "The group owner cannot be removed."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if (
            actor_membership.role == GroupMember.ROLE_ADMIN
            and target_membership.role == GroupMember.ROLE_ADMIN
        ):
            return Response(
                {"detail": "Administrators cannot remove other administrators."},
                status=status.HTTP_403_FORBIDDEN,
            )
        conv = getattr(group, "conversation", None)
        if conv:
            ConversationMember.objects.filter(conversation=conv, user=target_membership.user).delete()
        target_membership.delete()
        return Response({"message": "Member removed from group."})


class GroupLeaveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Groups"],
        summary="Leave a group",
        request=None,
        responses={200: OpenApiResponse(description="Left group")},
    )
    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        membership = _get_membership(group, request.user)
        if not membership:
            return Response({"detail": "You are not a member of this group."}, status=status.HTTP_404_NOT_FOUND)
        if membership.role == GroupMember.ROLE_OWNER and group.memberships.count() > 1:
            return Response(
                {"detail": "Transfer ownership before leaving the group."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        conv = getattr(group, "conversation", None)
        if conv:
            ConversationMember.objects.filter(conversation=conv, user=request.user).delete()
        membership.delete()
        return Response({"message": "You have left the group."})


class GroupAdminManageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Groups"],
        summary="Assign or demote a group administrator (Owner only)",
        request=ManageAdminSerializer,
        responses={200: GroupMemberSerializer},
    )
    def post(self, request, pk, username):
        group = get_object_or_404(Group, pk=pk)
        actor_membership = _get_membership(group, request.user)
        if not actor_membership or actor_membership.role != GroupMember.ROLE_OWNER:
            return Response(
                {"detail": "Only the group owner can manage administrators."},
                status=status.HTTP_403_FORBIDDEN,
            )
        target_membership = get_object_or_404(
            GroupMember, group=group, user__username=username.strip().lower()
        )
        if target_membership.role == GroupMember.ROLE_OWNER:
            return Response({"detail": "Cannot change the owner's role here."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ManageAdminSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_membership.role = serializer.validated_data["role"]
        target_membership.save(update_fields=["role"])
        return Response(GroupMemberSerializer(target_membership).data)


class GroupTransferOwnershipView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Groups"],
        summary="Transfer group ownership to another member (Owner only)",
        request=TransferOwnershipSerializer,
        responses={200: OpenApiResponse(description="Ownership transferred")},
    )
    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        actor_membership = _get_membership(group, request.user)
        if not actor_membership or actor_membership.role != GroupMember.ROLE_OWNER:
            return Response(
                {"detail": "Only the group owner can transfer ownership."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = TransferOwnershipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_membership = get_object_or_404(
            GroupMember,
            group=group,
            user__username=serializer.validated_data["username"].strip().lower(),
        )
        actor_membership.role = GroupMember.ROLE_ADMIN
        actor_membership.save(update_fields=["role"])
        target_membership.role = GroupMember.ROLE_OWNER
        target_membership.save(update_fields=["role"])
        return Response({"message": f"Ownership transferred to @{target_membership.user.username}."})


class GroupInviteLinkView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Groups"],
        summary="Get shareable group invite link",
        responses={200: OpenApiResponse(description="Invite code and path")},
    )
    def get(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        if not _get_membership(group, request.user):
            return Response({"detail": "You are not a member of this group."}, status=status.HTTP_403_FORBIDDEN)
        return Response(
            {
                "invite_code": str(group.invite_code),
                "invite_path": f"/api/groups/join/{group.invite_code}/",
            }
        )


class GroupJoinByInviteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Groups"],
        summary="Join a group using its shareable invite code",
        request=None,
        responses={200: GroupSerializer},
    )
    def post(self, request, invite_code):
        group = get_object_or_404(Group, invite_code=invite_code)
        _add_user_to_group(group, request.user, role=GroupMember.ROLE_MEMBER)
        return Response(GroupSerializer(group, context={"request": request}).data)
