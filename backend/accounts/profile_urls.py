from django.urls import path

from .profile_views import (
    AvatarManageView,
    CoverManageView,
    MyProfileView,
    ProtectedAvatarView,
    UserProfileDetailView,
)

urlpatterns = [
    path("me/", MyProfileView.as_view(), name="profile-me"),
    path("me/avatar/", AvatarManageView.as_view(), name="profile-avatar"),
    path("me/cover/", CoverManageView.as_view(), name="profile-cover"),
    path("<str:username>/", UserProfileDetailView.as_view(), name="profile-detail"),
    path("<str:username>/avatar/", ProtectedAvatarView.as_view(), name="profile-avatar-view"),
]
