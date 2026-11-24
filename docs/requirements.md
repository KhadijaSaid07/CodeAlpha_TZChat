# TZChat – Requirements Overview

**Project Name:** TZChat  
**Tagline:** Connect. Chat. Share.  
**Type:** Full-Stack Social Networking and Messaging Platform  

## 1. Core Principles
- **Backend First, Frontend Second:** Complete, test, and document all backend APIs and WebSockets with Swagger UI before building the React frontend.
- **Database-Level Integrity:** Enforce uniqueness, self-action prevention, and relational integrity in PostgreSQL.
- **Security & Privacy First:** Enforce authentication (JWT + HttpOnly refresh cookie), privacy rules, blocking, and RBAC on the backend.

## 2. Technology Stack
- **Backend:** Python, Django, Django REST Framework, PostgreSQL, Django Channels, `djangorestframework-simplejwt`, `drf-spectacular`, Pillow, `python-dotenv`.
- **Frontend (Phase 2):** React, Vite, JavaScript, HTML5, CSS3, Fetch API / Axios.

## 3. Backend Modules
1. **Authentication & Accounts:** Registration (full name, username, email, normalized international phone number, password), login, logout, password recovery, account verification, JWT + HttpOnly refresh cookies, current user endpoint.
2. **User Profiles:** Create/view/edit profile, bio, location, profile picture & cover image upload/validation with Pillow, separate profile picture privacy.
3. **Friends & Followers:** Separate follow system (with optional approval) and mutual friendship system (send, accept, reject, cancel, remove).
4. **Posts, Comments & Likes:** Text, image, and video posts with captions, feelings, visibility, pagination, comments, likes (no duplicates).
5. **Explore & Search:** Search users by username/full name and public/permitted posts without leaking private data.
6. **Private Messaging:** Real-time 1-to-1 chat via Django Channels & WebSockets, replies, image/file attachments, delivered/read/typing status, unread counts.
7. **Message Requests:** Enforced by recipient messaging privacy settings; accept, decline, block sender.
8. **Group Conversations:** Create groups, shareable invite link, owner/admin/member roles, manage members, group chat.
9. **Notifications:** Real-time/persistent alerts for follows, friend requests/accepts, likes, comments, message requests, messages, group events.
10. **Privacy & Blocking:** Granular visibility for profile, profile picture, phone number, phone discovery, messaging, and following; user blocking.
11. **Contact Discovery:** Search by normalized phone number, username, or name; optional contact sync; invite link.
12. **Reporting & Moderation:** Report users/posts, filter reports by day/week/month/year/date range, resolve/reject, export PDF report.
13. **Admin Management:** Separate Admin & Super Admin roles with RBAC.
14. **Audit Logging:** Immutable backend-generated logs for admin actions, moderation, and security events.
