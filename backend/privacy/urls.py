from django.urls import path

from .views import (
    BlockedUsersListView,
    BlockUserView,
    ContactSearchView,
    ContactSyncView,
    PhoneDiscoveryView,
    PrivacySettingsView,
    UnblockUserView,
)

urlpatterns = [
    path("settings/", PrivacySettingsView.as_view(), name="privacy-settings"),
    path("block/<str:username>/", BlockUserView.as_view(), name="privacy-block"),
    path("unblock/<str:username>/", UnblockUserView.as_view(), name="privacy-unblock"),
    path("blocked/", BlockedUsersListView.as_view(), name="privacy-blocked-list"),
    path("contacts/sync/", ContactSyncView.as_view(), name="privacy-contacts-sync"),
    path("discover/phone/", PhoneDiscoveryView.as_view(), name="privacy-discover-phone"),
    path("discover/search/", ContactSearchView.as_view(), name="privacy-discover-search"),
]
