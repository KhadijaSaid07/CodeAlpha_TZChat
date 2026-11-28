from django.urls import path

from .views import (
    AcceptMessageRequestView,
    BlockMessageRequestSenderView,
    ConversationClearMessagesView,
    ConversationDetailView,
    ConversationListView,
    ConversationMarkReadView,
    ConversationMessagesView,
    DeclineMessageRequestView,
    DirectConversationStartView,
    IncomingMessageRequestsView,
    MessageDeleteView,
    OutgoingMessageRequestsView,
    SendMessageRequestView,
)

urlpatterns = [
    path("conversations/", ConversationListView.as_view(), name="conversation-list"),
    path("conversations/<int:conversation_id>/", ConversationDetailView.as_view(), name="conversation-detail"),
    path("conversations/direct/<str:username>/", DirectConversationStartView.as_view(), name="conversation-direct-start"),
    path("conversations/<int:conversation_id>/messages/", ConversationMessagesView.as_view(), name="conversation-messages"),
    path("conversations/<int:conversation_id>/read/", ConversationMarkReadView.as_view(), name="conversation-read"),
    path("conversations/<int:conversation_id>/clear/", ConversationClearMessagesView.as_view(), name="conversation-clear"),
    path("messages/<int:message_id>/", MessageDeleteView.as_view(), name="message-delete"),
    path("requests/incoming/", IncomingMessageRequestsView.as_view(), name="message-requests-incoming"),
    path("requests/outgoing/", OutgoingMessageRequestsView.as_view(), name="message-requests-outgoing"),
    path("requests/<str:username>/", SendMessageRequestView.as_view(), name="message-request-send"),
    path("requests/<int:pk>/accept/", AcceptMessageRequestView.as_view(), name="message-request-accept"),
    path("requests/<int:pk>/decline/", DeclineMessageRequestView.as_view(), name="message-request-decline"),
    path("requests/<int:pk>/block/", BlockMessageRequestSenderView.as_view(), name="message-request-block"),
]
