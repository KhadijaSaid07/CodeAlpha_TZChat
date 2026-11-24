from django.contrib import admin

from .models import (
    Conversation,
    ConversationMember,
    Message,
    MessageAttachment,
    MessageRequest,
)

admin.site.register(Conversation)
admin.site.register(ConversationMember)
admin.site.register(Message)
admin.site.register(MessageAttachment)
admin.site.register(MessageRequest)
