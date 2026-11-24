import os

from django.core.exceptions import ValidationError

MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".m4v"}


def validate_video_file(file_obj) -> None:
    """Validate uploaded video file size and extension."""
    if file_obj.size > MAX_VIDEO_SIZE_BYTES:
        raise ValidationError("Video size must not exceed 50 MB.")

    ext = os.path.splitext(file_obj.name)[1].lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise ValidationError("Unsupported video format. Allowed: .mp4, .webm, .mov, .m4v.")
