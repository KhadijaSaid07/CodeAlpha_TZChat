from django.urls import path

from .views import (
    CommentDeleteView,
    CommentListCreateView,
    PostDetailView,
    PostImageUploadView,
    PostLikesListView,
    PostLikeToggleView,
    PostListCreateView,
    PostVideoUploadView,
)

urlpatterns = [
    path("", PostListCreateView.as_view(), name="post-list-create"),
    path("<int:pk>/", PostDetailView.as_view(), name="post-detail"),
    path("<int:pk>/images/", PostImageUploadView.as_view(), name="post-image-upload"),
    path("<int:pk>/videos/", PostVideoUploadView.as_view(), name="post-video-upload"),
    path("<int:pk>/comments/", CommentListCreateView.as_view(), name="post-comments"),
    path("comments/<int:comment_id>/", CommentDeleteView.as_view(), name="comment-delete"),
    path("<int:pk>/like/", PostLikeToggleView.as_view(), name="post-like"),
    path("<int:pk>/likes/", PostLikesListView.as_view(), name="post-likes-list"),
]
