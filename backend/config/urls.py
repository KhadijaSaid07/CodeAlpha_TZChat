from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    # OpenAPI Schema & Swagger UI
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    # API Modules
    path("api/auth/", include("accounts.urls")),
    path("api/profiles/", include("accounts.profile_urls")),
    path("api/follows/", include("follows.urls")),
    path("api/friends/", include("follows.friend_urls")),
    path("api/posts/", include("posts.urls")),
    path("api/explore/", include("posts.explore_urls")),
    path("api/messaging/", include("messaging.urls")),
    path("api/groups/", include("groups.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/privacy/", include("privacy.urls")),
    path("api/reports/", include("moderation.report_urls")),
    path("api/admin-api/", include("moderation.urls")),
    # Serve uploaded media files in both dev and student-demo production
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]
