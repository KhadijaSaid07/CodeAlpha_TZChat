#!/usr/bin/env python3
"""
Automated TZChat Full HD 1080p LinkedIn Demo Video Generator
------------------------------------------------------------
Records a crisp Full HD 1080p walkthrough of TZChat in Chromium with visible
click highlights, registering as Khadija Said (@Khalsa09 / khalsa09@gmail.com),
posting, liking, commenting, exploring, creating a WhatsApp-style Group,
opening Group Info, messaging, notifications, and settings — paired with an
upbeat, cheerful narration voiceover (no background music).

Run:
    python3 scripts/make_tzchat_demo_video.py --url https://tzchat-theta.vercel.app
    # Or against your local server:
    python3 scripts/make_tzchat_demo_video.py --url http://localhost:5173
"""

import argparse
import asyncio
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

NARRATION_TEXT = (
    "Hello everyone! My name is Khalsa Said, and I am so excited to show you TZChat — "
    "Connect, Chat, Share — a full-stack social networking and real-time messaging web app "
    "built with Django, PostgreSQL, Django Channels WebSockets, and React. "
    "Let's walk through every feature step by step! "
    "First, a new user registers with their full name, Khalsa Said, username Khalsa010, "
    "email khalsa010@gmail.com, multi-country phone number, and secure password validation. "
    "Once registered, we log in with secure JWT authentication and land right on the Home Feed. "
    "Here, users can publish simple posts with photos, videos, and custom captions, like posts, "
    "and engage in nested comment replies in real time. "
    "In Explore and Profile, users discover people, follow or add friends independently, "
    "and view profile visitors with complete privacy controls. "
    "Next, let's check out WhatsApp-style Group Chats! We create a new group with a name and description, "
    "which opens the live group chat immediately. "
    "Inside the chat, users can send real-time messages, attachments, quoted replies, and live voice notes, "
    "and open Group Info to manage participants, edit group details, set admin permissions, "
    "and share or revoke clickable invite links. "
    "In Messages, every private and group chat shows real names, avatars, timestamps, and unread badges. "
    "Finally, users can manage real-time notifications — marking as read or clearing one, selected, or all — "
    "and customize their privacy and security settings. "
    "Thank you for watching! Check out the live app and GitHub link in the post below."
)

# Subtle visual ripple on every click so LinkedIn viewers can follow every action clearly
CLICK_RIPPLE_JS = """
(() => {
  const style = document.createElement('style');
  style.textContent = `
    .demo-click-ripple {
      position: fixed;
      width: 28px;
      height: 28px;
      margin-left: -14px;
      margin-top: -14px;
      border-radius: 50%;
      border: 3px solid #1565f5;
      background: rgba(21, 101, 245, 0.22);
      pointer-events: none;
      z-index: 999999;
      transform: scale(0.4);
      opacity: 1;
      transition: transform 0.45s ease-out, opacity 0.45s ease-out;
    }
  `;
  document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
  document.addEventListener('click', (e) => {
    const dot = document.createElement('div');
    dot.className = 'demo-click-ripple';
    dot.style.left = e.clientX + 'px';
    dot.style.top = e.clientY + 'px';
    document.body.appendChild(dot);
    requestAnimationFrame(() => {
      dot.style.transform = 'scale(2.1)';
      dot.style.opacity = '0';
    });
    setTimeout(() => dot.remove(), 500);
  }, true);
})();
"""


async def generate_voiceover(text: str, voice: str, out_mp3: Path):
    import edge_tts

    communicate = edge_tts.Communicate(text, voice=voice, rate="+5%", pitch="+5Hz")
    await communicate.save(str(out_mp3))


def slow_pause(seconds: float):
    time.sleep(seconds)


def warmup_backend(frontend_url: str):
    """Wake up Render backend before recording so there is no cold-start delay in the video."""
    if "localhost" in frontend_url or "127.0.0.1" in frontend_url:
        return
    print("[0/3] Waking up Render backend (this may take 15-45s on Free tier) ...")
    try:
        req = urllib.request.Request("https://tzchat-backend.onrender.com/api/schema/")
        urllib.request.urlopen(req, timeout=90).read(64)
    except Exception:
        # Even a 401/403/404 response means Render is awake!
        pass
    print("      Backend is awake!")


def safe_goto(page, url: str, pause: float = 2.5):
    page.goto(url, wait_until="domcontentloaded", timeout=90000)
    slow_pause(pause)


