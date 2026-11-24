from django.urls import path

from .views import (
    CookieTokenRefreshView,
    CurrentUserView,
    EmailVerifyView,
    LoginView,
    LogoutView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", CookieTokenRefreshView.as_view(), name="auth-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", CurrentUserView.as_view(), name="auth-me"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="auth-password-reset"),
    path("password-reset-confirm/", PasswordResetConfirmView.as_view(), name="auth-password-reset-confirm"),
    path("verify-email/", EmailVerifyView.as_view(), name="auth-verify-email"),
]
