import os
import io
import datetime
import logging
from PIL import Image
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

logger = logging.getLogger(__name__)

# Máximo de imágenes incluidas por equipo en el registro fotográfico del reporte.
MAX_FOTOS_REPORTE = 6

def generar_pdf(datos_inspeccion: dict, tipo: str = 'pgp') -> dict:
    try:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        
        story = []
        story.extend(generar_portada(datos_inspeccion))
        story.append(PageBreak())
        story.extend(generar_cuerpo(datos_inspeccion))
        story.extend(generar_pie_pagina())
        
        if 'fotos' in datos_inspeccion and datos_inspeccion['fotos']:
            story.append(PageBreak())
            story.extend(insertar_fotos_pdf(datos_inspeccion['fotos']))
            
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        campania = datos_inspeccion.get('campania', 'GEN')
        file_name = f"Reporte_{generar_numero_acta(campania)}.pdf"
        return {"status": "success", "filename": file_name, "content": pdf_bytes}
    except Exception as e:
        logger.error(f"Error generando PDF: {e}")
        return {"status": "error", "message": str(e)}

def generar_portada(datos: dict) -> list:
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph(f"<b>Reporte de Inspección: {datos.get('equipo_nombre', 'N/A')}</b>", styles['Title']))
    story.append(Spacer(1, 20))
    story.append(Paragraph(f"Fecha: {datos.get('fecha', 'N/A')}", styles['Normal']))
    story.append(Paragraph(f"Inspector: {datos.get('inspector', 'N/A')}", styles['Normal']))
    return story

def generar_cuerpo(datos: dict) -> list:
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph("<b>Resultados de la Inspección</b>", styles['Heading2']))
    story.append(Spacer(1, 10))
    story.append(Paragraph(f"Diagnóstico: {datos.get('diagnostico', 'Sin diagnóstico')}", styles['Normal']))
    story.append(Spacer(1, 10))
    story.append(Paragraph(f"Estado Final: {datos.get('estado', 'N/A')}", styles['Normal']))
    return story

def generar_pie_pagina() -> list:
    styles = getSampleStyleSheet()
    return [Spacer(1, 30), Paragraph("<i>Documento generado automáticamente por Agente Inspector</i>", styles['Italic'])]

def insertar_fotos_pdf(fotos: list) -> list:
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph("<b>Registro Fotográfico</b>", styles['Heading2']))
    story.append(Spacer(1, 10))
    
    for foto in fotos:
        try:
            if 'ruta' in foto and os.path.exists(foto['ruta']):
                img = RLImage(foto['ruta'], width=200, height=150)
                story.append(img)
                if 'descripcion' in foto:
                    story.append(Paragraph(foto['descripcion'], styles['Normal']))
                story.append(Spacer(1, 10))
        except Exception as e:
            logger.error(f"Error insertando foto: {e}")
            
    return story

def generar_numero_acta(campania: str) -> str:
    # Identificador determinístico y ordenable por timestamp (sin aleatoriedad,
    # para evitar colisiones de actas). El flujo principal usa ACTA-{año}-{código}.
    now = datetime.datetime.now()
    return f"ACT-{campania}-{now.strftime('%Y%m%d-%H%M%S')}"

def comprimir_imagen_pdf(imagen_bytes: bytes, calidad: int = 85) -> bytes:
    try:
        img = Image.open(io.BytesIO(imagen_bytes))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        out_buffer = io.BytesIO()
        img.save(out_buffer, format="JPEG", quality=calidad)
        return out_buffer.getvalue()
    except Exception as e:
        logger.error(f"Error comprimiendo imagen: {e}")
        return imagen_bytes

COLORES_SULVY = {
    'primario': colors.HexColor('#1a365d'),
    'secundario': colors.HexColor('#2d3748'),
    'enfasis': colors.HexColor('#2b6cb0'),
    'texto': colors.HexColor('#1a202c'),
    'gris': colors.HexColor('#4a5568'),
    'fondo_tabla': colors.HexColor('#f7fafc')
}

def wrap_image_in_border(img_path, width=230, height=172):
    img = RLImage(img_path, width=width, height=height)
    t = Table([[img]], colWidths=[width], rowHeights=[height])
    t.setStyle([
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('PADDING', (0,0), (-1,-1), 0),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ])
    return t

# Paleta corporativa del membrete SULVY SRL (header / footer)
MEMBRETE = {
    'texto': colors.HexColor('#333333'),       # Gris oscuro para datos de contacto y firma
    'acento': colors.HexColor('#0056b3'),      # Azul ingenieril para email y CTA
    'separador': colors.HexColor('#cccccc'),   # Línea horizontal fina gris claro
}

