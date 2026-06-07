import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image as RLImage,
    Table, TableStyle, HRFlowable
)
from config.constants import ANIO_ACTUAL, ANIO_SIG

PDF_OK = True

def generar_pdf(equipo_nombre, estado_final, acciones, diagnostico, recomendaciones, 
                analisis_completo, imagenes, perfil, historial):
    """Genera el PDF del informe de inspección"""
    
    if not PDF_OK:
        return None
    
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, 
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2.2*cm, bottomMargin=2*cm,
        title=f"Informe {equipo_nombre}"
    )
    
    styles = getSampleStyleSheet()
    
    # Colores
    CD = colors.HexColor("#0d1117")
    CC = colors.HexColor("#00c8d7")
    CT = colors.HexColor("#2c3e50")
    CM = colors.HexColor("#7f8c8d")
    CB = colors.HexColor("#f4f6f9")
    CBR = colors.HexColor("#dde3ec")
    
    col_estado = {
        "BUENO": colors.HexColor("#00a651"),
        "REGULAR": colors.HexColor("#f39c12"),
        "CRÍTICO": colors.HexColor("#c0392b")
    }.get(estado_final.upper(), CM)
    
    def es(name, **kw):
        return ParagraphStyle(name, parent=styles["Normal"], **kw)
    
    st_tit = es("t", fontSize=20, fontName="Helvetica-Bold", textColor=CD, spaceAfter=4)
    st_sub = es("s", fontSize=9, fontName="Helvetica", textColor=CM, spaceAfter=2)
    st_sec = es("se", fontSize=11, fontName="Helvetica-Bold", textColor=CD, spaceBefore=8, spaceAfter=4)
    st_bod = es("b", fontSize=9, fontName="Helvetica", textColor=CT, leading=14, alignment=TA_JUSTIFY)
    st_bul = es("bu", fontSize=9, fontName="Helvetica", textColor=CT, leading=14, leftIndent=12)
    st_lab = es("l", fontSize=8, fontName="Helvetica-Bold", textColor=CM)
    st_val = es("v", fontSize=9, fontName="Helvetica", textColor=CT)
    
    story = []
    
    # Header
    story.append(Paragraph("ARAUCO", st_tit))
    story.append(Paragraph("INFORME DE INSPECCIÓN INDUSTRIAL", st_sub))
    story.append(Spacer(1, 10))
    story.append(Paragraph(equipo_nombre.upper(), st_tit))
    story.append(Spacer(1, 6))
    
    # Ficha técnica
    data = [
        ["FECHA", datetime.now().strftime("%d/%m/%Y"), "ESTADO", estado_final],
        ["INSPECTOR", perfil.get("nombre", "—"), "MODELO IA", "Gemini 2.5 Flash"],
    ]
    if historial:
        data.append(["ÁREA", historial.get("area", "—"), "MATERIAL", historial.get("material", "—")])
        data.append(["CRITICIDAD", historial.get("criticidad", "—"), "IMÁGENES", str(len(imagenes))])
    
    table = Table(data, colWidths=[3*cm, 5*cm, 3*cm, 5*cm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (1, -1), CB),
        ("BACKGROUND", (2, 0), (3, 0), col_estado),
        ("BACKGROUND", (2, 1), (3, -1), CB),
        ("GRID", (0, 0), (-1, -1), 0.5, CBR),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(table)
    story.append(Spacer(1, 10))
    
    # Historial previo
    if historial:
        story.append(Paragraph("HISTORIAL PREVIO", st_sec))
        
        hist_data = [["AÑO", "ESTADO", "DIAGNÓSTICO"]]
        for año in [2024, 2025]:
            estado = historial.get(f"estado_{año}", "—")
            diagnostico_hist = historial.get(f"diagnostico_{año}", "—")[:300]
            hist_data.append([str(año), estado, diagnostico_hist])
        
        hist_table = Table(hist_data, colWidths=[2*cm, 3.5*cm, 9*cm])
        hist_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), CD),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("BACKGROUND", (0, 1), (-1, -1), CB),
            ("GRID", (0, 0), (-1, -1), 0.5, CBR),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(hist_table)
        story.append(Spacer(1, 10))
    
    # Fotos
    if imagenes:
        story.append(Paragraph("REGISTRO FOTOGRÁFICO", st_sec))
        iw = (A4[0] - 6*cm) / 2
        for i in range(0, len(imagenes), 2):
            fila = []
            for j in range(2):
                if i + j < len(imagenes):
                    nimg, pimg = imagenes[i + j]
                    try:
                        bi = io.BytesIO()
                        pimg.save(bi, format="JPEG", quality=75)
                        bi.seek(0)
                        wo, ho = pimg.size
                        alt = iw * ho / wo
                        if alt > 7*cm:
                            alt = 7*cm
                        rl_img = RLImage(bi, width=iw, height=alt)
                        caption = Paragraph(f"{i+j+1}. {nimg[:30]}", es("cap", fontSize=7, alignment=TA_CENTER))
                        celda = Table([[rl_img], [caption]], colWidths=[iw])
                        celda.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
                        fila.append(celda)
                    except Exception as e:
                        st.logger.warning(f"⚠️ Error procesando imagen {nimg} para PDF: {e}")
                        fila.append(Paragraph("", st_bod))
                else:
                    fila.append(Paragraph("", st_bod))
            fr = Table([fila], colWidths=[iw, iw])
            story.append(fr)
            story.append(Spacer(1, 4))
        story.append(Spacer(1, 6))
    
    # Contenido de la inspección
    story.append(Paragraph(f"ACCIONES PGP {ANIO_ACTUAL}", st_sec))
    for line in acciones.split("\n"):
        if line.strip():
            story.append(Paragraph(f"• {line.strip()}", st_bul))
    story.append(Spacer(1, 8))
    
    story.append(Paragraph(f"DIAGNÓSTICO PGP {ANIO_ACTUAL}", st_sec))
    for line in diagnostico.split("\n"):
        if line.strip():
            story.append(Paragraph(line.strip(), st_bod))
    story.append(Spacer(1, 8))
    
    story.append(Paragraph(f"RECOMENDACIONES PGP {ANIO_SIG}", st_sec))
    for line in recomendaciones.split("\n"):
        if line.strip():
            if line.strip().startswith("-"):
                story.append(Paragraph(f"• {line.strip()[1:]}", st_bul))
            else:
                story.append(Paragraph(line.strip(), st_bod))
    story.append(Spacer(1, 8))
    
    # Análisis completo
    story.append(Paragraph("ANÁLISIS COMPLETO", st_sec))
    for line in analisis_completo.split("\n")[:150]:
        if line.strip():
            story.append(Paragraph(line.strip(), es("mono", fontSize=7, fontName="Courier", textColor=CM)))
    
    # Footer
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=0.5, color=CBR))
    story.append(Paragraph(
        f"Generado por {perfil.get('nombre', 'Inspector IA')} · ARAUCO · {datetime.now().strftime('%d/%m/%Y %H:%M')}",
        es("foot", fontSize=7, textColor=CM, alignment=TA_CENTER)
    ))
    
    try:
        doc.build(story)
        return buf.getvalue()
    except Exception as e:
        st.logger.error(f"❌ Error generando PDF: {e}", exc_info=True)
        return None
