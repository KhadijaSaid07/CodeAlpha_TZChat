from django.urls import path

from .views import ExplorePostsView, ExploreUsersView

urlpatterns = [
    path("users/", ExploreUsersView.as_view(), name="explore-users"),
    path("posts/", ExplorePostsView.as_view(), name="explore-posts"),
]
