# TZChat – Database Design (PostgreSQL)

This document defines the 21 core entities, their fields, keys, relationships, unique constraints, and database-level validation rules.

---

## Entity Summary

| # | Table | App | Purpose |
|---|-------|-----|---------|
| 1 | `accounts_user` | `accounts` | Core user account, credentials, and role |
| 2 | `accounts_userprofile` | `accounts` | Bio, location, avatar, cover image |
| 3 | `follows_friendship` | `follows` | Mutual friend requests and friendships |
| 4 | `follows_follow` | `follows` | One-way follow relationships |
| 5 | `posts_post` | `posts` | User posts (text, feeling, visibility) |
| 6 | `posts_postimage` | `posts` | Images attached to a post |
| 7 | `posts_postvideo` | `posts` | Videos with captions attached to a post |
| 8 | `posts_comment` | `posts` | Comments on posts |
| 9 | `posts_like` | `posts` | Likes on posts |
| 10 | `messaging_conversation` | `messaging` | Direct or group conversation container |
| 11 | `messaging_conversationmember` | `messaging` | Participants in a conversation |
| 12 | `messaging_message` | `messaging` | Chat messages, replies, delivery/read status |
| 13 | `messaging_messageattachment` | `messaging` | Images/files attached to messages |
| 14 | `groups_group` | `groups` | Group metadata and shareable invite link |
| 15 | `groups_groupmember` | `groups` | Group membership and roles (owner/admin/member) |
| 16 | `notifications_notification` | `notifications` | User activity notifications |
| 17 | `messaging_messagerequest` | `messaging` | Pending message requests from non-friends |
| 18 | `privacy_privacysetting` | `privacy` | Per-user privacy controls |
| 19 | `privacy_blockeduser` | `privacy` | User block list |
| 20 | `moderation_report` | `moderation` | User and post reports for admins |
| 21 | `moderation_auditlog` | `moderation` | Immutable audit trail of admin actions |

---

## Detailed Table Specifications

### 1. `accounts_user` (User)
- **Primary Key:** `id` (BigAutoField)
- **Fields:**
  - `full_name` (VARCHAR 150, NOT NULL)
  - `username` (VARCHAR 50, UNIQUE, NOT NULL)
  - `email` (VARCHAR 254, UNIQUE, NOT NULL)
  - `phone_number` (VARCHAR 20, UNIQUE, NOT NULL — normalized E.164 e.g. `+255712345678`)
  - `password` (VARCHAR 128, NOT NULL — PBKDF2/Argon2 hash)
  - `role` (VARCHAR 20, choices: `user`, `admin`, `super_admin`, default `user`)
  - `admin_permissions` (JSONB, default `{}`)
  - `is_verified` (BOOLEAN, default `False`)
  - `is_suspended` (BOOLEAN, default `False`)
  - `suspended_reason` (TEXT, blank)
  - `is_active` (BOOLEAN, default `True`)
  - `is_staff` (BOOLEAN, default `False`)
  - `is_superuser` (BOOLEAN, default `False`)
  - `date_joined` (TIMESTAMPTZ, auto_now_add)
  - `last_login` (TIMESTAMPTZ, nullable)
- **Validation Rules:** Lowercase/trimmed username & email; E.164 phone number format (`+<country_code><number>`).

### 2. `accounts_userprofile` (UserProfile)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Key:** `user_id` -> `accounts_user.id` (OneToOne, ON DELETE CASCADE)
- **Fields:**
  - `bio` (TEXT, max 500, blank)
  - `location` (VARCHAR 100, blank)
  - `profile_picture` (ImageField, nullable)
  - `cover_image` (ImageField, nullable)
  - `updated_at` (TIMESTAMPTZ, auto_now)

### 3. `follows_friendship` (Friendship)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Keys:**
  - `sender_id` -> `accounts_user.id` (ON DELETE CASCADE)
  - `receiver_id` -> `accounts_user.id` (ON DELETE CASCADE)
- **Fields:**
  - `status` (VARCHAR 20, choices: `pending`, `accepted`, `rejected`, default `pending`)
  - `created_at` (TIMESTAMPTZ, auto_now_add)
  - `updated_at` (TIMESTAMPTZ, auto_now)
