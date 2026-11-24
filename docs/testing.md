# TZChat – Testing Log

Tests are recorded here only after they have been executed and verified.

| Stage / Module | Feature Tested | Test Method | Expected Result | Actual Result | Status | Issues / Fixes |
|---|---|---|---|---|---|---|
| Stage 1: Planning & DB Design | Schema & documentation review | Manual & structural review | 21 entities, constraints, and flows documented | Reviewed and committed to `main` | Pass | — |
| Stage 2: Backend Project Setup | Virtual environment, dependencies, Django project & 8 apps | `pip install`, `django-admin`, `manage.py check` | Django system check passes with 0 errors | `System check identified no issues (0 silenced).` | Pass | — |
| Stage 3: Database Configuration | PostgreSQL connection, `.env`, settings, Swagger UI | `connection.ensure_connection()`, `runserver` | PostgreSQL connects and ASGI server starts | `PostgreSQL connected successfully` | Pass | Wrapped `.env` password in quotes & granted `public` schema rights |
| Stage 4: Authentication & Accounts | Custom `User`, register, login, refresh, logout, reset, verify | `migrate`, `python manage.py test accounts` | All 6 auth tests pass | `Ran 6 tests in 9.174s - OK` | Pass | Granted `CREATEDB` to `tzchat_user` for test DB |
| Stage 5: User Profiles | Auto-profile, update bio/location/name, Pillow avatar/cover upload & privacy | `migrate`, `python manage.py test accounts` | All 11 tests pass | `Ran 11 tests in 15.223s - OK` | Pass | — |
| Stage 6: Friends & Followers | Follow/unfollow, approval, friend request/accept/reject/cancel/remove | `migrate`, `python manage.py test follows` | All 4 relationship tests pass | `Ran 4 tests in 6.047s - OK` | Pass | — |
| Stage 7: Posts, Comments, Likes & Explore | Text/image/video posts, permissions, likes, comments, explore search | `migrate`, `python manage.py test posts` | All 4 posts/explore tests pass | `Ran 4 tests in 5.202s - OK` | Pass | — |
| Stage 8: Private Messaging & WebSockets | 1-to-1 chat, unread counts, message requests, block, WebSocket JWT & membership | `migrate`, `python manage.py test messaging` | All 3 messaging & WebSocket tests pass | `Ran 3 tests in 8.250s - OK` | Pass | Wrapped `User.objects.create_user` with `database_sync_to_async` in async WS test |
| Stage 9: Group Conversations | Create group, owner/admin/member roles, invite link, transfer ownership, group chat | `migrate`, `python manage.py test groups` | All 2 group tests pass | `Ran 2 tests in 4.112s - OK` | Pass | — |
| Stage 10: Notifications | Signal-driven notifications, list, unread count, mark read, mark all read | `migrate`, `python manage.py test notifications` | Notification test passes | `Ran 1 test in 1.368s - OK` | Pass | — |
| Stage 11: Privacy, Blocking & Contact Discovery | Privacy settings, block/unblock, phone discovery without leaking phone, contact sync permission | `migrate`, `python manage.py test privacy` | All 2 privacy & discovery tests pass | `Ran 2 tests in 2.922s - OK` | Pass | — |
| Stage 12–15: Moderation, Admin RBAC, Audit Logs & Full Backend Suite | Reports, date filtering, PDF export, Admin/Super Admin RBAC, immutable AuditLogs, OpenAPI schema | `migrate`, `python manage.py test` (all 8 apps) | All 29 backend tests pass | `Ran 29 tests in 47.614s - OK` | Pass | — |
| Stage 16: Admin UserActivity, Notifications & Analytics Backend | `UserActivity`, `AdminNotification`, report categories, analytics, change-password, comment replies | `migrate`, `python manage.py test moderation` | Migration & moderation tests pass | `Applying moderation.0002... OK`, `Ran 3 tests - OK` | Pass | — |
| Stage 17–18: React User & Admin Frontends | All 10 User pages + 10 Admin pages, WebSockets, responsive layout, production Vite build | `npm run build`, live browser verification | Clean Vite build & live API integration | `built in 1.67s` (66 modules, 0 errors) | Pass | — |
