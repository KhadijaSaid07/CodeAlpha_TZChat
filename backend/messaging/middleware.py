from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User


@database_sync_to_async
def _get_user_from_token(token_str: str):
    try:
        token = AccessToken(token_str)
        user = User.objects.get(pk=token["user_id"], is_active=True, is_suspended=False)
        return user
    except (TokenError, User.DoesNotExist, KeyError):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """Authenticate WebSocket connections using `?token=<jwt>` or Authorization header."""

    async def __call__(self, scope, receive, send):
        query_params = parse_qs(scope.get("query_string", b"").decode())
        token_list = query_params.get("token")
        token_str = token_list[0] if token_list else None

        if not token_str:
            headers = dict(scope.get("headers", []))
            auth_header = headers.get(b"authorization", b"").decode()
            if auth_header.startswith("Bearer "):
                token_str = auth_header.split(" ", 1)[1].strip()

        scope["user"] = (
            await _get_user_from_token(token_str) if token_str else AnonymousUser()
        )
        return await super().__call__(scope, receive, send)
