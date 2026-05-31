"""Email delivery service for research reports."""

from __future__ import annotations

import os
from email.message import EmailMessage

import aiosmtplib
from dotenv import load_dotenv

load_dotenv()


class EmailError(RuntimeError):
    """Raised when email sending fails."""


async def send_research_email(
    to_email: str,
    subject: str,
    body: str,
    pdf_data: bytes | None = None,
    pdf_filename: str = "research_report.pdf",
) -> None:
    """
    Send research report via email with optional PDF attachment.
    
    Args:
        to_email: Recipient email address
        subject: Email subject line
        body: Email body content (plain text or HTML)
        pdf_data: Optional PDF file content as bytes
        pdf_filename: Filename for PDF attachment
    
    Raises:
        EmailError: If email sending fails
    """
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user)
    from_name = os.getenv("SMTP_FROM_NAME", "AgentOffice Research")
    
    if not smtp_user or not smtp_password:
        raise EmailError(
            "SMTP_USER and SMTP_PASSWORD environment variables must be set."
        )
    
    message = EmailMessage()
    message["From"] = f"{from_name} <{from_email}>"
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)
    
    if pdf_data:
        message.add_attachment(
            pdf_data,
            maintype="application",
            subtype="pdf",
            filename=pdf_filename,
        )
    
    try:
        await aiosmtplib.send(
            message,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_user,
            password=smtp_password,
            start_tls=True,
        )
    except Exception as error:
        raise EmailError(f"Failed to send email: {error}") from error


def is_email_configured() -> bool:
    """Check if email credentials are configured."""
    return bool(os.getenv("SMTP_USER") and os.getenv("SMTP_PASSWORD"))
