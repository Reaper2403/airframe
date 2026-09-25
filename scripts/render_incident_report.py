"""Render a validated incident brief as exactly one readable A4 page.

Input is JSON on stdin; no model text is executable or interpreted as markup.
Fails instead of clipping or silently dropping content when the page is full.
"""
import json
import sys
from html import escape
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph

INK = HexColor('#142537')
MUTED = HexColor('#516475')
TEAL = HexColor('#087e8b')
LIGHT = HexColor('#edf5f7')
WIDTH, HEIGHT = A4
MARGIN = 38


def clean(value):
    return str(value).translate(str.maketrans({'\u2011': '-', '\u2013': '-', '\u2014': '-', '\u2019': "'", '\u2018': "'", '\u201c': '"', '\u201d': '"', '\u2022': '-'}))


def paragraph(text, x, y, width, size=9.4, bold=False, color=INK):
    style = ParagraphStyle('brief', fontName='Helvetica-Bold' if bold else 'Helvetica', fontSize=size, leading=size * 1.32, textColor=color)
    obj = Paragraph(escape(clean(text)).replace('\n', '<br/>'), style)
    _, height = obj.wrap(width, HEIGHT)
    return obj, height


def layout(doc, size):
    operations = []
    y = HEIGHT - 40
    width = WIDTH - 2 * MARGIN

    def put(text, font=size, bold=False, color=INK, indent=0, gap=5):
        nonlocal y
        obj, h = paragraph(text, MARGIN + indent, y, width - indent, font, bold, color)
        operations.append(('text', obj, MARGIN + indent, y - h))
        y -= h + gap

    put('AIRFRAME  /  INCIDENT BRIEF', 9, True, TEAL, gap=10)
    put(doc['report']['title'], 19, True, gap=8)
    put(doc['scopeLabel'], 8.2, color=MUTED, gap=3)
    put(doc['windowLabel'], 8.2, color=MUTED, gap=10)
    put(doc['report']['summary'], size + .3, gap=13)
    for index, finding in enumerate(doc['report']['findings'], 1):
        operations.append(('line', y + 3))
        y -= 7
        put(f"{index:02d}  {finding['title']}", size + 1.5, True, gap=7)
        put(finding['observation'], bold=True, gap=5)
        put(finding['reasoning'], gap=4)
        put('Limit: ' + finding['alternative'], font=size - .4, color=MUTED, gap=5)
        put('Next check: ' + finding['nextCheck'], font=size - .1, gap=5)
        put('Evidence: ' + ', '.join(finding['evidenceIds']) + '  |  ' + finding['confidence'], font=7.6, color=TEAL, gap=11)
    put('INTERPRETATION LIMITS', 8, True, TEAL, gap=5)
    put(' '.join(doc['report']['limitations']), font=size - .4, color=MUTED, gap=8)
    return operations, y


def render(doc, destination):
    chosen = None
    for size in [9.5, 9.2, 9.0, 8.8]:
        operations, remaining = layout(doc, size)
        if remaining >= 78:
            chosen = operations
            break
    if chosen is None:
        raise ValueError('Report is too long for one readable page; shorten it before rendering.')
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(destination), pagesize=A4)
    pdf.setTitle(clean(doc['report']['title']))
    pdf.setAuthor('Airframe - AI-assisted network investigation')
    pdf.setFillColor(TEAL)
    pdf.rect(0, HEIGHT - 8, WIDTH, 8, fill=1, stroke=0)
    for operation in chosen:
        if operation[0] == 'text':
            _, obj, x, y = operation
            obj.drawOn(pdf, x, y)
        else:
            pdf.setStrokeColor(HexColor('#d5e2e7'))
            pdf.setLineWidth(.6)
            pdf.line(MARGIN, operation[1], WIDTH - MARGIN, operation[1])
    pdf.setFillColor(LIGHT)
    pdf.rect(MARGIN, 24, WIDTH - 2 * MARGIN, 44, fill=1, stroke=0)
    footer = f"AI-assisted analysis - engineer review required. {doc['model']} | {doc['generatedAt'][:16].replace('T', ' ')} UTC\nEvidence snapshot {doc['evidenceHash'][:16]} | References resolve in the saved JSON evidence packet. 1 / 1"
    obj, h = paragraph(footer, 0, 0, WIDTH - 2 * MARGIN - 18, 7.5, color=MUTED)
    obj.drawOn(pdf, MARGIN + 9, 34)
    pdf.showPage()
    pdf.save()


if __name__ == '__main__':
    try:
        render(json.load(sys.stdin), sys.argv[1])
    except Exception:
        print('PDF could not be rendered as one page.', file=sys.stderr)
        sys.exit(1)