# Datos fijos de la empresa (encabezado, esquina superior derecha)
SULVY_CONTACTO = [
    "Miranda 549, Hurlingham, Buenos Aires B1686GNA",
    "+54 9 11 4665 2875",
    "+54 9 11 4089 8597",
]
# Firma del equipo técnico (bloque al final del cuerpo del informe)
SULVY_FIRMANTES = [
    ("Marco G. Paltrinieri", "Ing. Esteban M. Irioni"),
]

# Rutas de los assets del membrete oficial (imágenes a sangre)
HEADER_ASSET = os.path.join(os.path.abspath("."), "app", "assets", "header.png")
FOOTER_ASSET = os.path.join(os.path.abspath("."), "app", "assets", "footer.png")


def altura_banda(ruta_imagen: str, ancho_pagina: float) -> float:
    """Altura proporcional de una banda dibujada a sangre (ancho completo), de
    modo que la imagen no se distorsione."""
    try:
        iw, ih = ImageReader(ruta_imagen).getSize()
        return ancho_pagina * ih / iw
    except Exception:
        return 3.0 * cm


def margenes_membrete():
    """Margen superior/inferior necesario para que el contenido no invada las
    bandas del membrete. Si no hay imágenes, usa los valores del diseño de texto."""
    ancho = letter[0]
    top = (altura_banda(HEADER_ASSET, ancho) + 0.5 * cm) if os.path.exists(HEADER_ASSET) else 3.8 * cm
    bot = (altura_banda(FOOTER_ASSET, ancho) + 0.75 * cm) if os.path.exists(FOOTER_ASSET) else 2.2 * cm
    return top, bot


def generar_bloque_firma() -> list:
    """Bloque de firma del equipo técnico para el cierre del informe, mantenido
    junto para que no se parta entre páginas."""
    styles = getSampleStyleSheet()
    linea_style = ParagraphStyle('FirmaLinea', parent=styles['Normal'], fontName='Helvetica',
                                 fontSize=9, alignment=1, textColor=MEMBRETE['separador'])
    nombre_style = ParagraphStyle('FirmaNombre', parent=styles['Normal'], fontName='Helvetica',
                                  fontSize=9, leading=11, alignment=1, textColor=MEMBRETE['texto'])
    empresa_style = ParagraphStyle('FirmaEmpresa', parent=styles['Normal'], fontName='Helvetica-Bold',
                                   fontSize=11, leading=14, alignment=1, textColor=COLORES_SULVY['primario'])

    filas = [[Paragraph("_______________________", linea_style),
              Paragraph("_______________________", linea_style)]]
    for izq, der in SULVY_FIRMANTES:
        filas.append([Paragraph(izq, nombre_style), Paragraph(der, nombre_style)])

    firma_tabla = Table(filas, colWidths=[249, 249])
    firma_tabla.setStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, 0), 22),  # espacio para firmar sobre las líneas
        ('TOPPADDING', (0, 1), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ])

    return [Spacer(1, 30), KeepTogether([
        firma_tabla,
        Spacer(1, 8),
        Paragraph("SULVY SRL", empresa_style),
    ])]