def record_demo(args, raw_video_dir: Path) -> Path:
    base_url = args.url.rstrip("/")
    warmup_backend(base_url)
    print(f"[1/3] Launching Full HD Chromium and recording live demo at {base_url} ...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=args.headless)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=1,
            record_video_dir=str(raw_video_dir),
            record_video_size={"width": 1920, "height": 1080},
        )
        context.add_init_script(CLICK_RIPPLE_JS)
        page = context.new_page()
        page.set_default_timeout(60000)

        # Scene 1: Welcome Page
        safe_goto(page, f"{base_url}/", pause=3.0)

        # Scene 2: Register as Khadija Said / Khalsa09 / khalsa09@gmail.com
        safe_goto(page, f"{base_url}/register", pause=1.8)
        page.get_by_placeholder("Full Name").wait_for(state="visible", timeout=30000)
        page.get_by_placeholder("Full Name").type(args.fullname, delay=60)
        page.get_by_placeholder("Username").type(args.username, delay=60)
        page.get_by_placeholder("Email Address").type(args.email, delay=50)
        page.get_by_placeholder("Phone number (e.g. 712345678)").type(args.phone, delay=55)
        page.get_by_placeholder("Password (min 8 characters)").type(args.password, delay=40)
        page.get_by_placeholder("Confirm Password").type(args.password, delay=40)
        page.locator('input[type="checkbox"]').first.check()
        slow_pause(1.0)
        page.get_by_role("button", name="Create Account").click()
        slow_pause(4.0)

        # Scene 3: Login (handles BOTH normal /login redirect AND auto-login to /home!)
        slow_pause(2.5)
        print(f"      After register, current URL: {page.url}")
        if "/home" not in page.url:
            if "/login" not in page.url:
                login_link = page.locator('a[href="/login"]').first
                if login_link.count() > 0 and login_link.is_visible():
                    login_link.click()
                else:
                    safe_goto(page, f"{base_url}/login", pause=1.5)

            # Wait for EITHER the Login username input OR the Home feed composer (if already logged in)
            page.locator('input[name="username"], textarea').first.wait_for(state="visible", timeout=60000)
            slow_pause(0.8)
            print(f"      Ready at URL: {page.url}")

            login_input = page.locator('input[name="username"]').first
            if "/login" in page.url and login_input.count() > 0 and login_input.is_visible():
                login_input.fill("")
                login_input.type(args.login_username or args.username, delay=55)
                pwd_input = page.locator('input[type="password"]').first
                pwd_input.fill("")
                pwd_input.type(args.login_password or args.password, delay=45)
                slow_pause(0.8)
                page.get_by_role("button", name="Login").click()
                page.locator("textarea").first.wait_for(state="visible", timeout=60000)
                slow_pause(2.0)

        # Scene 4: Home Feed — post profile.png with nice simple words, like & comment
        if "/home" not in page.url:
            safe_goto(page, f"{base_url}/home", pause=2.5)
        else:
            slow_pause(2.0)

        img_path = Path(args.image).expanduser()

        # Post: Simple nice text + Desktop/profile.png
        try:
            composer = page.locator("textarea").first
            if composer.is_visible():
                composer.click()
                composer.type("Hello everyone! Happy to be on TZChat — Connect, Chat, Share!", delay=40)
                if img_path.exists():
                    page.locator('input[type="file"][accept="image/*"]').first.set_input_files(str(img_path))
                    slow_pause(1.0)
                    cap = page.get_by_placeholder("Write an explanation or caption for this picture (optional)")
                    if cap.is_visible():
                        cap.type("Sharing my first photo on TZChat!", delay=40)
                slow_pause(0.8)
                page.get_by_role("button", name="Post").first.click()
                slow_pause(4.0)
        except Exception as exc:
            print("Note (photo post):", exc)

        # Like & comment on top post
        try:
            like_btn = page.locator('button:has-text("Like")').first
            if like_btn.is_visible():
                like_btn.click()
                slow_pause(1.5)
            comment_btn = page.locator('button:has-text("Comment")').first
            if comment_btn.is_visible():
                comment_btn.click()
                slow_pause(1.2)
                comment_input = page.get_by_placeholder("Write a comment...").first
                if comment_input.is_visible():
                    comment_input.type("Welcome to TZChat! Everything works smoothly.", delay=45)
                    comment_input.press("Enter")
                    slow_pause(2.0)
        except Exception:
            pass

        page.mouse.wheel(0, 460)
        slow_pause(2.5)
        page.mouse.wheel(0, -460)
        slow_pause(1.0)

        # Scene 5: Explore & Profile
        safe_goto(page, f"{base_url}/explore", pause=3.5)
        safe_goto(page, f"{base_url}/profile", pause=3.5)

        # Scene 6: WhatsApp-style Group Creation, Live Chat & Group Info
        safe_goto(page, f"{base_url}/groups", pause=2.2)
        try:
            new_grp = page.get_by_role("button", name="+ New Group")
            if new_grp.is_visible():
                new_grp.click()
                slow_pause(1.5)
                page.get_by_placeholder("Group Name (required)").type("TZChat Tech Community", delay=55)
                page.get_by_placeholder("Group Description (optional)").type(
                    "Sharing updates, code, and ideas together!", delay=45
                )
                slow_pause(1.0)
                page.get_by_role("button", name="Create Group & Open Chat").click()
                slow_pause(4.0)
        except Exception:
            pass

        # Send a live message inside the newly opened group chat & open Group Info
        try:
            msg_input = page.get_by_placeholder("Message")
            if msg_input.is_visible():
                msg_input.type("Welcome everyone to TZChat Tech Community!", delay=45)
                slow_pause(0.8)
                page.get_by_role("button", name="Send").click()
                slow_pause(2.5)
            info_btn = page.locator('button:has-text("Info")').first
            if info_btn.is_visible():
                info_btn.click()
                slow_pause(3.5)
                page.mouse.wheel(0, 350)
                slow_pause(2.5)
        except Exception:
            pass

        # Scene 7: Messages list
        safe_goto(page, f"{base_url}/messages", pause=3.5)

        # Scene 8: Notifications & Settings
        safe_goto(page, f"{base_url}/notifications", pause=3.5)
        safe_goto(page, f"{base_url}/settings", pause=3.0)

        video_path = Path(page.video.path())
        context.close()
        browser.close()
        return video_path


