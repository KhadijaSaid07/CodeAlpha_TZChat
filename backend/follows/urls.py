from django.urls import path

from .views import (
    ApproveFollowRequestView,
    FollowersListView,
    FollowingListView,
    FollowUserView,
    PendingFollowRequestsView,
    RejectFollowRequestView,
    UnfollowUserView,
)

urlpatterns = [
    path("follow/<str:username>/", FollowUserView.as_view(), name="follow-user"),
    path("unfollow/<str:username>/", UnfollowUserView.as_view(), name="unfollow-user"),
    path("followers/", FollowersListView.as_view(), name="followers-me"),
    path("followers/<str:username>/", FollowersListView.as_view(), name="followers-user"),
    path("following/", FollowingListView.as_view(), name="following-me"),
    path("following/<str:username>/", FollowingListView.as_view(), name="following-user"),
    path("requests/", PendingFollowRequestsView.as_view(), name="follow-requests"),
    path("requests/<int:pk>/approve/", ApproveFollowRequestView.as_view(), name="follow-approve"),
    path("requests/<int:pk>/reject/", RejectFollowRequestView.as_view(), name="follow-reject"),
]
