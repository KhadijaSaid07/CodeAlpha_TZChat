from django.contrib import admin

from .models import Comment, Like, Post, PostImage, PostVideo


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("id", "author", "visibility", "is_removed", "created_at")
    list_filter = ("visibility", "is_removed")
    search_fields = ("author__username", "content")


admin.site.register(PostImage)
admin.site.register(PostVideo)
admin.site.register(Comment)
admin.site.register(Like)