def main():
    parser = argparse.ArgumentParser(description="Generate a Full HD 1080p LinkedIn demo video for TZChat.")
    parser.add_argument("--url", default="https://tzchat-theta.vercel.app", help="TZChat frontend URL")
    parser.add_argument("--fullname", default="Khalsa Said", help="Full name to type on Register")
    parser.add_argument("--username", default="Khalsa010", help="Username to type on Register")
    parser.add_argument("--email", default="khalsa010@gmail.com", help="Email to type on Register")
    parser.add_argument("--phone", default="718945210", help="Local phone digits to type on Register")
    parser.add_argument("--password", default="User@123", help="Password to type on Register")
    parser.add_argument("--image", default=str(Path.home() / "Desktop" / "profile.png"), help="Image file to post")
    parser.add_argument("--login-username", default="", help="Fallback username if Register user already exists")
    parser.add_argument("--login-password", default="", help="Fallback password if Register user already exists")
    parser.add_argument("--voice", default="en-US-AriaNeural", help="Upbeat edge-tts neural voice")
    parser.add_argument("--no-audio", action="store_true", help="Export silent Full HD 1080p video only")
    parser.add_argument("--headless", action="store_true", help="Run browser invisibly in background")
    parser.add_argument(
        "--output",
        default=str(Path.home() / "Desktop" / "tzchat_linkedin_demo_hd.mp4"),
        help="Final Full HD MP4 output path",
    )
    args = parser.parse_args()

    if not shutil.which("ffmpeg"):
        raise SystemExit("ERROR: ffmpeg is not installed. Run: sudo apt update && sudo apt install -y ffmpeg")

    output_path = Path(args.output).expanduser().resolve()
    with tempfile.TemporaryDirectory(prefix="tzchat_demo_") as tmp:
        tmp_dir = Path(tmp)
        raw_video = record_demo(args, tmp_dir)

        if args.no_audio:
            print("[2/2] Encoding silent Full HD 1080p MP4 ...")
            cmd = [
                "ffmpeg", "-y", "-i", str(raw_video),
                "-vf", "scale=1920:1080:flags=lanczos",
                "-r", "30",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow",
                "-movflags", "+faststart",
                str(output_path),
            ]
        else:
            audio_mp3 = tmp_dir / "narration.mp3"
            print(f"[2/3] Generating upbeat cheerful voiceover ({args.voice}, no music) ...")
            asyncio.run(generate_voiceover(NARRATION_TEXT, args.voice, audio_mp3))

            print("[3/3] Merging Full HD 1080p screen recording + upbeat voiceover ...")
            cmd = [
                "ffmpeg", "-y",
                "-i", str(raw_video),
                "-i", str(audio_mp3),
                "-vf", "scale=1920:1080:flags=lanczos,tpad=stop_mode=clone:stop_duration=20",
                "-r", "30",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow",
                "-c:a", "aac", "-b:a", "192k",
                "-movflags", "+faststart",
                "-shortest",
                str(output_path),
            ]

        subprocess.run(cmd, check=True)
        print(f"\nDONE! Your Full HD 1080p LinkedIn demo video is saved at:\n  {output_path}")


if __name__ == "__main__":
    main()