# Canvas personalizado: dibuja el membrete SULVY SRL (header + footer) en cada página.
class ReporteCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.pages = []
        self.doc_title = None

    def showPage(self):
        self.pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self.pages)
        for page in self.pages:
            self.__dict__.update(page)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages):
        self.saveState()
        self.draw_header()
        self.draw_footer(total_pages)
        self.restoreState()

    def draw_header(self):
        """Encabezado: banda oficial a sangre (header.png). Si falta el asset,
        cae al membrete de texto equivalente."""
        ancho, alto = self._pagesize
        if os.path.exists(HEADER_ASSET):
            h = altura_banda(HEADER_ASSET, ancho)
            self.drawImage(HEADER_ASSET, 0, alto - h, width=ancho, height=h,
                           preserveAspectRatio=True, mask='auto')
        else:
            self._draw_header_texto()

    def _draw_header_texto(self):
        ancho, alto = self._pagesize
        left_x = 2 * cm
        right_x = ancho - 2 * cm
        top_y = alto - 1.0 * cm
        interlineado = 0.39 * cm  # ~1.1 sobre cuerpo de 9 pt

        self.setFillColor(MEMBRETE['acento'])
        self.setFont('Helvetica-Bold', 15)
        self.drawString(left_x, top_y - 0.35 * cm, "SULVY SRL")
        self.setFillColor(MEMBRETE['texto'])
        self.setFont('Helvetica', 7.5)
        self.drawString(left_x, top_y - 0.85 * cm, "Inspección técnica e ingeniería")

        self.setFont('Helvetica', 9)
        self.setFillColor(MEMBRETE['texto'])
        y = top_y
        for linea in SULVY_CONTACTO:
            self.drawRightString(right_x, y, linea)
            y -= interlineado
        self.setFillColor(MEMBRETE['acento'])
        self.drawRightString(right_x, y, "info@sulvy.com")
        y -= interlineado
        self.setFont('Helvetica-Bold', 9)
        self.drawRightString(right_x, y, "Visitanos »")

        sep_y = alto - 3.1 * cm
        self.setStrokeColor(MEMBRETE['separador'])
        self.setLineWidth(0.7)
        self.line(left_x, sep_y, right_x, sep_y)

    def draw_footer(self, total_pages):
        """Pie de página: banda oficial a sangre (footer.png) o, en su defecto,
        contacto de texto. La numeración se imprime siempre sobre la franja."""
        ancho, _ = self._pagesize
        usa_imagen = os.path.exists(FOOTER_ASSET)
        if usa_imagen:
            h = altura_banda(FOOTER_ASSET, ancho)
            self.drawImage(FOOTER_ASSET, 0, 0, width=ancho, height=h,
                           preserveAspectRatio=True, mask='auto')
        else:
            self._draw_footer_texto()

        # Numeración de página: por encima de la banda del pie, en el margen libre,
        # para que no se superponga con la imagen del footer.
        h_banda = altura_banda(FOOTER_ASSET, ancho) if usa_imagen else 2.0 * cm
        self.setFont('Helvetica', 7.5)
        self.setFillColor(MEMBRETE['texto'])
        self.drawCentredString(ancho / 2, h_banda + 0.22 * cm, f"Página {self._pageNumber} de {total_pages}")

    def _draw_footer_texto(self):
        ancho, _ = self._pagesize
        left_x = 2 * cm
        right_x = ancho - 2 * cm
        sep_y = 2.0 * cm
        self.setStrokeColor(MEMBRETE['separador'])
        self.setLineWidth(0.7)
        self.line(left_x, sep_y, right_x, sep_y)
        self.setFont('Helvetica', 9)
        self.setFillColor(MEMBRETE['texto'])
        y = sep_y - 0.45 * cm
        for linea in SULVY_CONTACTO:
            self.drawRightString(right_x, y, linea)
            y -= 0.39 * cm
        self.setFillColor(MEMBRETE['acento'])
        self.drawRightString(right_x, y, "info@sulvy.com  ·  Visitanos »")

def make_reporte_canvas_class(doc_title):
    class CustomReporteCanvas(ReporteCanvas):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.doc_title = doc_title
    return CustomReporteCanvas

