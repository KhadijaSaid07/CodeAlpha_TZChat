from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Notifications"],
        summary="List paginated notifications for current user",
        responses={200: NotificationSerializer(many=True)},
    )
    def get(self, request):
        qs = Notification.objects.filter(recipient=request.user).select_related("actor")
        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(
            NotificationSerializer(page, many=True).data
        )


class NotificationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Notifications"],
        summary="Mark a single notification as read",
        request=None,
        responses={200: NotificationSerializer},
    )
    def post(self, request, pk):
        notif = get_object_or_404(Notification, pk=pk, recipient=request.user)
        notif.is_read = True
        notif.save(update_fields=["is_read"])
        return Response(NotificationSerializer(notif).data)


class NotificationMarkAllReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Notifications"],
        summary="Mark all notifications as read",
        request=None,
        responses={200: OpenApiResponse(description="All notifications marked as read")},
    )
    def post(self, request):
        updated = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).update(is_read=True)
        return Response({"message": f"Marked {updated} notifications as read."})


class NotificationUnreadCountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Notifications"],
        summary="Get unread notification count",
        responses={200: OpenApiResponse(description="Unread count")},
    )
    def get(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({"unread_count": count}, status=status.HTTP_200_OK)
