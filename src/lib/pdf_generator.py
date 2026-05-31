"""PDF generation for research reports."""

from __future__ import annotations

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)


def generate_research_pdf(goal: str, final_output: str) -> bytes:
    """
    Generate a formatted PDF report from research results.
    
    Args:
        goal: Research query/goal
        final_output: Complete research output with citations
    
    Returns:
        PDF file content as bytes
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=18,
    )
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Heading1"],
        fontSize=24,
        textColor=colors.HexColor("#1a1a1a"),
        spaceAfter=30,
        alignment=1,
    )
    
    heading_style = ParagraphStyle(
        "CustomHeading",
        parent=styles["Heading2"],
        fontSize=16,
        textColor=colors.HexColor("#2c3e50"),
        spaceAfter=12,
        spaceBefore=12,
    )
    
    body_style = ParagraphStyle(
        "CustomBody",
        parent=styles["BodyText"],
        fontSize=11,
        leading=16,
        textColor=colors.HexColor("#333333"),
        spaceAfter=12,
    )
    
    meta_style = ParagraphStyle(
        "MetaInfo",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#7f8c8d"),
        spaceAfter=20,
    )
    
    story = []
    
    story.append(Paragraph("Research Report", title_style))
    story.append(Spacer(1, 0.2 * inch))
    
    story.append(Paragraph(f"<b>Research Query:</b> {goal}", heading_style))
    story.append(Spacer(1, 0.1 * inch))
    
    timestamp = datetime.now().strftime("%B %d, %Y at %I:%M %p")
    story.append(Paragraph(f"Generated: {timestamp}", meta_style))
    story.append(Paragraph("Powered by AgentOffice Multi-Agent Research System", meta_style))
    story.append(Spacer(1, 0.3 * inch))
    
    sections = final_output.split("---")
    
    for section in sections:
        section = section.strip()
        if not section:
            continue
        
        lines = section.split("\n")
        for line in lines:
            line = line.strip()
            if not line:
                story.append(Spacer(1, 0.1 * inch))
                continue
            
            if line.startswith("## "):
                story.append(Paragraph(line[3:], heading_style))
            elif line.startswith("### "):
                story.append(Paragraph(line[4:], heading_style))
            else:
                story.append(Paragraph(line, body_style))
    
    doc.build(story)
    
    pdf_data = buffer.getvalue()
    buffer.close()
    
    return pdf_data
