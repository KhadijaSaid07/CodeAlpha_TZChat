"""
Lightweight Django 5 Storage backend using the official Cloudinary SDK.
Supports images, videos, voice notes (audio), and attachments via resource_type='auto'.
Activated automatically in settings.py when CLOUDINARY_URL is set.
"""

import os

import cloudinary
import cloudinary.uploader
from django.core.files.storage import Storage


class CloudinaryMediaStorage(Storage):
    """Stores uploaded media permanently on Cloudinary using resource_type='auto'."""

    def _save(self, name, content):
        clean_name = name.replace("\\", "/").lstrip("/")
        folder = os.path.dirname(clean_name)
        public_id = os.path.splitext(os.path.basename(clean_name))[0]

        result = cloudinary.uploader.upload(
            content,
            folder=f"tzchat/{folder}" if folder else "tzchat",
            public_id=public_id,
            resource_type="auto",
            overwrite=True,
            unique_filename=False,
        )
        # Store the full permanent HTTPS URL so url() works for image, video, and raw assets
        return result["secure_url"]

    def url(self, name):
        if not name:
            return ""
        if name.startswith(("http://", "https://")):
            return name
        return name

    def exists(self, name):
        return False

    def delete(self, name):
        # Optional no-op; avoids failing deletes if asset was already removed
        return None
