"""
Email service – Stage 4.
Sends emails via SMTP (compatible with Mailpit / MailHog on port 1025,
or real SMTP with TLS on port 587).
Uses asyncio.to_thread so the sync smtplib call doesn't block the event loop.
"""

import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import get_settings

settings = get_settings()


def _send_sync(to_email: str, subject: str, html_body: str) -> None:
    """Blocking SMTP send – run via asyncio.to_thread."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
    msg["To"] = to_email

    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.EMAILS_FROM_EMAIL, to_email, msg.as_string())


async def send_email(to_email: str, subject: str, html_body: str) -> None:
    """Async wrapper – fire and forget safe."""
    try:
        await asyncio.to_thread(_send_sync, to_email, subject, html_body)
    except Exception as exc:
        # Log but don't crash the request if mail server is down
        import logging
        logging.getLogger(__name__).warning("Failed to send email to %s: %s", to_email, exc)


# ── Email templates ───────────────────────────────────────────────────────────

def activation_email_html(activation_link: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Activate your account</title>
</head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;
                      border:1px solid rgba(139,92,246,0.3);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(139,92,246,0.2);">
              <h1 style="margin:0;font-size:22px;color:#a78bfa;letter-spacing:1px;">
                🔐 Activate Your Account
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 16px;color:#c4c4d4;font-size:15px;line-height:1.6;">
                Thanks for signing up! Click the button below to activate your account.
                This link is valid for <strong style="color:#a78bfa;">24 hours</strong>.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="{activation_link}"
                   style="display:inline-block;padding:14px 36px;
                          background:linear-gradient(135deg,#7c3aed,#a855f7);
                          color:#fff;font-size:15px;font-weight:600;
                          border-radius:8px;text-decoration:none;letter-spacing:0.5px;">
                  Activate Account
                </a>
              </div>
              <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
                If the button doesn't work, paste this link into your browser:<br>
                <a href="{activation_link}" style="color:#a78bfa;word-break:break-all;">
                  {activation_link}
                </a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(139,92,246,0.2);">
              <p style="margin:0;color:#4b5563;font-size:12px;">
                If you didn't create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
