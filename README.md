# TZChat – Connect. Chat. Share.

TZChat is a full-stack social networking and messaging platform built for the CodeAlpha Full Stack Development Internship (Task 2).

## Features
- Secure JWT authentication with rotating `HttpOnly` refresh cookies
- User profiles with Pillow-validated avatars, cover images, and backend-enforced image privacy
- Independent Followers (with optional approval) and Mutual Friends systems
- Text, image, and video posts with captions, feelings, visibility, comments, and likes
- Real-time 1-to-1 and Group messaging via Django Channels (WebSockets) + Message Requests
- Signal-driven Notifications, Privacy Settings, User Blocking, and Permission-based Contact Discovery
- Reporting with date-range filtering & PDF export, RBAC Admin Dashboard API, and immutable Audit Logs
- OpenAPI / Swagger UI documentation via `drf-spectacular`

## Technology Stack
- **Backend:** Python 3.12, Django 5.1, Django REST Framework, PostgreSQL, Django Channels (Daphne), Simple JWT, `drf-spectacular`, Pillow, `python-dotenv`
- **Frontend (Phase 2):** React, Vite, JavaScript, HTML5, CSS3

## Backend Setup & Running Instructions
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your SECRET_KEY and PostgreSQL DB_PASSWORD
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

## API Documentation
- Swagger UI: `http://127.0.0.1:8000/api/docs/`
- ReDoc: `http://127.0.0.1:8000/api/redoc/`
- OpenAPI Schema: `http://127.0.0.1:8000/api/schema/`

## Running Backend Tests
```bash
cd backend
source venv/bin/activate
python manage.py test
```