- **Constraints:**
  - `CHECK (sender_id <> receiver_id)` (cannot send friend request to self)
  - `UNIQUE (sender_id, receiver_id)`
  - Application-level check prevents reverse duplicate `(B, A)` when `(A, B)` is pending or accepted.

### 4. `follows_follow` (Follow)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Keys:**
  - `follower_id` -> `accounts_user.id` (ON DELETE CASCADE)
  - `following_id` -> `accounts_user.id` (ON DELETE CASCADE)
- **Fields:**
  - `status` (VARCHAR 20, choices: `pending`, `accepted`, default `accepted`)
  - `created_at` (TIMESTAMPTZ, auto_now_add)
- **Constraints:**
  - `CHECK (follower_id <> following_id)` (cannot follow self)
  - `UNIQUE (follower_id, following_id)` (no duplicate follows)

### 5. `posts_post` (Post)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Key:** `author_id` -> `accounts_user.id` (ON DELETE CASCADE)
- **Fields:**
  - `content` (TEXT, blank)
  - `feeling` (VARCHAR 50, blank)
  - `visibility` (VARCHAR 20, choices: `public`, `friends`, `private`, default `public`)
  - `is_removed` (BOOLEAN, default `False`)
  - `created_at` (TIMESTAMPTZ, auto_now_add)
  - `updated_at` (TIMESTAMPTZ, auto_now)

### 6. `posts_postimage` (PostImage)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Key:** `post_id` -> `posts_post.id` (ON DELETE CASCADE)
- **Fields:** `image` (ImageField), `caption` (VARCHAR 255, blank), `uploaded_at` (TIMESTAMPTZ)

### 7. `posts_postvideo` (PostVideo)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Key:** `post_id` -> `posts_post.id` (ON DELETE CASCADE)
- **Fields:** `video` (FileField), `caption` (VARCHAR 255, blank), `uploaded_at` (TIMESTAMPTZ)

### 8. `posts_comment` (Comment)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Keys:**
  - `post_id` -> `posts_post.id` (ON DELETE CASCADE)
  - `author_id` -> `accounts_user.id` (ON DELETE CASCADE)
- **Fields:** `content` (TEXT, NOT NULL), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ)

### 9. `posts_like` (Like)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Keys:**
  - `post_id` -> `posts_post.id` (ON DELETE CASCADE)
  - `user_id` -> `accounts_user.id` (ON DELETE CASCADE)
- **Fields:** `created_at` (TIMESTAMPTZ)
- **Constraints:** `UNIQUE (post_id, user_id)` (one like per user per post)

### 10. `messaging_conversation` (Conversation)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Key:** `group_id` -> `groups_group.id` (OneToOne, nullable, ON DELETE CASCADE)
- **Fields:**
  - `conversation_type` (VARCHAR 20, choices: `direct`, `group`, default `direct`)
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)

### 11. `messaging_conversationmember` (ConversationMember)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Keys:**
  - `conversation_id` -> `messaging_conversation.id` (ON DELETE CASCADE)
  - `user_id` -> `accounts_user.id` (ON DELETE CASCADE)
- **Fields:** `joined_at` (TIMESTAMPTZ), `last_read_at` (TIMESTAMPTZ, nullable)
- **Constraints:** `UNIQUE (conversation_id, user_id)`

### 12. `messaging_message` (Message)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Keys:**
  - `conversation_id` -> `messaging_conversation.id` (ON DELETE CASCADE)
  - `sender_id` -> `accounts_user.id` (ON DELETE CASCADE)
  - `reply_to_id` -> `messaging_message.id` (nullable, ON DELETE SET NULL)
- **Fields:**
  - `content` (TEXT, blank)
  - `status` (VARCHAR 20, choices: `sent`, `delivered`, `read`, default `sent`)
  - `is_deleted` (BOOLEAN, default `False`)
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)

### 13. `messaging_messageattachment` (MessageAttachment)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Key:** `message_id` -> `messaging_message.id` (ON DELETE CASCADE)
- **Fields:** `file` (FileField), `file_type` (VARCHAR 20: `image`, `video`, `file`), `uploaded_at` (TIMESTAMPTZ)

