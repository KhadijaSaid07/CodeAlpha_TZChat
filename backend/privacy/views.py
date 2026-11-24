from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.profile_permissions import can_view_profile
from accounts.validators import normalize_phone_number

from .models import BlockedUser, PrivacySetting, SyncedContact, is_blocked_between
from .serializers import (
    BlockedUserItemSerializer,
    ContactSyncSerializer,
    DiscoveredUserSerializer,
    PrivacySettingSerializer,
)


class PrivacySettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Privacy"],
        summary="Retrieve current user's privacy settings",
        responses={200: PrivacySettingSerializer},
    )
    def get(self, request):
        privacy, _ = PrivacySetting.objects.get_or_create(user=request.user)
        return Response(PrivacySettingSerializer(privacy).data)

    @extend_schema(
        tags=["Privacy"],
        summary="Update current user's privacy settings",
        request=PrivacySettingSerializer,
        responses={200: PrivacySettingSerializer},
    )
    def patch(self, request):
        privacy, _ = PrivacySetting.objects.get_or_create(user=request.user)
        serializer = PrivacySettingSerializer(privacy, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class BlockUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Privacy"],
        summary="Block a user",
        request=None,
        responses={201: BlockedUserItemSerializer, 400: OpenApiResponse(description="Self-block or already blocked")},
    )
    def post(self, request, username):
        target = get_object_or_404(User, username=username.strip().lower(), is_active=True)
        if target.pk == request.user.pk:
            return Response({"detail": "You cannot block yourself."}, status=status.HTTP_400_BAD_REQUEST)
        block, created = BlockedUser.objects.get_or_create(blocker=request.user, blocked=target)
        if not created:
            return Response({"detail": "User is already blocked."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(BlockedUserItemSerializer(block).data, status=status.HTTP_201_CREATED)


class UnblockUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Privacy"],
        summary="Unblock a user",
        responses={200: OpenApiResponse(description="User unblocked")},
    )
    def delete(self, request, username):
        target = get_object_or_404(User, username=username.strip().lower())
        deleted, _ = BlockedUser.objects.filter(blocker=request.user, blocked=target).delete()
        if not deleted:
            return Response({"detail": "This user is not blocked."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"message": "User unblocked."})


class BlockedUsersListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Privacy"],
        summary="List blocked users",
        responses={200: BlockedUserItemSerializer(many=True)},
    )
    def get(self, request):
        blocks = BlockedUser.objects.filter(blocker=request.user).select_related("blocked")
        return Response(BlockedUserItemSerializer(blocks, many=True).data)


class ContactSyncView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Privacy"],
        summary="Sync contacts after explicit user permission",
        request=ContactSyncSerializer,
        responses={200: OpenApiResponse(description="Matched registered users")},
    )
    def post(self, request):
        serializer = ContactSyncSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        synced_phones = []
        for item in serializer.validated_data["contacts"]:
            phone = item["phone_number"]
            SyncedContact.objects.update_or_create(
                owner=request.user,
                phone_number=phone,
                defaults={"contact_name": item.get("contact_name", "")},
            )
            synced_phones.append(phone)

        # Return only users whose phone_discovery permits it and who are not blocked
        candidates = User.objects.filter(
            phone_number__in=synced_phones, is_active=True, is_suspended=False
        ).exclude(pk=request.user.pk)

        discoverable = []
        for candidate in candidates:
            if is_blocked_between(request.user, candidate):
                continue
            privacy, _ = PrivacySetting.objects.get_or_create(user=candidate)
            if privacy.phone_discovery == PrivacySetting.VISIBILITY_EVERYONE:
                discoverable.append(candidate)
            elif privacy.phone_discovery == PrivacySetting.VISIBILITY_CONTACTS:
                if SyncedContact.objects.filter(
                    owner=candidate, phone_number=request.user.phone_number
                ).exists():
                    discoverable.append(candidate)

        return Response(
            {
                "synced_count": len(synced_phones),
                "matches": DiscoveredUserSerializer(
                    discoverable, many=True, context={"request": request}
                ).data,
            }
        )


class PhoneDiscoveryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Privacy"],
        summary="Discover an account by normalized phone number (respects discovery & visibility)",
        parameters=[OpenApiParameter(name="phone", type=str, required=True)],
        responses={200: OpenApiResponse(description="Discovery result or invite link")},
    )
    def get(self, request):
        raw_phone = request.query_params.get("phone", "")
        try:
            phone = normalize_phone_number(raw_phone)
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

        target = User.objects.filter(
            phone_number=phone, is_active=True, is_suspended=False
        ).first()
        if not target:
            return Response(
                {
                    "registered": False,
                    "invite_link": f"/register?invited_by={request.user.username}",
                }
            )

        if target.pk == request.user.pk:
            return Response({"registered": True, "user": DiscoveredUserSerializer(target, context={"request": request}).data})

        if is_blocked_between(request.user, target):
            return Response({"registered": False})

        privacy, _ = PrivacySetting.objects.get_or_create(user=target)
        allowed = False
        if privacy.phone_discovery == PrivacySetting.VISIBILITY_EVERYONE:
            allowed = True
        elif privacy.phone_discovery == PrivacySetting.VISIBILITY_CONTACTS:
            allowed = SyncedContact.objects.filter(
                owner=target, phone_number=request.user.phone_number
            ).exists()

        if not allowed:
            return Response({"registered": False})

        return Response(
            {
                "registered": True,
                "user": DiscoveredUserSerializer(target, context={"request": request}).data,
            }
        )


class ContactSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Privacy"],
        summary="Search users by username or full name (respects privacy & blocks)",
        parameters=[OpenApiParameter(name="q", type=str, required=True)],
        responses={200: DiscoveredUserSerializer(many=True)},
    )
    def get(self, request):
        query = (request.query_params.get("q") or "").strip()
        if not query:
            return Response([])

        users = (
            User.objects.filter(is_active=True, is_suspended=False)
            .filter(Q(username__icontains=query) | Q(full_name__icontains=query))
            .exclude(pk=request.user.pk)[:50]
        )
        visible = [u for u in users if can_view_profile(request.user, u)]
        return Response(DiscoveredUserSerializer(visible, many=True, context={"request": request}).data)