def obtener_flujo_equipo(equipo: dict, inspeccion: dict, fotos_locales: list = None) -> list:
    from app.services.db_service import get_config_value_db
    campania = get_config_value_db("reporte_campania", "PGP 2026")
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=COLORES_SULVY['primario'],
        alignment=1 # Centered
    )
    
    label_style = ParagraphStyle(
        'TableLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=COLORES_SULVY['texto']
    )
    
    val_style = ParagraphStyle(
        'TableValue',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=11,
        textColor=COLORES_SULVY['secundario']
    )
    
    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=COLORES_SULVY['primario'],
        spaceBefore=12,
        spaceAfter=6
    )
    
    body_text_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10.5,
        leading=14.5,
        textColor=COLORES_SULVY['texto'],
        alignment=4 # Justified
    )
    
    # 1. HEADER (Title & Acta)
    story.append(Paragraph("INFORME DE INSPECCIÓN TÉCNICA", title_style))
    story.append(Spacer(1, 4))
    
    codigo_eq = equipo.get('codigo', equipo.get('numero', 'N/A'))
    num_acta = f"ACTA-{campania.replace(' ', '')}-{codigo_eq}"
    story.append(Paragraph(f"Acta de Inspección: {num_acta}", ParagraphStyle('DocActa', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, leading=13, textColor=COLORES_SULVY['secundario'], alignment=1)))
    story.append(Spacer(1, 15))
    
    # Line
    line_table = Table([['']], colWidths=[498], rowHeights=[1])
    line_table.setStyle([
        ('BACKGROUND', (0,0), (-1,-1), COLORES_SULVY['primario']),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ])
    story.append(line_table)
    story.append(Spacer(1, 10))
    
    # 2. DATOS DEL EQUIPO
    story.append(Paragraph("DATOS DEL EQUIPO Y UBICACIÓN", section_title_style))
    
    empresa_nombre = equipo.get('empresa', 'N/A')
    area_nombre = equipo.get('area', 'N/A')
    ubicacion_str = f"{empresa_nombre} &rarr; {area_nombre}"
    
    fecha_insp_raw = inspeccion.get('updated_at', inspeccion.get('created_at', ''))
    if fecha_insp_raw:
        try:
            dt = datetime.datetime.fromisoformat(str(fecha_insp_raw).replace('Z', '+00:00'))
            fecha_str = dt.strftime("%d/%m/%Y")
        except:
            fecha_str = str(fecha_insp_raw)[:10]
    else:
        fecha_str = datetime.datetime.now().strftime("%d/%m/%Y")
        
    eq_details = [
        [
            Paragraph("Código:", label_style), Paragraph(str(equipo.get('codigo', 'N/A')), val_style),
            Paragraph("Tag:", label_style), Paragraph(str(equipo.get('nombre', 'N/A') or 'N/A'), val_style)
        ],
        [
            Paragraph("Nombre:", label_style), Paragraph(str(equipo.get('nombre', 'N/A')), val_style),
            Paragraph("Material:", label_style), Paragraph(str(equipo.get('material', 'N/A') or 'N/A'), val_style)
        ],
        [
            Paragraph("Fluido:", label_style), Paragraph(str(equipo.get('fluido', 'N/A') or 'N/A'), val_style),
            Paragraph("Presión de Diseño:", label_style), Paragraph(f"{equipo.get('presion_diseno', 'N/A')} bar" if equipo.get('presion_diseno') is not None else 'N/A', val_style)
        ],
        [
            Paragraph("Temperatura de Diseño:", label_style), Paragraph(f"{equipo.get('temperatura_diseno', 'N/A')} °C" if equipo.get('temperatura_diseno') is not None else 'N/A', val_style),
            Paragraph("Ubicación:", label_style), Paragraph(ubicacion_str, val_style)
        ],
        [
            Paragraph("Fecha Inspección:", label_style), Paragraph(fecha_str, val_style),
            Paragraph("", label_style), Paragraph("", val_style)
        ]
    ]
    
    eq_table = Table(eq_details, colWidths=[90, 159, 95, 154])
    eq_table.setStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0,0), (0,-1), COLORES_SULVY['fondo_tabla']),
        ('BACKGROUND', (2,0), (2,-1), COLORES_SULVY['fondo_tabla']),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ])
    story.append(eq_table)
    story.append(Spacer(1, 10))
    
    # 3. ESTADO (Badge)
    estado_val = str(inspeccion.get('estado', 'BUENO')).upper()
    badge_bg = colors.HexColor('#6b7280') # FUERA DE RUTA / Default Gray
    if 'BUENO' in estado_val:
        badge_bg = colors.HexColor('#22c55e') # Green
    elif 'REGULAR' in estado_val:
        badge_bg = colors.HexColor('#f59e0b') # Orange
    elif 'CRIT' in estado_val:
        badge_bg = colors.HexColor('#ef4444') # Red
        
    badge_style = ParagraphStyle(
        'BadgeTxt',
        fontName='Helvetica-Bold',
        fontSize=10,
        textColor=colors.white,
        alignment=1
    )
    
    badge_cell = Table([[Paragraph(estado_val, badge_style)]], colWidths=[130], rowHeights=[20])
    badge_cell.setStyle([
        ('BACKGROUND', (0,0), (-1,-1), badge_bg),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ])
    
    estado_layout = Table([
        [Paragraph(f"<b>ESTADO {campania}:</b>", ParagraphStyle('EstLbl', parent=styles['Normal'], fontSize=10, fontName='Helvetica-Bold')), badge_cell]
    ], colWidths=[130, 368])
    estado_layout.setStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ])
    story.append(estado_layout)
    story.append(Spacer(1, 10))
    
    # 4. ACCIONES EJECUTADAS
    story.append(Paragraph(f"ACCIONES EJECUTADAS EN {campania}", section_title_style))
    acciones_text = inspeccion.get('acciones', 'Sin acciones registradas.')
    story.append(Paragraph(acciones_text.replace('\n', '<br/>'), body_text_style))
    story.append(Spacer(1, 10))
    
    # 5. DIAGNÓSTICO TÉCNICO
    story.append(Paragraph("DIAGNÓSTICO TÉCNICO", section_title_style))
    diagnostico_text = inspeccion.get('diagnostico', 'Sin diagnóstico registrado.')
    story.append(Paragraph(diagnostico_text.replace('\n', '<br/>'), body_text_style))
    
    # PAGE BREAK
    story.append(PageBreak())
    
    # PAGE 2
    # 6. RECOMENDACIONES PARA PGP 2027
    story.append(Paragraph("RECOMENDACIONES PARA PGP 2027", section_title_style))
    recom_text = inspeccion.get('recomendaciones', 'Sin recomendaciones registradas.')
    story.append(Paragraph(recom_text.replace('\n', '<br/>'), body_text_style))
    story.append(Spacer(1, 15))
    
    # 7. REGISTRO FOTOGRÁFICO (máximo MAX_FOTOS_REPORTE imágenes)
    if fotos_locales:
        total_fotos = len(fotos_locales)
        fotos_locales = fotos_locales[:MAX_FOTOS_REPORTE]
        story.append(Paragraph("FOTOS ILUSTRATIVAS DE LAS DISTINTAS ETAPAS DE LAS TAREAS DESARROLLADAS", section_title_style))
        story.append(Spacer(1, 5))

        if total_fotos > MAX_FOTOS_REPORTE:
            story.append(Paragraph(
                f"<i>Se muestran {MAX_FOTOS_REPORTE} de {total_fotos} imágenes disponibles.</i>",
                ParagraphStyle('NotaFotos', parent=styles['Normal'], fontName='Helvetica-Oblique',
                               fontSize=8, textColor=COLORES_SULVY['gris'])))
            story.append(Spacer(1, 4))

        fotos_elements = []
        for i, item in enumerate(fotos_locales):
            path = item.get('path', item.get('ruta', item)) if isinstance(item, dict) else item
            caption = item.get('caption', item.get('descripcion', '')) if isinstance(item, dict) else ''
            
            if not caption:
                if i == 0:
                    caption = "Vista general del equipo durante la inspección técnica."
                else:
                    caption = "Detalle del estado del equipo y puntos de interés."
                    
            try:
                if os.path.exists(path):
                    wrapped_img = wrap_image_in_border(path, width=230, height=172)
                    cell_data = [
                        [wrapped_img],
                        [Paragraph(caption, ParagraphStyle(f'Caption_{i}', parent=styles['Normal'], fontName='Helvetica-Oblique', fontSize=7.5, leading=9, textColor=COLORES_SULVY['gris'], alignment=1))]
                    ]
                    cell_table = Table(cell_data, colWidths=[230])
                    cell_table.setStyle([
                        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                        ('VALIGN', (0,0), (-1,-1), 'TOP'),
                        ('TOPPADDING', (0,0), (-1,-1), 3),
                        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                    ])
                    fotos_elements.append(cell_table)
            except Exception as img_err:
                logger.error(f"Error cargando imagen en PDF: {img_err}")
        
        for i in range(0, len(fotos_elements), 2):
            row_items = fotos_elements[i:i+2]
            if len(row_items) == 2:
                img_table = Table([row_items], colWidths=[246, 252])
                img_table.setStyle([
                    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ])
                story.append(img_table)
                story.append(Spacer(1, 10))
            else:
                img_table = Table([row_items], colWidths=[498])
                img_table.setStyle([
                    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ])
                story.append(img_table)
                story.append(Spacer(1, 10))
    else:
        story.append(Paragraph("FOTOS ILUSTRATIVAS DE LAS DISTINTAS ETAPAS DE LAS TAREAS DESARROLLADAS", section_title_style))
        story.append(Spacer(1, 5))
        story.append(Paragraph("<i>No se registran imágenes asociadas en Google Drive.</i>", body_text_style))
        
    return story

