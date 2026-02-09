import smtplib
from email.message import EmailMessage
import os

SMTP_HOST = "smtp.office365.com"
SMTP_PORT = 587
SMTP_USER = os.getenv("EMAIL_CLIENT")         # your Outlook address
SMTP_APP_PASS = os.getenv("EMAIL_APP_PASSWORD")
SMTP_PASS = os.getenv("EMAIL_PASSWORD")

# Function to send emails to Sponsors.
def emailSponsor(senderEmail: str, sponsorEmail: str) -> bool:
    # Prefer app password when provided; fall back to normal password.
    smtp_pass = SMTP_APP_PASS or SMTP_PASS
    if not SMTP_USER or not smtp_pass:
        print("Error: EMAIL_CLIENT and EMAIL_APP_PASSWORD or EMAIL_PASSWORD environment variables must be set")
        return False
    try:
        msg = EmailMessage()
        msg["From"] = SMTP_USER
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
            smtp.login(SMTP_USER, smtp_pass)
            smtp.send_message(msg)

        return True
    
    except Exception as e:
        print(f"Email send failed: {e}")
        return False
