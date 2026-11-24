from django.urls import path

from .views import (
    AcceptFriendRequestView,
    CancelFriendRequestView,
    FriendsListView,
    IncomingFriendRequestsView,
    OutgoingFriendRequestsView,
    RejectFriendRequestView,
    RemoveFriendView,
    SendFriendRequestView,
)

urlpatterns = [
    path("", FriendsListView.as_view(), name="friends-me"),
    path("user/<str:username>/", FriendsListView.as_view(), name="friends-user"),
    path("request/<str:username>/", SendFriendRequestView.as_view(), name="friend-request-send"),
    path("requests/incoming/", IncomingFriendRequestsView.as_view(), name="friend-requests-incoming"),
    path("requests/outgoing/", OutgoingFriendRequestsView.as_view(), name="friend-requests-outgoing"),
    path("requests/<int:pk>/accept/", AcceptFriendRequestView.as_view(), name="friend-request-accept"),
    path("requests/<int:pk>/reject/", RejectFriendRequestView.as_view(), name="friend-request-reject"),
    path("requests/<int:pk>/cancel/", CancelFriendRequestView.as_view(), name="friend-request-cancel"),
    path("<str:username>/", RemoveFriendView.as_view(), name="friend-remove"),
]
