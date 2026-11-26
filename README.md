# TZChat – Connect. Chat. Share.

TZChat is a full-stack social networking and real-time messaging platform built for the CodeAlpha Full Stack Development Internship (Task 2).

## Live Deployment
- **Live Frontend (Vercel):** https://tzchat-theta.vercel.app
- **Live Backend API (Render):** https://tzchat-backend.onrender.com
- **Live API Docs (Swagger UI):** https://tzchat-backend.onrender.com/api/docs/

## Features
- Secure JWT authentication with rotating `HttpOnly` refresh cookies, multi-country phone registration, and Terms & Services
- User profiles with Pillow-validated avatars, cover images, Profile Views tracking, and backend-enforced image privacy
- Independent Followers (with optional approval) and Mutual Friends systems
- Text, image, and video posts with custom captions, feelings, visibility, nested comment replies, and likes
- Real-time 1-to-1 and WhatsApp-style Group messaging via Django Channels (WebSockets) with live voice message recording, file attachments, quoted replies, typing indicators, read receipts, and Message Requests
- Group Management (group picture, description, owner/admin roles, send/edit/invite permissions, multi-select participants, and shareable/revocable invite links)
- Signal-driven Notifications (mark read, clear one, selected, or all), Privacy Settings, User Blocking, and Permission-based Contact Discovery
- Permanent cloud media storage via Cloudinary in production (images, videos, voice notes, and avatars)
- Reporting with date-range filtering & PDF export, RBAC Admin Portal, and immutable Audit Logs
- Fully responsive across mobile, tablet, and desktop
- OpenAPI / Swagger UI documentation via `drf-spectacular`

## Technology Stack
- **Backend:** Python 3.12, Django 5.1, Django REST Framework, PostgreSQL, Django Channels (Daphne), Simple JWT, `drf-spectacular`, Pillow, Cloudinary, WhiteNoise, `python-dotenv`
- **Frontend:** React, Vite, JavaScript, HTML5, CSS3
- **Hosting:** Vercel (Frontend), Render (Backend + PostgreSQL), Cloudinary (Media)

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