def generar_pdf_individual(equipo: dict, inspeccion: dict, fotos_locales: list = None) -> bytes:
    try:
        buffer = io.BytesIO()
        top_m, bot_m = margenes_membrete()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=2*cm,
            rightMargin=2*cm,
            topMargin=top_m,
            bottomMargin=bot_m
        )

        story = obtener_flujo_equipo(equipo, inspeccion, fotos_locales)
        story.extend(generar_bloque_firma())
        codigo_eq = equipo.get('codigo', equipo.get('numero', 'N/A'))
        num_acta = f"ACTA-2026-{codigo_eq}"
        
        canvas_maker = make_reporte_canvas_class(f"Informe de Inspección Técnica - Acta: {num_acta}")
        doc.build(story, canvasmaker=canvas_maker)
        
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
    except Exception as e:
        logger.error(f"Error generando PDF individual: {e}", exc_info=True)
        raise e

from reportlab.pdfgen import canvas

def generar_libro_pdf(nombre_ubicacion: str, nombre_empresa: str, equipos: list, inspecciones: list, fotos_por_equipo: dict, omitidos_count: int = 0) -> bytes:
    from app.services.db_service import get_config_value_db
    import re
    campania = get_config_value_db("reporte_campania", "PGP 2026")
    digits = re.findall(r'\d+', campania)
    next_camp = campania.replace(digits[0], str(int(digits[0]) + 1)) if digits else "siguiente"
    
    try:
        buffer = io.BytesIO()
        top_m, bot_m = margenes_membrete()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=2*cm,
            rightMargin=2*cm,
            topMargin=top_m,
            bottomMargin=bot_m
        )

        story = []
        styles = getSampleStyleSheet()
        
        # 1. PORTADA
        story.append(Spacer(1, 20))
        story.append(Paragraph("SULVY", ParagraphStyle('CoverSulvyLogo', fontName='Helvetica-Bold', fontSize=32, leading=38, textColor=COLORES_SULVY['primario'], alignment=1, spaceAfter=5)))
        story.append(Paragraph("Sistema de Gestión de Calidad y Ambiental Certificado", ParagraphStyle('CoverSulvySub', fontName='Helvetica', fontSize=10, leading=13, textColor=COLORES_SULVY['secundario'], alignment=1, spaceAfter=40)))
        
        story.append(Paragraph("LIBRO DE INSPECCIONES TÉCNICAS", ParagraphStyle('CoverBookTitle', fontName='Helvetica-Bold', fontSize=22, leading=26, textColor=COLORES_SULVY['primario'], alignment=1, spaceAfter=5)))
        story.append(Paragraph(nombre_ubicacion.upper(), ParagraphStyle('CoverBookSub', fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=COLORES_SULVY['enfasis'], alignment=1, spaceAfter=20)))
        
        # Meta info
        meta_label_style = ParagraphStyle('CoverMetaLabel', fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=COLORES_SULVY['texto'])
        meta_val_style = ParagraphStyle('CoverMetaVal', fontName='Helvetica', fontSize=10, leading=14, textColor=COLORES_SULVY['secundario'])
        
        fecha_gen = datetime.datetime.now().strftime("%d/%m/%Y")
        
        meta_details = [
            [Paragraph("Cliente / Empresa:", meta_label_style), Paragraph(nombre_empresa, meta_val_style)],
            [Paragraph("Ubicación / Área:", meta_label_style), Paragraph(nombre_ubicacion, meta_val_style)],
            [Paragraph("Campaña:", meta_label_style), Paragraph(campania, meta_val_style)],
            [Paragraph("Fecha de Generación:", meta_label_style), Paragraph(fecha_gen, meta_val_style)],
            [Paragraph("Equipos Incluidos:", meta_label_style), Paragraph(str(len(equipos)), meta_val_style)]
        ]
        if omitidos_count > 0:
            meta_details.append([Paragraph("Equipos Omitidos:", meta_label_style), Paragraph(str(omitidos_count), meta_val_style)])
            
        meta_table = Table(meta_details, colWidths=[140, 358])
        meta_table.setStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('BACKGROUND', (0,0), (0,-1), COLORES_SULVY['fondo_tabla']),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ])
        story.append(meta_table)
        story.append(Spacer(1, 20))
        
        # Objetivo
        story.append(Paragraph("<b>Objetivo:</b>", ParagraphStyle('ObjHead', fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=COLORES_SULVY['primario'])))
        objetivo_text = f"Consolidar los informes de inspección técnica realizados en la ubicación {nombre_ubicacion} de la empresa {nombre_empresa} durante la campaña {campania}, detallando los hallazgos técnicos, el estado de conservación de los activos, y las recomendaciones de mantenimiento propuestas para el período {next_camp}."
        story.append(Paragraph(objetivo_text, ParagraphStyle('ObjVal', fontName='Helvetica', fontSize=9.5, leading=13.5, textColor=COLORES_SULVY['texto'], alignment=4)))
        story.append(Spacer(1, 15))
        
        # Criterios y Normativas
        story.append(Paragraph("<b>Criterios y Normativas:</b>", ParagraphStyle('NormHead', fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=COLORES_SULVY['primario'])))
        normas = [
            "• Evaluación de integridad estructural de recipientes, cañerías y accesorios según normas de referencia ASME Sección VIII Div. 1 y API 510.",
            "• Criterios de aceptación y rechazo basados en tolerancias de diseño y espesores nominales de pared.",
            "• Clasificación del estado de conservación en base a criticidad operativa de los activos (Bueno / Regular / Crítico / Fuera de Ruta)."
        ]
        for norma in normas:
            story.append(Paragraph(norma, ParagraphStyle('NormVal', fontName='Helvetica', fontSize=9.5, leading=13.5, textColor=COLORES_SULVY['texto'], alignment=4)))
            
        story.append(PageBreak())

        # 2. ÍNDICE DE EQUIPOS
        story.append(Paragraph("<b>ÍNDICE DE EQUIPOS</b>", ParagraphStyle('IndexTitle', fontName='Helvetica-Bold', fontSize=16, leading=20, textColor=COLORES_SULVY['primario'], spaceAfter=15)))

        index_data = []
        index_style = ParagraphStyle('IndexLine', fontName='Helvetica', fontSize=9.5, leading=13, textColor=COLORES_SULVY['texto'])
        page_style = ParagraphStyle('IndexPageNum', fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=COLORES_SULVY['primario'], alignment=2)

        for idx, eq in enumerate(equipos):
            codigo = eq.get('codigo', 'N/A')
            nombre = eq.get('nombre', 'N/A')
            start_page = 3 + 2 * idx
            
            text = f"{idx + 1}. {codigo} - {nombre}"
            
            index_data.append([
                Paragraph(text, index_style),
                Paragraph(". . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .", ParagraphStyle('Dots', fontName='Helvetica', fontSize=9.5, textColor=colors.HexColor('#cbd5e1'))),
                Paragraph(str(start_page), page_style)
            ])

        index_table = Table(index_data, colWidths=[240, 224, 34])
        index_table.setStyle([
            ('VALIGN', (0,0), (-1,-1), 'BOTTOM'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('TOPPADDING', (0,0), (-1,-1), 3),
        ])
        story.append(index_table)
        story.append(PageBreak())

        # 3. CUERPO (UN CAPÍTULO POR EQUIPO)
        for idx, eq in enumerate(equipos):
            insp = next((i for i in inspecciones if i['equipo_id'] == eq['id']), {})
            fotos = fotos_por_equipo.get(eq['id'], [])
            story.extend(obtener_flujo_equipo(eq, insp, fotos))
            story.append(PageBreak())

        # 4. ANEXOS
        story.append(Paragraph("ANEXOS", ParagraphStyle('AnnexesMainTitle', fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=COLORES_SULVY['primario'], spaceAfter=15)))

        # Anexo A: Resumen de Estados
        story.append(Paragraph("Anexo A: Resumen de Estados de Equipos", ParagraphStyle('AnnexTitle', fontName='Helvetica-Bold', fontSize=12, leading=16, textColor=COLORES_SULVY['primario'], spaceBefore=10, spaceAfter=8)))

        counts = {"BUENO": 0, "REGULAR": 0, "CRITICO": 0, "FUERA DE RUTA": 0}
        for insp in inspecciones:
            est = str(insp.get('estado', 'BUENO')).upper()
            if 'BUENO' in est:
                counts['BUENO'] += 1
            elif 'REGULAR' in est:
                counts['REGULAR'] += 1
            elif 'CRIT' in est:
                counts['CRITICO'] += 1
            elif 'FUERA' in est:
                counts['FUERA DE RUTA'] += 1
            else:
                counts['BUENO'] += 1

        total_eq = len(equipos)

        stats_data = []
        for state, color_hex in [("BUENO", "#22c55e"), ("REGULAR", "#f59e0b"), ("CRITICO", "#ef4444"), ("FUERA DE RUTA", "#6b7280")]:
            cnt = counts[state]
            pct = (cnt / total_eq) * 100 if total_eq > 0 else 0
            
            bar_width = max(1, int(pct * 2.0))
            remaining_width = 200 - bar_width
            
            bar_table_data = [['']]
            bar_table = Table(bar_table_data, colWidths=[bar_width, remaining_width] if remaining_width > 0 else [200], rowHeights=[12])
            bar_table.setStyle([
                ('BACKGROUND', (0,0), (0,0), colors.HexColor(color_hex)),
                ('BACKGROUND', (1,0), (1,0), colors.HexColor('#f1f5f9')) if remaining_width > 0 else ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 0),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ])
            
            stats_data.append([
                Paragraph(f"<b>{state}</b>", ParagraphStyle('StateLabel', fontName='Helvetica', fontSize=9)),
                Paragraph(f"{cnt} ({pct:.1f}%)", ParagraphStyle('StateCount', fontName='Helvetica-Bold', fontSize=9, alignment=1)),
                bar_table
            ])

        stats_table = Table(stats_data, colWidths=[120, 80, 298])
        stats_table.setStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BACKGROUND', (0,0), (-1,-1), colors.white),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ])
        story.append(stats_table)
        story.append(Spacer(1, 20))

        # Anexo B: Recomendaciones Consolidadas
        story.append(Paragraph("Anexo B: Recomendaciones Consolidadas (PGP 2027)", ParagraphStyle('AnnexTitle', fontName='Helvetica-Bold', fontSize=12, leading=16, textColor=COLORES_SULVY['primario'], spaceBefore=10, spaceAfter=8)))

        recom_data = []
        recom_data.append([
            Paragraph("<b>Equipo</b>", ParagraphStyle('RecomHead', fontName='Helvetica-Bold', fontSize=9, textColor=colors.white)),
            Paragraph("<b>Recomendaciones PGP 2027</b>", ParagraphStyle('RecomHead', fontName='Helvetica-Bold', fontSize=9, textColor=colors.white))
        ])

        for idx, eq in enumerate(equipos):
            codigo = eq.get('codigo', 'N/A')
            nombre = eq.get('nombre', 'N/A')
            insp = next((i for i in inspecciones if i['equipo_id'] == eq['id']), {})
            recom = insp.get('recomendaciones', 'Sin recomendaciones registradas.')
            
            recom_data.append([
                Paragraph(f"<b>{codigo}</b><br/>{nombre}", ParagraphStyle('RecomEq', fontName='Helvetica', fontSize=8.5, leading=11)),
                Paragraph(recom.replace('\n', '<br/>'), ParagraphStyle('RecomVal', fontName='Helvetica', fontSize=8.5, leading=11))
            ])

        recom_table = Table(recom_data, colWidths=[130, 368])
        recom_table.setStyle([
            ('BACKGROUND', (0,0), (-1,0), COLORES_SULVY['primario']),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ])
        recom_table.repeatRows = 1
        story.append(recom_table)
        story.append(Spacer(1, 20))

        # Anexo C: Tabla Resumen de Equipos
        story.append(Paragraph("Anexo C: Tabla Resumen de Equipos", ParagraphStyle('AnnexTitle', fontName='Helvetica-Bold', fontSize=12, leading=16, textColor=COLORES_SULVY['primario'], spaceBefore=10, spaceAfter=8)))

        summary_data = []
        summary_data.append([
            Paragraph("<b>Código</b>", ParagraphStyle('SumHead', fontName='Helvetica-Bold', fontSize=9, textColor=colors.white)),
            Paragraph("<b>Nombre Equipo</b>", ParagraphStyle('SumHead', fontName='Helvetica-Bold', fontSize=9, textColor=colors.white)),
            Paragraph("<b>Estado</b>", ParagraphStyle('SumHead', fontName='Helvetica-Bold', fontSize=9, textColor=colors.white, alignment=1)),
            Paragraph("<b>Página</b>", ParagraphStyle('SumHead', fontName='Helvetica-Bold', fontSize=9, textColor=colors.white, alignment=1))
        ])

        for idx, eq in enumerate(equipos):
            codigo = eq.get('codigo', 'N/A')
            nombre = eq.get('nombre', 'N/A')
            insp = next((i for i in inspecciones if i['equipo_id'] == eq['id']), {})
            estado_val = str(insp.get('estado', 'BUENO')).upper()
            start_page = 3 + 2 * idx
            
            summary_data.append([
                Paragraph(codigo, ParagraphStyle('SumVal', fontName='Helvetica', fontSize=8.5)),
                Paragraph(nombre, ParagraphStyle('SumVal', fontName='Helvetica', fontSize=8.5)),
                Paragraph(estado_val, ParagraphStyle('SumVal', fontName='Helvetica-Bold', fontSize=8.5, alignment=1)),
                Paragraph(str(start_page), ParagraphStyle('SumVal', fontName='Helvetica', fontSize=8.5, alignment=1))
            ])

        summary_table = Table(summary_data, colWidths=[100, 238, 100, 60])
        summary_table.setStyle([
            ('BACKGROUND', (0,0), (-1,0), COLORES_SULVY['primario']),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ])
        summary_table.repeatRows = 1
        story.append(summary_table)

        # Cierre: firma del equipo técnico
        story.extend(generar_bloque_firma())

        canvas_maker = make_reporte_canvas_class(f"Libro {nombre_ubicacion} - {campania}")
        doc.build(story, canvasmaker=canvas_maker)
        
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
    except Exception as e:
        logger.error(f"Error generando PDF del Libro por Área: {e}", exc_info=True)
        raise e

