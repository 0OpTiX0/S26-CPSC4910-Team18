import smtplib
from email.message import EmailMessage
import os
from pathlib import Path
from dotenv import load_dotenv

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587

# Load environment variables from app/.env or repo-root .env
BASE_DIR = Path(__file__).resolve().parent
for env_path in (BASE_DIR / ".env", BASE_DIR.parent / ".env"):
    if env_path.exists():
        load_dotenv(env_path)
        break

# Function to send emails to Sponsors.
def emailSponsor(senderEmail: str, sponsorEmail: str) -> bool:
    smtp_user = os.getenv("EMAIL_CLIENT")
    smtp_app_pass = os.getenv("EMAIL_APP_PASSWORD")
    smtp_pass_fallback = os.getenv("EMAIL_PASSWORD")

    # Prefer app password when provided; fall back to normal password.
    smtp_pass = smtp_app_pass or smtp_pass_fallback
    if not smtp_user or not smtp_pass:
        print("Error: EMAIL_CLIENT and EMAIL_APP_PASSWORD or EMAIL_PASSWORD environment variables must be set")
        return False
    try:
        msg = EmailMessage()
        msg["From"] = smtp_user
        msg["To"] = sponsorEmail
        msg["Subject"] = "New Driver Application"
        msg.set_content(
            f"A new driver application was submitted.\n"
            f"Sender: {senderEmail}\n"
        )

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(smtp_user, smtp_pass)
            smtp.send_message(msg)

        return True
    
    except Exception as e:
        print(f"Email send failed: {e}")
        return False


def passwordResetEmail(recipient: str, verifcode: str) -> bool:
    smtp_user = os.getenv("EMAIL_CLIENT")
    smtp_app_pass = os.getenv("EMAIL_APP_PASSWORD")
    smtp_pass_fallback = os.getenv("EMAIL_PASSWORD")

    # Prefer app password when provided; fall back to normal password.
    smtp_pass = smtp_app_pass or smtp_pass_fallback
    if not smtp_user or not smtp_pass:
        print("Error: EMAIL_CLIENT and EMAIL_APP_PASSWORD or EMAIL_PASSWORD environment variables must be set")
        return False
    try:
        msg = EmailMessage()
        msg["From"] = smtp_user
        msg["To"] = recipient
        msg["Subject"] = "Password change request"
        msg.set_content(
            
            
            
            f"A new driver application was submitted.\n"
            f"\n\n\n\n"
            f"A password request was made for your account"
            f"Use this code: {verifcode} to successfully make the password change when you navigate to"
            f" http://yourapp.com/verificationpage.html\n"
            f"Sender: {smtp_user}\n"
        )

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(smtp_user, smtp_pass)
            smtp.send_message(msg)

        return True
    
    except Exception as e:
        print(f"Email send failed: {e}")
        return False
