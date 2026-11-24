from follows.models import are_friends
from privacy.models import is_blocked_between

from .models import Post


def can_view_post(viewer, post: Post) -> bool:
    """Check whether `viewer` has permission to view `post`."""
    if post.is_removed:
        return False
    if viewer and viewer.is_authenticated and viewer.pk == post.author_id:
        return True
    if is_blocked_between(viewer, post.author):
        return False
    if post.visibility == Post.VISIBILITY_PUBLIC:
        return True
    if post.visibility == Post.VISIBILITY_FRIENDS:
        return are_friends(viewer, post.author)
    return False
