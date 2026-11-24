from django.urls import path

from .views import (
    GroupAdminManageView,
    GroupDetailView,
    GroupInviteLinkView,
    GroupJoinByInviteView,
    GroupLeaveView,
    GroupListCreateView,
    GroupMemberRemoveView,
    GroupMembersView,
    GroupTransferOwnershipView,
)

urlpatterns = [
    path("", GroupListCreateView.as_view(), name="group-list-create"),
    path("join/<uuid:invite_code>/", GroupJoinByInviteView.as_view(), name="group-join-invite"),
    path("<int:pk>/", GroupDetailView.as_view(), name="group-detail"),
    path("<int:pk>/members/", GroupMembersView.as_view(), name="group-members"),
    path("<int:pk>/members/<str:username>/", GroupMemberRemoveView.as_view(), name="group-member-remove"),
    path("<int:pk>/leave/", GroupLeaveView.as_view(), name="group-leave"),
    path("<int:pk>/admins/<str:username>/", GroupAdminManageView.as_view(), name="group-admin-manage"),
    path("<int:pk>/transfer-ownership/", GroupTransferOwnershipView.as_view(), name="group-transfer-ownership"),
    path("<int:pk>/invite-link/", GroupInviteLinkView.as_view(), name="group-invite-link"),
]