### 14. `groups_group` (Group)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Key:** `creator_id` -> `accounts_user.id` (ON DELETE SET NULL, nullable)
- **Fields:**
  - `name` (VARCHAR 100, NOT NULL)
  - `description` (TEXT, blank)
  - `group_image` (ImageField, nullable)
  - `invite_code` (UUID, UNIQUE)
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)

### 15. `groups_groupmember` (GroupMember)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Keys:**
  - `group_id` -> `groups_group.id` (ON DELETE CASCADE)
  - `user_id` -> `accounts_user.id` (ON DELETE CASCADE)
- **Fields:** `role` (VARCHAR 20, choices: `owner`, `admin`, `member`, default `member`), `joined_at` (TIMESTAMPTZ)
- **Constraints:** `UNIQUE (group_id, user_id)`

### 16. `notifications_notification` (Notification)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Keys:**
  - `recipient_id` -> `accounts_user.id` (ON DELETE CASCADE)
  - `actor_id` -> `accounts_user.id` (ON DELETE SET NULL, nullable)
- **Fields:**
  - `notification_type` (VARCHAR 30)
  - `message` (VARCHAR 255)
  - `related_object_id` (INTEGER, nullable)
  - `is_read` (BOOLEAN, default `False`)
  - `created_at` (TIMESTAMPTZ)

### 17. `messaging_messagerequest` (MessageRequest)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Keys:**
  - `sender_id` -> `accounts_user.id` (ON DELETE CASCADE)
  - `receiver_id` -> `accounts_user.id` (ON DELETE CASCADE)
- **Fields:** `initial_message` (TEXT), `status` (VARCHAR 20: `pending`, `accepted`, `declined`), `created_at`, `updated_at`
- **Constraints:** `CHECK (sender_id <> receiver_id)`, `UNIQUE (sender_id, receiver_id)`

### 18. `privacy_privacysetting` (PrivacySetting)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Key:** `user_id` -> `accounts_user.id` (OneToOne, ON DELETE CASCADE)
- **Fields:**
  - `profile_visibility` (`everyone`, `friends`, `private`, default `everyone`)
  - `profile_picture_visibility` (`everyone`, `friends`, `contacts`, `nobody`, default `everyone`)
  - `phone_visibility` (`everyone`, `friends`, `nobody`, default `friends`)
  - `phone_discovery` (`everyone`, `contacts`, `nobody`, default `contacts`)
  - `messaging_permission` (`everyone`, `friends`, `nobody`, default `everyone`)
  - `following_permission` (`everyone`, `approval_required`, default `everyone`)
  - `updated_at` (TIMESTAMPTZ)

### 19. `privacy_blockeduser` (BlockedUser)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Keys:**
  - `blocker_id` -> `accounts_user.id` (ON DELETE CASCADE)
  - `blocked_id` -> `accounts_user.id` (ON DELETE CASCADE)
- **Fields:** `created_at` (TIMESTAMPTZ)
- **Constraints:** `CHECK (blocker_id <> blocked_id)`, `UNIQUE (blocker_id, blocked_id)`

### 20. `moderation_report` (Report)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Keys:**
  - `reporter_id` -> `accounts_user.id` (ON DELETE CASCADE)
  - `reported_user_id` -> `accounts_user.id` (nullable, ON DELETE SET NULL)
  - `reported_post_id` -> `posts_post.id` (nullable, ON DELETE SET NULL)
  - `reviewed_by_id` -> `accounts_user.id` (nullable, ON DELETE SET NULL)
- **Fields:** `reason` (VARCHAR 100), `description` (TEXT, blank), `status` (`pending`, `under_review`, `resolved`, `rejected`), `resolution_note` (TEXT, blank), `created_at`, `resolved_at` (nullable)

### 21. `moderation_auditlog` (AuditLog)
- **Primary Key:** `id` (BigAutoField)
- **Foreign Key:** `actor_id` -> `accounts_user.id` (nullable, ON DELETE SET NULL)
- **Fields:** `action` (VARCHAR 100), `target_type` (VARCHAR 50), `target_id` (VARCHAR 50), `result` (`success`, `failure`), `metadata` (JSONB), `ip_address` (INET, nullable), `created_at` (TIMESTAMPTZ)
- **Security Rule:** Append-only from backend services; never stores passwords, tokens, or private message contents.
