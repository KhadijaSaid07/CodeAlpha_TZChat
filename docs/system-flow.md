# TZChat – System Flow

## 1. Authentication & Session Flow
1. User registers with full name, username, email, normalized international phone number, and password.
2. Backend hashes the password, creates `User`, `UserProfile`, and default `PrivacySetting`.
3. On login, backend issues a short-lived JWT **Access Token** (in JSON response) and sets a **Refresh Token** in an `HttpOnly` cookie.
4. Frontend sends `Authorization: Bearer <access_token>` on API requests and uses `/api/auth/refresh/` when the access token expires.

## 2. Social & Feed Flow
1. Users can **Follow** others (subject to `following_permission`) and send **Friend Requests** (requires mutual acceptance).
2. Feed & Explore endpoints filter posts based on `visibility`, `BlockedUser` relationships, and `is_removed` moderation flags.
3. Likes, comments, follows, and friend events generate `Notification` records.

## 3. Real-Time Messaging & Groups Flow
1. Before opening a 1-to-1 chat, backend checks `BlockedUser` and the recipient's `messaging_permission`. If restricted, a `MessageRequest` is created instead.
2. Once permitted, participants connect to Django Channels WebSockets (`/ws/chat/<conversation_id>/`) using JWT authentication.
3. Group conversations use `Group` + `GroupMember` roles (`owner`, `admin`, `member`) and share the same `Conversation` messaging pipeline.

## 4. Moderation & Admin Flow
1. Users submit `Report` records against users or posts.
2. Admins/Super Admins review reports (filterable by day, week, month, year, or custom date range) and export PDF summaries.
3. Every admin action (login, logout, suspension, reactivation, post moderation, report resolution, permission/setting changes) writes an immutable `AuditLog` entry.
