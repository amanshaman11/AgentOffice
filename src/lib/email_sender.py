"""Email sending for research reports."""

from __future__ import annotations

import os
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib
from dotenv import load_dotenv

load_dotenv()


class EmailError(RuntimeError):
    pass


async def send_research_email(
    to_email: str,
    subject: str,
    body: str,
    pdf_data: bytes | None = None,
    pdf_filename: str = "research_report.pdf",
) -> None:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user)
    from_name = os.getenv("SMTP_FROM_NAME", "AgentOffice Research")
    
    if not all([smtp_host, smtp_user, smtp_password]):
        raise EmailError(
            "SMTP_HOST, SMTP_USER, and SMTP_PASSWORD environment variables must be set."
        )
    
    msg = MIMEMultipart()
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    
    msg.attach(MIMEText(body, "plain"))
    
    if pdf_data:
        pdf_attachment = MIMEApplication(pdf_data, _subtype="pdf")
        pdf_attachment.add_header(
            "Content-Disposition", "attachment", filename=pdf_filename
        )
        msg.attach(pdf_attachment)
    
    try:
        await aiosmtplib.send(
            msg,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_user,
            password=smtp_password,
            start_tls=True,
        )
    except Exception as error:
        raise EmailError(f"Failed to send email: {error}") from error


def is_email_configured() -> bool:
    return bool(
        os.getenv("SMTP_HOST")
        and os.getenv("SMTP_USER")
        and os.getenv("SMTP_PASSWORD")
    )
