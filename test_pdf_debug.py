#!/usr/bin/env python3
from src.model.analyzer import GoszakupAnalyzer
import io
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from datetime import datetime
import traceback

try:
    analyzer = GoszakupAnalyzer(use_transformers=False)
    result = analyzer.analyze_lot('86187770-ЗЦП3')
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, 
                           topMargin=2*cm, bottomMargin=2*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        spaceAfter=12,
    )
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=12,
        spaceAfter=8,
        textColor=colors.HexColor('#1a365d'),
    )
    
    story = []
    lot = result.lot_data
    
    print(f"Lot ID: {result.lot_id}")
    print(f"Lot data keys: {list(lot.keys())}")
    
    # Title
    story.append(Paragraph(f"<b>Анализ рисков закупки</b>", title_style))
    story.append(Paragraph(f"Лот: {lot.get('name_ru', 'N/A')}", styles['Normal']))
    story.append(Paragraph(f"ID: {result.lot_id}", styles['Normal']))
    story.append(Spacer(1, 0.5*cm))
    
    # Risk Score
    risk_level_ru = {
        'LOW': 'Низкий',
        'MEDIUM': 'Средний', 
        'HIGH': 'Высокий',
        'CRITICAL': 'Критический'
    }.get(result.final_level, result.final_level)
    
    story.append(Paragraph(f"<b>Уровень риска: {risk_level_ru}</b>", heading_style))
    story.append(Paragraph(f"Оценка: {result.final_score:.1f} / 100", styles['Normal']))
    story.append(Spacer(1, 0.3*cm))
    
    # Lot Details
    story.append(Paragraph("<b>Информация о лоте</b>", heading_style))
    lot_details = [
        ['Категория:', lot.get('category_name', 'N/A')],
        ['Город:', lot.get('city', 'N/A')],
        ['Бюджет:', f"{lot.get('budget', 0):,.0f} ₸".replace(',', ' ')],
        ['Участников:', str(lot.get('participants_count', 0))],
        ['Срок подачи:', f"{lot.get('deadline_days', 0)} дней"],
    ]
    
    if lot.get('customer_name'):
        lot_details.append(['Заказчик:', lot['customer_name']])
    
    lot_table = Table(lot_details, colWidths=[4*cm, 12*cm])
    lot_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(lot_table)
    story.append(Spacer(1, 0.5*cm))
    
    # Risk Rules
    if result.rule_analysis and result.rule_analysis.rules_triggered:
        story.append(Paragraph(f"<b>Обнаружено нарушений: {len(result.rule_analysis.rules_triggered)}</b>", heading_style))
        
        for rule in result.rule_analysis.rules_triggered[:10]:  # Top 10 rules
            rule_dict = rule.to_dict() if hasattr(rule, 'to_dict') else rule
            rule_text = f"<b>{rule_dict.get('rule_name_ru', 'N/A')}</b><br/>"
            rule_text += f"<i>{rule_dict.get('explanation_ru', '')}</i><br/>"
            rule_text += f"Вес: {rule_dict.get('weight', 0):.1f}, "
            rule_text += f"Балл: {rule_dict.get('raw_score', 0):.1f}"
            
            story.append(Paragraph(rule_text, styles['Normal']))
            story.append(Spacer(1, 0.2*cm))
    
    story.append(Spacer(1, 0.5*cm))
    
    # Summary
    if result.rule_analysis and result.rule_analysis.summary_ru:
        story.append(Paragraph("<b>Резюме</b>", heading_style))
        story.append(Paragraph(result.rule_analysis.summary_ru, styles['Normal']))
    
    # Footer
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph(
        f"<i>Отчет сгенерирован: {datetime.now().strftime('%d.%m.%Y %H:%M')}</i>",
        styles['Normal']
    ))
    story.append(Paragraph(
        "<i>GoszakupAI - Система анализа рисков государственных закупок РК</i>",
        styles['Normal']
    ))
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    
    print(f"✓ PDF generated successfully, size: {len(buffer.getvalue())} bytes")
    
except Exception as e:
    print(f'✗ Error: {e}')
    traceback.print_exc()
