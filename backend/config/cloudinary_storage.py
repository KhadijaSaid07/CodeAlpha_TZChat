"""
Lightweight Django 5 Storage backend using the official Cloudinary SDK.
Supports images, videos, voice notes (audio), and documents (PDF, Word, Excel, PowerPoint, etc.).
Stores compact references (< 50 chars) so every Django FileField/ImageField (max_length=100)
works without database migrations.
"""

import os
import uuid

import cloudinary
import cloudinary.uploader
import cloudinary.utils
from django.core.files.storage import Storage

RESOURCE_PREFIX = {
    "image": "i:",
    "video": "v:",
    "raw": "r:",
}
PREFIX_TO_RESOURCE = {v: k for k, v in RESOURCE_PREFIX.items()}

RAW_DOC_EXTS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".txt", ".csv", ".zip", ".rar", ".rtf", ".odt", ".ods", ".odp",
}


class CloudinaryMediaStorage(Storage):
    """Stores uploaded media and documents permanently on Cloudinary."""

    def _save(self, name, content):
        if hasattr(content, "seek"):
            content.seek(0)

        ext = os.path.splitext(name)[1].lower()
        short_id = uuid.uuid4().hex[:14]

        # Preserve file extension for documents (Word, Excel, PowerPoint, PDF, etc.) using raw resource_type
        if ext in RAW_DOC_EXTS:
            result = cloudinary.uploader.upload(
                content,
                folder="tzchat",
                public_id=f"{short_id}{ext}",
                resource_type="raw",
                overwrite=True,
                unique_filename=False,
            )
            return f"r:{result['public_id']}"

        result = cloudinary.uploader.upload(
            content,
            folder="tzchat",
            public_id=short_id,
            resource_type="auto",
            overwrite=True,
            unique_filename=False,
        )
        res_type = result.get("resource_type", "image")
        public_id = result["public_id"]
        fmt = result.get("format", "")
        prefix = RESOURCE_PREFIX.get(res_type, "i:")
        suffix = f".{fmt}" if fmt and not public_id.endswith(f".{fmt}") else ""
        return f"{prefix}{public_id}{suffix}"

    def url(self, name):
        if not name:
            return ""
        if name.startswith(("http://", "https://")):
            return name
        prefix = name[:2]
        if prefix in PREFIX_TO_RESOURCE:
            res_type = PREFIX_TO_RESOURCE[prefix]
            public_id = name[2:]
            url, _ = cloudinary.utils.cloudinary_url(
                public_id,
                resource_type=res_type,
                secure=True,
            )
            return url
        # Legacy pre-Cloudinary local path fallback
        return f"/media/{name.lstrip('/')}"

    def exists(self, name):
        return False

    def delete(self, name):
        return None
