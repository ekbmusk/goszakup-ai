"""
Test PDF generation with Cyrillic support
"""
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import io

# Register DejaVu fonts
font_base = '/usr/local/lib/python3.11/site-packages/matplotlib/mpl-data/fonts/ttf'
pdfmetrics.registerFont(TTFont('DejaVu', f'{font_base}/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVu-Bold', f'{font_base}/DejaVuSans-Bold.ttf'))
print("✓ Fonts registered")

# Create PDF
buffer = io.BytesIO()
doc = SimpleDocTemplate(buffer, pagesize=A4)

styles = getSampleStyleSheet()
styles['Normal'].fontName = 'DejaVu'
styles['Normal'].fontSize = 12

title_style = ParagraphStyle(
    'CustomTitle',
    parent=styles['Heading1'],
    fontName='DejaVu-Bold',
    fontSize=18,
    textColor=colors.HexColor('#1a365d'),
)

story = []
story.append(Paragraph("<b>Тест кириллицы в PDF</b>", title_style))
story.append(Spacer(1, 0.5*cm))
story.append(Paragraph("Анализ рисков закупки", styles['Normal']))
story.append(Paragraph("Категория: Медицинское оборудование", styles['Normal']))
story.append(Paragraph("Уровень риска: Высокий", styles['Normal']))
story.append(Paragraph("Бюджет: 980 000 000 ₸", styles['Normal']))

doc.build(story)

# Save to file
pdf_data = buffer.getvalue()
with open('/tmp/test_cyrillic.pdf', 'wb') as f:
    f.write(pdf_data)

print(f"✓ PDF created: {len(pdf_data)} bytes")
print("✓ Saved to /tmp/test_cyrillic.pdf")
