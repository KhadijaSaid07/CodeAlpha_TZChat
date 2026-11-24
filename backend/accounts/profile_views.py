from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from privacy.models import PrivacySetting

from .models import ProfileView, User, UserProfile
from .profile_permissions import can_view_avatar, can_view_profile
from .serializers import (
    ImageUploadSerializer,
    ProfileUpdateSerializer,
    UserProfileSerializer,
)


def _get_or_create_profile(user: User) -> UserProfile:
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile


class MyProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Profiles"],
        summary="View current user's profile",
        responses={200: UserProfileSerializer},
    )
    def get(self, request):
        profile = _get_or_create_profile(request.user)
        return Response(
            UserProfileSerializer(profile, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Profiles"],
        summary="Update current user's profile",
        request=ProfileUpdateSerializer,
        responses={200: UserProfileSerializer},
    )
    def patch(self, request):
        serializer = ProfileUpdateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = request.user
        profile = _get_or_create_profile(user)
        privacy, _ = PrivacySetting.objects.get_or_create(user=user)

        if "full_name" in data:
            user.full_name = data["full_name"].strip()
        if "username" in data:
            user.username = data["username"]
        if "full_name" in data or "username" in data:
            user.save()

        if "bio" in data:
            profile.bio = data["bio"]
        if "location" in data:
            profile.location = data["location"]
        if "bio" in data or "location" in data:
            profile.save()

        if "profile_picture_visibility" in data:
            privacy.profile_picture_visibility = data["profile_picture_visibility"]
            privacy.save(update_fields=["profile_picture_visibility", "updated_at"])

        return Response(
            UserProfileSerializer(profile, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class UserProfileDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Profiles"],
        summary="View another user's profile",
        responses={
            200: UserProfileSerializer,
            403: OpenApiResponse(description="Profile is restricted by privacy settings"),
            404: OpenApiResponse(description="User not found"),
        },
    )
    def get(self, request, username):
        target = get_object_or_404(User, username=username.strip().lower(), is_active=True, is_suspended=False)
        if not can_view_profile(request.user, target):
            return Response(
                {"detail": "You do not have permission to view this profile."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if request.user.pk != target.pk:
            ProfileView.objects.update_or_create(
                profile_owner=target,
                viewer=request.user,
            )
        profile = _get_or_create_profile(target)
        return Response(
            UserProfileSerializer(profile, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class MyProfileViewsListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Profiles"],
        summary="List users who viewed your profile",
        responses={200: OpenApiResponse(description="List of profile viewers")},
    )
    def get(self, request):
        views = (
            ProfileView.objects.filter(profile_owner=request.user)
            .select_related("viewer", "viewer__profile")[:50]
        )
        data = [
            {
                "id": v.id,
                "username": v.viewer.username,
                "full_name": v.viewer.full_name,
                "profile_picture_url": (
                    f"/api/profiles/{v.viewer.username}/avatar/"
                    if getattr(v.viewer, "profile", None)
                    and v.viewer.profile.profile_picture
                    and can_view_avatar(request.user, v.viewer)
                    else None
                ),
                "viewed_at": v.viewed_at,
            }
            for v in views
        ]
        return Response(data)


class AvatarManageView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=["Profiles"],
        summary="Upload or change profile picture",
        request=ImageUploadSerializer,
        responses={200: UserProfileSerializer},
    )
    def post(self, request):
        serializer = ImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        profile = _get_or_create_profile(request.user)
        if profile.profile_picture:
            profile.profile_picture.delete(save=False)
        profile.profile_picture = serializer.validated_data["image"]
        profile.save()

        return Response(
            UserProfileSerializer(profile, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Profiles"],
        summary="Remove profile picture",
        responses={200: UserProfileSerializer},
    )
    def delete(self, request):
        profile = _get_or_create_profile(request.user)
        if profile.profile_picture:
            profile.profile_picture.delete(save=False)
            profile.profile_picture = None
            profile.save()
        return Response(
            UserProfileSerializer(profile, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class CoverManageView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=["Profiles"],
        summary="Upload or change cover image",
        request=ImageUploadSerializer,
        responses={200: UserProfileSerializer},
    )
    def post(self, request):
        serializer = ImageUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        profile = _get_or_create_profile(request.user)
        if profile.cover_image:
            profile.cover_image.delete(save=False)
        profile.cover_image = serializer.validated_data["image"]
        profile.save()

        return Response(
            UserProfileSerializer(profile, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Profiles"],
        summary="Remove cover image",
        responses={200: UserProfileSerializer},
    )
    def delete(self, request):
        profile = _get_or_create_profile(request.user)
        if profile.cover_image:
            profile.cover_image.delete(save=False)
            profile.cover_image = None
            profile.save()
        return Response(
            UserProfileSerializer(profile, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class ProtectedAvatarView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Profiles"],
        summary="Retrieve user's profile picture (enforces privacy)",
        responses={
            200: OpenApiResponse(description="Image file stream"),
            403: OpenApiResponse(description="Profile picture is restricted"),
            404: OpenApiResponse(description="Profile picture not found"),
        },
    )
    def get(self, request, username):
        target = get_object_or_404(User, username=username.strip().lower(), is_active=True)
        if not can_view_avatar(request.user, target):
            return Response(
                {"detail": "You do not have permission to view this profile picture."},
                status=status.HTTP_403_FORBIDDEN,
            )
        profile = _get_or_create_profile(target)
        if not profile.profile_picture:
            return Response({"detail": "No profile picture set."}, status=status.HTTP_404_NOT_FOUND)
        try:
            return FileResponse(profile.profile_picture.open("rb"))
        except FileNotFoundError:
            return Response({"detail": "Profile picture file not found."}, status=status.HTTP_404_NOT_FOUND)
