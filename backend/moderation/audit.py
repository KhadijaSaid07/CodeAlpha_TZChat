from .models import AuditLog

FORBIDDEN_METADATA_KEYS = {"password", "access", "refresh", "token", "secret", "content"}


def _sanitize_metadata(metadata: dict | None) -> dict:
    if not metadata:
        return {}
    return {
        k: v
        for k, v in metadata.items()
        if str(k).lower() not in FORBIDDEN_METADATA_KEYS
    }


def _get_client_ip(request):
    if not request:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def record_audit_log(
    *,
    actor,
    action: str,
    target_type: str,
    target_id: str | int = "",
    result: str = AuditLog.RESULT_SUCCESS,
    metadata: dict | None = None,
    request=None,
) -> AuditLog:
    """Create an immutable AuditLog record on the backend."""
    return AuditLog.objects.create(
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id != "" else "",
        result=result,
        metadata=_sanitize_metadata(metadata),
        ip_address=_get_client_ip(request),
    )
