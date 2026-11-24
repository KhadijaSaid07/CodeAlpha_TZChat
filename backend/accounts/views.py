from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import (
    ChangePasswordSerializer,
    EmailVerifySerializer,
    LoginSerializer,
    LogoutSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    TokenRefreshInputSerializer,
    UserAccountSerializer,
)

REFRESH_COOKIE_NAME = "tzchat_refresh_token"


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Store refresh token in an HttpOnly cookie for web clients."""
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="Lax" if settings.DEBUG else "None",
        max_age=7 * 24 * 60 * 60,
        path="/api/auth/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path="/api/auth/",
        samesite="Lax" if settings.DEBUG else "None",
    )


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Register a new user account",
        request=RegisterSerializer,
        responses={
            201: UserAccountSerializer,
            400: OpenApiResponse(description="Validation error (duplicate or invalid fields)"),
        },
    )
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Generate email verification token (logged to console email backend in dev)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        send_mail(
            subject="Verify your TZChat account",
            message=f"Verify your email using uid={uid} and token={token}",
            from_email="noreply@tzchat.local",
            recipient_list=[user.email],
            fail_silently=True,
        )

        refresh = RefreshToken.for_user(user)
        response = Response(
            {
                "message": "Account created successfully.",
                "user": UserAccountSerializer(user).data,
                "access": str(refresh.access_token),
            },
            status=status.HTTP_201_CREATED,
        )
        _set_refresh_cookie(response, str(refresh))
        return response


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Login with username or email",
        request=LoginSerializer,
        responses={
            200: OpenApiResponse(description="Login successful; returns access token and sets HttpOnly refresh cookie"),
            400: OpenApiResponse(description="Invalid credentials"),
            403: OpenApiResponse(description="Account is suspended"),
        },
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_401_UNAUTHORIZED)

        user = serializer.validated_data["user"]
        if user.is_suspended:
            return Response(
                {"detail": "Your account has been suspended. Contact support."},
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)
        response = Response(
            {
                "message": "Login successful.",
                "user": UserAccountSerializer(user).data,
                "access": str(refresh.access_token),
            },
            status=status.HTTP_200_OK,
        )
        _set_refresh_cookie(response, str(refresh))
        return response


class CookieTokenRefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Refresh access token",
        request=TokenRefreshInputSerializer,
        responses={
            200: OpenApiResponse(description="New access token returned and refresh cookie rotated"),
            401: OpenApiResponse(description="Missing or invalid refresh token"),
        },
    )
    def post(self, request):
        raw_refresh = request.COOKIES.get(REFRESH_COOKIE_NAME) or request.data.get("refresh")
        if not raw_refresh:
            return Response(
                {"detail": "Refresh token not provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            old_refresh = RefreshToken(raw_refresh)
            user = User.objects.get(pk=old_refresh["user_id"])
            if not user.is_active or user.is_suspended:
                return Response(
                    {"detail": "Account is inactive or suspended."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            # Blacklist old refresh token and issue a fresh pair
            old_refresh.blacklist()
            new_refresh = RefreshToken.for_user(user)
        except (TokenError, User.DoesNotExist):
            return Response(
                {"detail": "Invalid or expired refresh token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        response = Response(
            {"access": str(new_refresh.access_token)},
            status=status.HTTP_200_OK,
        )
        _set_refresh_cookie(response, str(new_refresh))
        return response


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Authentication"],
        summary="Logout and blacklist refresh token",
        request=LogoutSerializer,
        responses={200: OpenApiResponse(description="Logged out successfully")},
    )
    def post(self, request):
        raw_refresh = request.COOKIES.get(REFRESH_COOKIE_NAME) or request.data.get("refresh")
        if raw_refresh:
            try:
                token = RefreshToken(raw_refresh)
                token.blacklist()
            except TokenError:
                pass

        response = Response({"message": "Logged out successfully."}, status=status.HTTP_200_OK)
        _clear_refresh_cookie(response)
        return response


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Accounts"],
        summary="Get current authenticated user",
        responses={200: UserAccountSerializer},
    )
    def get(self, request):
        return Response(UserAccountSerializer(request.user).data, status=status.HTTP_200_OK)


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Request a password reset token",
        request=PasswordResetRequestSerializer,
        responses={200: OpenApiResponse(description="Reset instructions sent if account exists")},
    )
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        user = User.objects.filter(email=email).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            send_mail(
                subject="TZChat Password Reset",
                message=f"Reset your password using uid={uid} and token={token}",
                from_email="noreply@tzchat.local",
                recipient_list=[user.email],
                fail_silently=True,
            )
        return Response(
            {"message": "If an account with that email exists, reset instructions have been sent."},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Confirm password reset with uid and token",
        request=PasswordResetConfirmSerializer,
        responses={
            200: OpenApiResponse(description="Password updated successfully"),
            400: OpenApiResponse(description="Invalid token or validation error"),
        },
    )
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user_id = force_str(urlsafe_base64_decode(serializer.validated_data["uid"]))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({"detail": "Invalid reset link."}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, serializer.validated_data["token"]):
            return Response({"detail": "Invalid or expired reset token."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response({"message": "Password has been reset successfully."}, status=status.HTTP_200_OK)


class EmailVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=["Accounts"],
        summary="Verify user email with uid and token",
        request=EmailVerifySerializer,
        responses={
            200: OpenApiResponse(description="Account verified successfully"),
            400: OpenApiResponse(description="Invalid or expired verification token"),
        },
    )
    def post(self, request):
        serializer = EmailVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user_id = force_str(urlsafe_base64_decode(serializer.validated_data["uid"]))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({"detail": "Invalid verification link."}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, serializer.validated_data["token"]):
            return Response({"detail": "Invalid or expired verification token."}, status=status.HTTP_400_BAD_REQUEST)

        user.is_verified = True
        user.save(update_fields=["is_verified"])
        return Response({"message": "Account verified successfully."}, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Authentication"],
        summary="Change current user's password",
        request=ChangePasswordSerializer,
        responses={200: OpenApiResponse(description="Password updated successfully")},
    )
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not request.user.check_password(serializer.validated_data["current_password"]):
            return Response(
                {"detail": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response({"message": "Password changed successfully."}, status=status.HTTP_200_OK)
