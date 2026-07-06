import os
import io
import datetime
import logging
from PIL import Image
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Image as RLImage, Table, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
import html
import re

logger = logging.getLogger(__name__)

def clean_xml_text(text: str) -> str:
    if not text:
        return ""
    text = str(text)
    try:
        text = text.encode('utf-8', errors='ignore').decode('utf-8')
    except Exception:
        pass
    escaped = html.escape(text)
    escaped = escaped.replace("&lt;b&gt;", "<b>").replace("&lt;/b&gt;", "</b>")
    escaped = escaped.replace("&lt;i&gt;", "<i>").replace("&lt;/i&gt;", "</i>")
    escaped = escaped.replace("&lt;u&gt;", "<u>").replace("&lt;/u&gt;", "</u>")
    escaped = escaped.replace("&lt;br/&gt;", "<br/>").replace("&lt;br&gt;", "<br/>").replace("&lt;br /&gt;", "<br/>")
    return escaped

def load_and_scale_image(path: str, target_width: float) -> RLImage:
    try:
        from PIL import Image as PILImage
        with PILImage.open(path) as pil_img:
            orig_w, orig_h = pil_img.size
        proportional_height = (target_width / orig_w) * orig_h
        return RLImage(path, width=target_width, height=proportional_height, kind='proportional')
    except Exception as e:
        logger.error(f"Error loading image with PIL ({path}): {e}")
        return RLImage(path, width=target_width, height=150, kind='proportional')

def obtener_config_fotos(total_fotos: int) -> dict:
    if total_fotos <= 3:
        return {
            "columnas": 1,
            "ancho": 450,
            "fuente_titulo": 9,
            "fuente_obs": 8,
            "espaciado_filas": 12,
            "max_lineas_obs": None,
            "ubicacion": "cuerpo"
        }
    elif total_fotos <= 6:
        return {
            "columnas": 2,
            "ancho": 210,
            "fuente_titulo": 9,
            "fuente_obs": 8,
            "espaciado_filas": 12,
            "max_lineas_obs": None,
            "ubicacion": "cuerpo"
        }
    elif total_fotos <= 10:
        return {
            "columnas": 2,
            "ancho": 200,
            "fuente_titulo": 9,
            "fuente_obs": 7,
            "espaciado_filas": 10,
            "max_lineas_obs": None,
            "ubicacion": "cuerpo"
        }
    elif total_fotos <= 15:
        return {
            "columnas": 2,
            "ancho": 190,
            "fuente_titulo": 8,
            "fuente_obs": 7,
            "espaciado_filas": 8,
            "max_lineas_obs": None,
            "ubicacion": "cuerpo"
        }
    elif total_fotos <= 20:
        return {
            "columnas": 2,
            "ancho": 180,
            "fuente_titulo": 8,
            "fuente_obs": 7,
            "espaciado_filas": 8,
            "max_lineas_obs": 1,
            "ubicacion": "cuerpo"
        }
    else:
        return {
            "columnas": 2,
            "ancho": 210,
            "fuente_titulo": 9,
            "fuente_obs": 8,
            "espaciado_filas": 12,
            "max_lineas_obs": None,
            "ubicacion": "mixto"
        }

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
    "Miranda 549 (B1686GNA) Hurlingham,",
    "Buenos Aires, Argentina.",
    "+54 11 4665-2875 / +54 11 4662-2558",
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

def generar_recuadro_criterios(width: float = 498) -> Table:
    styles = getSampleStyleSheet()
    
    # Define styles for the box
    left_text_style = ParagraphStyle(
        'CriteriosLeftText',
        parent=styles['Normal'],
        fontName='Helvetica-BoldOblique',
        fontSize=11,
        leading=14,
        textColor=colors.black,
        alignment=0 # Left-aligned
    )
    
    right_text_style = ParagraphStyle(
        'CriteriosRightText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=colors.black,
        leftIndent=12,
        firstLineIndent=-12,
        spaceAfter=5
    )
    
    # Content of left column
    left_paragraph = Paragraph("CRITERIOS Y<br/>NORMATIVAS:", left_text_style)
    
    # Content of right column
    items = [
        "• ASTM D 2563-94 <i>\"Standard Practice for Classifying Visual Defects in Glass-Reinforced Plastic Laminate Parts\"</i>",
        "• Manuales específicos <i>Ashland</i> y <i>Reichhold</i>, Lineamientos y criterios específicos.",
        "• NOGA Guía 055-97 <i>\"Guía recomendada para ensayos no destructivos (NDT) en tanques y sistemas de tuberías PRFV\"</i>, Norwegian Oil & Gas Association.",
        "• Proyecto MTI 129-99 <i>\"Guía práctica para inspección de campo para equipos y tuberías PRFV\"</i>, John Niesse / Hira Ahluwalia, Materials Technology Institute St. Louis MO, USA.",
        "• ESA/FSA pub. nº 009/98 <i>\"Guía para la utilización segura de elementos de sellado - Juntas y Bridas\"</i>, Parte 1 - Pautas para los operadores / técnicos / ajustadores de mantenimiento. European Sealing Association (ESA) / Fluid Sealing Association (FSA)."
    ]
    
    right_flowables = []
    for item in items:
        right_flowables.append(Paragraph(item, right_text_style))
        
    # Scale column widths to fit the total width
    col_left = round(width * 0.22)
    col_right = width - col_left
    
    t = Table([[left_paragraph, right_flowables]], colWidths=[col_left, col_right])
    t.setStyle([
        ('BACKGROUND', (0,0), (0,0), colors.HexColor('#a5bfdd')),
        ('VALIGN', (0,0), (0,0), 'MIDDLE'),
        ('VALIGN', (1,0), (1,0), 'TOP'),
        ('BOX', (0,0), (-1,-1), 0.8, colors.black),
        ('LINEBEFORE', (1,0), (1,0), 0.8, colors.black),
        ('LEFTPADDING', (0,0), (0,0), 12),
        ('RIGHTPADDING', (0,0), (0,0), 12),
        ('TOPPADDING', (0,0), (0,0), 12),
        ('BOTTOMPADDING', (0,0), (0,0), 12),
        ('LEFTPADDING', (1,0), (1,0), 12),
        ('RIGHTPADDING', (1,0), (1,0), 12),
        ('TOPPADDING', (1,0), (1,0), 8),
        ('BOTTOMPADDING', (1,0), (1,0), 4),
    ])
    return t

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
        spaceBefore=8,
        spaceAfter=4
    )
    
    body_text_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10.5,
        leading=14.5,
        textColor=COLORES_SULVY['texto'],
        alignment=4, # Justified
        spaceBefore=2,
        spaceAfter=2
    )
    
    # 1. HEADER (Title & Acta)
    story.append(Paragraph("INFORME DE INSPECCIÓN TÉCNICA", title_style))
    story.append(Spacer(1, 2))
    
    codigo_eq = equipo.get('codigo', equipo.get('numero', 'N/A'))
    num_acta = f"ACTA-{campania.replace(' ', '')}-{codigo_eq}"
    story.append(Paragraph(f"Acta de Inspección: {num_acta}", ParagraphStyle('DocActa', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, leading=13, textColor=COLORES_SULVY['secundario'], alignment=1)))
    story.append(Spacer(1, 6))
    
    # Line
    line_table = Table([['']], colWidths=[498], rowHeights=[1])
    line_table.setStyle([
        ('BACKGROUND', (0,0), (-1,-1), COLORES_SULVY['primario']),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ])
    story.append(line_table)
    story.append(Spacer(1, 4))
    
    # Criterios y Normativas Box
    criterios_box = generar_recuadro_criterios()
    story.append(criterios_box)
    story.append(Spacer(1, 6))
    
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
    story.append(Spacer(1, 6))
    
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
    story.append(Spacer(1, 6))
    
    # 4. ACCIONES EJECUTADAS
    story.append(Paragraph(f"ACCIONES EJECUTADAS EN {campania}", section_title_style))
    acciones_text = inspeccion.get('acciones', 'Sin acciones registradas.')
    story.append(Paragraph(acciones_text.replace('\n', '<br/>'), body_text_style))
    story.append(Spacer(1, 6))
    
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
    story.append(Spacer(1, 8))
    
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

def obtener_flujo_equipo_individual(equipo: dict, inspeccion: dict, fotos_locales: list = None) -> list:
    from app.services.db_service import get_config_value_db
    campania = get_config_value_db("reporte_campania", "PGP 2026")
    story = []
    styles = getSampleStyleSheet()
    
    # 6. JERARQUÍA VISUAL (ParagraphStyle with clear names and constraints)
    title_style = ParagraphStyle(
        'TituloPrincipalIndividual',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=COLORES_SULVY['primario'],
        alignment=1, # Center
        keepWithNext=True,
        spaceAfter=6,
        orphan=2,
        widow=2
    )
    
    subtitle_style = ParagraphStyle(
        'SubtituloIndividual',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=COLORES_SULVY['primario'],
        keepWithNext=True,
        spaceBefore=8,
        spaceAfter=4,
        orphan=2,
        widow=2
    )
    
    body_text_style = ParagraphStyle(
        'TextoNormalIndividual',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=COLORES_SULVY['texto'],
        alignment=4, # Justify
        spaceBefore=2,
        spaceAfter=2,
        orphan=2,
        widow=2
    )
    
    label_style = ParagraphStyle(
        'TableLabelIndividual',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=12,
        textColor=COLORES_SULVY['texto'],
        orphan=2,
        widow=2
    )
    
    val_style = ParagraphStyle(
        'TableValueIndividual',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=12,
        textColor=COLORES_SULVY['secundario'],
        orphan=2,
        widow=2
    )

    # 1. ESTRUCTURA DE STORY: TÍTULO PRINCIPAL
    story.append(Paragraph("INFORME DE INSPECCIÓN TÉCNICA", title_style))
    story.append(Spacer(1, 2))
    
    codigo_eq = equipo.get('codigo', equipo.get('numero', 'N/A'))
    num_acta = f"ACTA-{campania.replace(' ', '')}-{codigo_eq}"
    story.append(Paragraph(f"Acta de Inspección: {clean_xml_text(num_acta)}", ParagraphStyle('DocActaIndividual', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, leading=13, textColor=COLORES_SULVY['secundario'], alignment=1)))
    story.append(Spacer(1, 6))
    
    # Criterios y Normativas Box (scaled to fit individual report width 468)
    story.append(generar_recuadro_criterios(width=468))
    story.append(Spacer(1, 6))
    
    # 2. TABLA DE DATOS DEL EQUIPO (2 columns: Campo | Valor)
    fecha_insp_raw = inspeccion.get('updated_at', inspeccion.get('created_at', ''))
    if fecha_insp_raw:
        try:
            dt = datetime.datetime.fromisoformat(str(fecha_insp_raw).replace('Z', '+00:00'))
            fecha_str = dt.strftime("%d/%m/%Y")
        except:
            fecha_str = str(fecha_insp_raw)[:10]
    else:
        fecha_str = datetime.datetime.now().strftime("%d/%m/%Y")

    empresa_nombre = equipo.get('empresa', 'N/A')
    area_nombre = equipo.get('area', 'N/A')
    ubicacion_str = f"{empresa_nombre} &rarr; {area_nombre}"

    eq_details = [
        [Paragraph("Código del Equipo:", label_style), Paragraph(clean_xml_text(str(equipo.get('codigo', 'N/A'))), val_style)],
        [Paragraph("Nombre / Tag:", label_style), Paragraph(clean_xml_text(str(equipo.get('nombre', 'N/A'))), val_style)],
        [Paragraph("Material de Construcción:", label_style), Paragraph(clean_xml_text(str(equipo.get('material', 'N/A') or 'N/A')), val_style)],
        [Paragraph("Fluido de Servicio:", label_style), Paragraph(clean_xml_text(str(equipo.get('fluido', 'N/A') or 'N/A')), val_style)],
        [Paragraph("Presión de Diseño:", label_style), Paragraph(clean_xml_text(f"{equipo.get('presion_diseno', 'N/A')} bar" if equipo.get('presion_diseno') is not None else 'N/A'), val_style)],
        [Paragraph("Temperatura de Diseño:", label_style), Paragraph(clean_xml_text(f"{equipo.get('temperatura_diseno', 'N/A')} °C" if equipo.get('temperatura_diseno') is not None else 'N/A'), val_style)],
        [Paragraph("Ubicación / Área:", label_style), Paragraph(clean_xml_text(ubicacion_str), val_style)],
        [Paragraph("Fecha de Inspección:", label_style), Paragraph(clean_xml_text(fecha_str), val_style)]
    ]
    
    # 5. TABLAS: Usar Table con colWidths y TableStyle. colWidths=[150, 318] para un total de 468 (ancho de página 612-72-72)
    eq_table = Table(eq_details, colWidths=[150, 318])
    eq_table.setStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f1f5f9')),  # Fondo gris en la primera columna
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ])
    story.append(eq_table)
    story.append(Spacer(1, 6))
    
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
        'BadgeTxtIndividual',
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
        [Paragraph(f"<b>ESTADO {campania}:</b>", ParagraphStyle('EstLblIndividual', parent=styles['Normal'], fontSize=10, fontName='Helvetica-Bold')), badge_cell]
    ], colWidths=[130, 338])
    estado_layout.setStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ])
    story.append(estado_layout)
    story.append(Spacer(1, 6))
    
    # 3. SECCIÓN 1: ACCIONES EJECUTADAS (KeepTogether)
    acciones_text = inspeccion.get('acciones', 'Sin acciones registradas.')
    acciones_clean = clean_xml_text(acciones_text).replace('\n', '<br/>')
    sec_acciones = [
        Paragraph(f"ACCIONES EJECUTADAS EN {campania}", subtitle_style),
        Paragraph(acciones_clean, body_text_style),
        Spacer(1, 4)
    ]
    story.append(KeepTogether(sec_acciones))
    
    # 4. SECCIÓN 2: DIAGNÓSTICO TÉCNICO (KeepTogether)
    diagnostico_text = inspeccion.get('diagnostico', 'Sin diagnóstico registrado.')
    diagnostico_clean = clean_xml_text(diagnostico_text).replace('\n', '<br/>')
    sec_diagnostico = [
        Paragraph("DIAGNÓSTICO TÉCNICO", subtitle_style),
        Paragraph(diagnostico_clean, body_text_style),
        Spacer(1, 4)
    ]
    story.append(KeepTogether(sec_diagnostico))
    
    # 5. SECCIÓN 3: RECOMENDACIONES (cada ítem en viñeta o lista con KeepTogether)
    recom_text = inspeccion.get('recomendaciones', 'Sin recomendaciones registradas.')
    recom_lines = [line.strip() for line in recom_text.split('\n') if line.strip()]
    
    bullet_style = ParagraphStyle(
        'RecomBulletIndividual',
        parent=body_text_style,
        leftIndent=20,
        firstLineIndent=-10,
        spaceAfter=2,
        orphan=2,
        widow=2
    )
    
    sec_recom = [Paragraph("RECOMENDACIONES PARA EL PRÓXIMO PERÍODO", subtitle_style)]
    if recom_lines:
        for line in recom_lines:
            clean_line = line
            if clean_line.startswith(('•', '-', '*')):
                clean_line = clean_line[1:].strip()
            clean_line = clean_line.replace('\n', '<br/>')
            p = Paragraph(f"• {clean_xml_text(clean_line)}", bullet_style)
            sec_recom.append(p)
    else:
        sec_recom.append(Paragraph("Sin recomendaciones registradas.", body_text_style))
    
    sec_recom.append(Spacer(1, 4))
    story.append(KeepTogether(sec_recom))
    
    # 6. SECCIÓN 4: FOTOS DEL CUERPO (organizadas según tabla de cantidades)
    total_fotos = len(fotos_locales) if fotos_locales else 0
    config_fotos = obtener_config_fotos(total_fotos)
    
    if total_fotos > 0:
        story.append(Paragraph("FOTOS ILUSTRATIVAS DE LAS DISTINTAS ETAPAS DE LAS TAREAS DESARROLLADAS", subtitle_style))
        story.append(Spacer(1, 4))
        
        # Decide qué fotos van al cuerpo
        if config_fotos["ubicacion"] == "mixto":
            fotos_cuerpo = fotos_locales[:5]
            # Agregar la nota de referencia al cuerpo
            story.append(Paragraph("<i>Ver anexo para registro fotográfico completo.</i>", ParagraphStyle('RefAnexoIndividual', parent=styles['Normal'], fontName='Helvetica-Oblique', fontSize=9, textColor=COLORES_SULVY['gris'], spaceAfter=8)))
        else:
            fotos_cuerpo = fotos_locales
            
        # Generar elementos de fotos para el cuerpo
        col_count = config_fotos["columnas"]
        w_img = config_fotos["ancho"]
        fs_title = config_fotos["fuente_titulo"]
        fs_obs = config_fotos["fuente_obs"]
        spacing = config_fotos["espaciado_filas"]
        max_lines_obs = config_fotos.get("max_lineas_obs")
        
        # Estilos de comentario
        leyenda_style = ParagraphStyle(
            'LeyendaImagenIndividual',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=fs_title,
            leading=fs_title + 2.5,
            alignment=0, # Izquierda
            spaceBefore=4,
            spaceAfter=2,
            orphan=2,
            widow=2
        )
        
        obs_style = ParagraphStyle(
            'ComentarioImagenIndividual',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=fs_obs,
            leading=fs_obs + 2,
            textColor=colors.HexColor('#4a5568'),
            alignment=0, # Izquierda
            spaceAfter=4,
            orphan=2,
            widow=2
        )
        
        fotos_elements = []
        for idx, item in enumerate(fotos_cuerpo):
            path = item.get('path', item.get('ruta', item)) if isinstance(item, dict) else item
            caption = item.get('caption', item.get('descripcion', '')) if isinstance(item, dict) else ''
            
            # Parse Title and Observations
            lines = [l.strip() for l in caption.split('\n') if l.strip()]
            if not lines:
                title = f"Foto {idx + 1}: Detalle de inspección"
                obs = "Se observa el estado del equipo y puntos de interés."
            else:
                first_line = lines[0]
                if re.match(r'^foto\s+\d+[:\s]', first_line, re.IGNORECASE):
                    title = first_line
                else:
                    title = f"Foto {idx + 1}: {first_line}"
                
                if len(lines) > 1:
                    obs = "\n".join(lines[1:])
                else:
                    obs = "Se observa el estado del equipo y puntos de interés."
            
            # Enforce max 1 line if configured
            if max_lines_obs == 1:
                obs_lines = [l.strip() for l in obs.split('\n') if l.strip()]
                first_obs_line = obs_lines[0] if obs_lines else ""
                if len(first_obs_line) > 50:
                    obs = first_obs_line[:47] + "..."
                else:
                    obs = first_obs_line
            
            if os.path.exists(path):
                # Proportional Image using PIL
                rl_img = load_and_scale_image(path, w_img)
                
                # Image Cell Table to keep Image + Comments together
                cell_data = [
                    [rl_img],
                    [Paragraph(clean_xml_text(title), leyenda_style)],
                    [Paragraph(clean_xml_text(obs).replace('\n', '<br/>'), obs_style)]
                ]
                cell_table = Table(cell_data, colWidths=[w_img])
                cell_table.setStyle([
                    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                    ('VALIGN', (0,0), (-1,-1), 'TOP'),
                    ('TOPPADDING', (0,0), (-1,-1), 2),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 2),
                    ('LEFTPADDING', (0,0), (-1,-1), 0),
                    ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ])
                fotos_elements.append(cell_table)
        
        # Build Grid (1 or 2 columns)
        if col_count == 1:
            for element in fotos_elements:
                story.append(KeepTogether([element, Spacer(1, spacing)]))
        else: # 2 columns
            for i in range(0, len(fotos_elements), 2):
                row_items = fotos_elements[i:i+2]
                col_width = 468 / 2.0  # 234
                if len(row_items) == 2:
                    row_table = Table([row_items], colWidths=[col_width, col_width])
                else:
                    row_table = Table([[row_items[0], '']], colWidths=[col_width, col_width])
                
                row_table.setStyle([
                    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                    ('VALIGN', (0,0), (-1,-1), 'TOP'),
                    ('TOPPADDING', (0,0), (-1,-1), 0),
                    ('BOTTOMPADDING', (0,0), (-1,-1), spacing),
                    ('LEFTPADDING', (0,0), (-1,-1), 10), # Padding of 10pt between cells
                    ('RIGHTPADDING', (0,0), (-1,-1), 10),
                ])
                story.append(KeepTogether([row_table]))
    else:
        story.append(Paragraph("FOTOS ILUSTRATIVAS DE LAS DISTINTAS ETAPAS DE LAS TAREAS DESARROLLADAS", subtitle_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph("<i>No se registran imágenes asociadas.</i>", body_text_style))
        story.append(Spacer(1, 8))
        
    return story

def generar_bloque_firma_individual() -> list:
    styles = getSampleStyleSheet()
    linea_style = ParagraphStyle('FirmaLineaIndiv', parent=styles['Normal'], fontName='Helvetica',
                                 fontSize=9, alignment=1, textColor=MEMBRETE['separador'])
    nombre_style = ParagraphStyle('FirmaNombreIndiv', parent=styles['Normal'], fontName='Helvetica-Bold',
                                  fontSize=9, leading=11, alignment=1, textColor=MEMBRETE['texto'])
    cargo_style = ParagraphStyle('FirmaCargoIndiv', parent=styles['Normal'], fontName='Helvetica',
                                 fontSize=8, leading=10, alignment=1, textColor=COLORES_SULVY['gris'])
    matricula_style = ParagraphStyle('FirmaMatriculaIndiv', parent=styles['Normal'], fontName='Helvetica',
                                     fontSize=7.5, leading=9.5, alignment=1, textColor=COLORES_SULVY['gris'])
    empresa_style = ParagraphStyle('FirmaEmpresaIndiv', parent=styles['Normal'], fontName='Helvetica-Bold',
                                   fontSize=11, leading=14, alignment=1, textColor=COLORES_SULVY['primario'])

    col_izq = [
        Paragraph("_______________________", linea_style),
        Spacer(1, 4),
        Paragraph("Marco G. Paltrinieri", nombre_style),
        Paragraph("Director Técnico", cargo_style),
        Paragraph("Matrícula COPIME Nº 12345", matricula_style)
    ]
    col_der = [
        Paragraph("_______________________", linea_style),
        Spacer(1, 4),
        Paragraph("Ing. Esteban M. Irioni", nombre_style),
        Paragraph("Inspector Autorizado", cargo_style),
        Paragraph("Matrícula COPIME Nº 67890", matricula_style)
    ]

    firma_tabla = Table([[col_izq, col_der]], colWidths=[234, 234])
    firma_tabla.setStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 15),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ])

    return [
        Spacer(1, 8),
        KeepTogether([
            firma_tabla,
            Spacer(1, 4),
            Paragraph("SULVY SRL", empresa_style)
        ])
    ]

def generar_recuadro_certificaciones(datos_inspeccion: dict = None, equipo: dict = None, inspeccion: dict = None) -> list:
    paths_to_check = []
    if datos_inspeccion and datos_inspeccion.get('certificacion_path'):
        paths_to_check.append(datos_inspeccion['certificacion_path'])
    if equipo and equipo.get('certificacion_path'):
        paths_to_check.append(equipo['certificacion_path'])
    if inspeccion and inspeccion.get('certificacion_path'):
        paths_to_check.append(inspeccion['certificacion_path'])
        
    assets_cert = os.path.join("app", "assets", "certificacion.png")
    paths_to_check.append(assets_cert)
    
    cert_path = None
    for p in paths_to_check:
        if p and os.path.exists(p):
            cert_path = p
            break
            
    if not cert_path:
        return []
        
    try:
        rl_img = load_and_scale_image(cert_path, 200)
        styles = getSampleStyleSheet()
        caption_style = ParagraphStyle(
            'CertCaption',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=8,
            leading=10,
            textColor=colors.HexColor('#4a5568'),
            alignment=1,
            spaceBefore=4
        )
        
        caption_p = Paragraph("Certificaciones vigentes al momento de la inspección", caption_style)
        
        t = Table([[rl_img], [caption_p]], colWidths=[220])
        t.setStyle([
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ])
        
        return [
            Spacer(1, 15),
            KeepTogether([
                Paragraph("<b>CERTIFICACIONES</b>", ParagraphStyle('CertTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, textColor=COLORES_SULVY['primario'], spaceAfter=5, alignment=1)),
                t
            ])
        ]
    except Exception as e:
        logger.error(f"Error rendering certification box: {e}")
        return []

def generar_anexo_individual(fotos_locales: list) -> list:
    if not fotos_locales or len(fotos_locales) <= 20:
        return []
        
    story = []
    styles = getSampleStyleSheet()
    
    story.append(PageBreak())
    
    annex_title_style = ParagraphStyle(
        'AnnexTitleIndividual',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=COLORES_SULVY['primario'],
        alignment=1,
        spaceAfter=15,
        keepWithNext=True
    )
    story.append(Paragraph("ANEXO: REGISTRO FOTOGRÁFICO", annex_title_style))
    story.append(Spacer(1, 5))
    
    fotos_anexo = fotos_locales[5:]
    
    col_w = 468 / 3.0  # 156
    w_img = 140
    spacing = 6
    
    leyenda_style = ParagraphStyle(
        'LeyendaImagenAnexo',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7,
        leading=9,
        alignment=0,
        spaceBefore=3,
        spaceAfter=1,
        orphan=2,
        widow=2
    )
    
    obs_style = ParagraphStyle(
        'ComentarioImagenAnexo',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=6,
        leading=8,
        textColor=colors.HexColor('#4a5568'),
        alignment=0,
        spaceAfter=3,
        orphan=2,
        widow=2
    )
    
    fotos_elements = []
    for idx, item in enumerate(fotos_anexo):
        real_idx = idx + 6
        path = item.get('path', item.get('ruta', item)) if isinstance(item, dict) else item
        caption = item.get('caption', item.get('descripcion', '')) if isinstance(item, dict) else ''
        
        lines = [l.strip() for l in caption.split('\n') if l.strip()]
        if not lines:
            title = f"Foto {real_idx}: Detalle de inspección"
            obs = "Se observa el estado del equipo."
        else:
            first_line = lines[0]
            if re.match(r'^foto\s+\d+[:\s]', first_line, re.IGNORECASE):
                title = first_line
            else:
                title = f"Foto {real_idx}: {first_line}"
            
            if len(lines) > 1:
                obs = "\n".join(lines[1:])
            else:
                obs = "Se observa el estado del equipo."
                
        if os.path.exists(path):
            rl_img = load_and_scale_image(path, w_img)
            
            cell_data = [
                [rl_img],
                [Paragraph(clean_xml_text(title), leyenda_style)],
                [Paragraph(clean_xml_text(obs).replace('\n', '<br/>'), obs_style)]
            ]
            cell_table = Table(cell_data, colWidths=[w_img])
            cell_table.setStyle([
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('TOPPADDING', (0,0), (-1,-1), 1),
                ('BOTTOMPADDING', (0,0), (-1,-1), 1),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ])
            fotos_elements.append(cell_table)
            
    for i in range(0, len(fotos_elements), 3):
        row_items = fotos_elements[i:i+3]
        if len(row_items) == 3:
            row_table = Table([row_items], colWidths=[col_w, col_w, col_w])
        elif len(row_items) == 2:
            row_table = Table([[row_items[0], row_items[1], '']], colWidths=[col_w, col_w, col_w])
        else:
            row_table = Table([[row_items[0], '', '']], colWidths=[col_w, col_w, col_w])
            
        row_table.setStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), spacing),
            ('LEFTPADDING', (0,0), (-1,-1), 5),
            ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ])
        story.append(KeepTogether([row_table]))
        
    return story

def generar_pdf_individual(equipo: dict, inspeccion: dict, fotos_locales: list = None) -> bytes:
    try:
        buffer = io.BytesIO()
        
        left_margin = 72
        right_margin = 72
        top_margin = 72
        bottom_margin = 72
        
        doc = BaseDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=left_margin,
            rightMargin=right_margin,
            topMargin=top_margin,
            bottomMargin=bottom_margin
        )
        
        frame_x = left_margin
        frame_y = bottom_margin + 50
        frame_width = letter[0] - left_margin - right_margin
        frame_height = letter[1] - (top_margin + 50) - (bottom_margin + 50)
        
        frame = Frame(frame_x, frame_y, frame_width, frame_height, id='normal')
        
        def draw_header_footer(canvas, document):
            canvas.saveState()
            
            ancho = letter[0]
            alto = letter[1]
            
            # --- HEADER ---
            if os.path.exists(HEADER_ASSET):
                h_head = altura_banda(HEADER_ASSET, ancho)
                canvas.drawImage(HEADER_ASSET, 0, alto - h_head, width=ancho, height=h_head,
                                 preserveAspectRatio=True, mask='auto')
            else:
                canvas.setFont('Helvetica-Bold', 9)
                canvas.setFillColor(colors.HexColor('#1a365d'))
                canvas.drawString(left_margin, alto - 50, "INFORME DE INSPECCIÓN TÉCNICA")
                
                page_num_str = f"Pág. {canvas._pageNumber}"
                canvas.drawRightString(ancho - right_margin, alto - 50, page_num_str)
                
                canvas.setStrokeColor(colors.HexColor('#cbd5e1'))
                canvas.setLineWidth(0.5)
                canvas.line(left_margin, alto - 55, ancho - right_margin, alto - 55)
            
            # --- FOOTER ---
            if os.path.exists(FOOTER_ASSET):
                h_foot = altura_banda(FOOTER_ASSET, ancho)
                canvas.drawImage(FOOTER_ASSET, 0, 0, width=ancho, height=h_foot,
                                 preserveAspectRatio=True, mask='auto')
                # Numeración de página por encima de la banda del pie, centrada
                canvas.setFont('Helvetica', 7.5)
                canvas.setFillColor(colors.HexColor('#4a5568'))
                canvas.drawCentredString(ancho / 2.0, h_foot + 6, f"Pág. {canvas._pageNumber}")
            else:
                canvas.setFont('Helvetica', 8)
                canvas.setFillColor(colors.HexColor('#4a5568'))
                contacto_linea = "Miranda 549 (B1686GNA) Hurlingham, Buenos Aires  •  Tel: +54 11 4665-2875 / 4662-2558  •  info@sulvy.com"
                canvas.drawCentredString(ancho / 2.0, 50, contacto_linea)
                canvas.line(left_margin, 62, ancho - right_margin, 62)
            
            canvas.restoreState()
            
        template = PageTemplate(id='todos', frames=frame, onPage=draw_header_footer)
        doc.addPageTemplates([template])
        
        # 12. ESTRUCTURA DE STORY
        # 1. Título principal
        # 2. Tabla de datos del equipo
        # 3. Sección 1: Acciones ejecutadas (KeepTogether)
        # 4. Sección 2: Diagnóstico técnico (KeepTogether)
        # 5. Sección 3: Recomendaciones (KeepTogether)
        # 6. Sección 4: Fotos del cuerpo (organizadas según cantidad)
        story = obtener_flujo_equipo_individual(equipo, inspeccion, fotos_locales)
        
        # 7. Sección 5: Firmas (con espacio para nombres, cargos y matrículas)
        story.extend(generar_bloque_firma_individual())
        
        # 13. Certificaciones (al final, no interfieren con flujo principal)
        story.extend(generar_recuadro_certificaciones(equipo=equipo, inspeccion=inspeccion))
        
        # 8. Anexo (si aplica): Registro fotográfico completo (3 columnas)
        story.extend(generar_anexo_individual(fotos_locales))
        
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
    except Exception as e:
        logger.error(f"Error generando PDF individual con BaseDocTemplate: {e}", exc_info=True)
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
        story.append(Spacer(1, 15))
        story.append(Paragraph("SULVY", ParagraphStyle('CoverSulvyLogo', fontName='Helvetica-Bold', fontSize=32, leading=38, textColor=COLORES_SULVY['primario'], alignment=1, spaceAfter=5)))
        story.append(Paragraph("Sistema de Gestión de Calidad y Ambiental Certificado", ParagraphStyle('CoverSulvySub', fontName='Helvetica', fontSize=10, leading=13, textColor=COLORES_SULVY['secundario'], alignment=1, spaceAfter=20)))
        
        story.append(Paragraph("LIBRO DE INSPECCIONES TÉCNICAS", ParagraphStyle('CoverBookTitle', fontName='Helvetica-Bold', fontSize=22, leading=26, textColor=COLORES_SULVY['primario'], alignment=1, spaceAfter=5)))
        story.append(Paragraph(nombre_ubicacion.upper(), ParagraphStyle('CoverBookSub', fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=COLORES_SULVY['enfasis'], alignment=1, spaceAfter=12)))
        
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
        story.append(Spacer(1, 10))
        
        # Objetivo
        story.append(Paragraph("<b>Objetivo:</b>", ParagraphStyle('ObjHead', fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=COLORES_SULVY['primario'])))
        objetivo_text = f"Consolidar los informes de inspección técnica realizados en la ubicación {nombre_ubicacion} de la empresa {nombre_empresa} durante la campaña {campania}, detallando los hallazgos técnicos, el estado de conservación de los activos, y las recomendaciones de mantenimiento propuestas para el período {next_camp}."
        story.append(Paragraph(objetivo_text, ParagraphStyle('ObjVal', fontName='Helvetica', fontSize=9.5, leading=13.5, textColor=COLORES_SULVY['texto'], alignment=4)))
        story.append(Spacer(1, 8))
        
        # Criterios y Normativas
        story.append(generar_recuadro_criterios())
            
        story.append(PageBreak())

        # Group and sort equipments by severity (CRITICO > REGULAR > BUENO/FUERA DE RUTA)
        criticos = []
        regulares = []
        buenos_y_otros = []
        
        for eq in equipos:
            insp = next((i for i in inspecciones if i['equipo_id'] == eq['id']), {})
            estado_val = str(insp.get('estado', 'BUENO')).upper()
            if 'CRIT' in estado_val:
                criticos.append((eq, insp))
            elif 'REGULAR' in estado_val:
                regulares.append((eq, insp))
            else:
                buenos_y_otros.append((eq, insp))
                
        # Sort alphabetically within each severity group
        criticos.sort(key=lambda x: x[0].get('codigo', ''))
        regulares.sort(key=lambda x: x[0].get('codigo', ''))
        buenos_y_otros.sort(key=lambda x: x[0].get('codigo', ''))
        
        # Calculate dynamic page numbers
        # Cover page = Page 1
        # Metrics/Dashboard = Page 2
        # Plan de Acción table = Page 3
        # Estimate number of pages for Plan de Acción table (max 20 rows per page)
        total_eq = len(equipos)
        plan_pages = (total_eq + 19) // 20 if total_eq > 0 else 1
        
        # Index page = Page (3 + plan_pages)
        # Body starts at Page (3 + plan_pages + 1)
        current_page = 3 + plan_pages + 1
        
        criticos_indexed = []
        regulares_indexed = []
        buenos_y_otros_indexed = []
        
        if criticos:
            current_page += 1 # 1 page for Chapter I Title Cover
            for eq, insp in criticos:
                criticos_indexed.append((eq, current_page))
                current_page += 2 # each equipment takes exactly 2 pages
                
        if regulares:
            current_page += 1 # 1 page for Chapter II Title Cover
            for eq, insp in regulares:
                regulares_indexed.append((eq, current_page))
                current_page += 2
                
        if buenos_y_otros:
            current_page += 1 # 1 page for Chapter III Title Cover
            for eq, insp in buenos_y_otros:
                buenos_y_otros_indexed.append((eq, current_page))
                current_page += 2

        # 1.5. PANEL DE CONTROL Y MÉTRICAS DE DECISIÓN (Dashboard)
        story.append(Paragraph("<b>PANEL DE CONTROL Y MÉTRICAS DE DECISIÓN</b>", ParagraphStyle('DashTitle', fontName='Helvetica-Bold', fontSize=16, leading=20, textColor=COLORES_SULVY['primario'], spaceAfter=15)))
        
        dash_desc = f"Este panel resume la distribución del estado de conservación de los activos de la ubicación <b>{nombre_ubicacion}</b> de la empresa <b>{nombre_empresa}</b> durante la campaña activa <b>{campania}</b>. Su propósito es proveer información estadística clave para la planificación presupuestaria de mantenimiento técnico."
        story.append(Paragraph(dash_desc, ParagraphStyle('DashDesc', fontName='Helvetica', fontSize=9.5, leading=14, textColor=COLORES_SULVY['texto'], spaceAfter=15)))
        
        counts = {"BUENO": 0, "REGULAR": 0, "CRITICO": 0, "FUERA DE RUTA": 0}
        for insp in inspecciones:
            est = str(insp.get('estado', 'BUENO')).upper()
            if 'CRIT' in est:
                counts['CRITICO'] += 1
            elif 'REGULAR' in est:
                counts['REGULAR'] += 1
            elif 'FUERA' in est:
                counts['FUERA DE RUTA'] += 1
            else:
                counts['BUENO'] += 1
                
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
                Paragraph(f"<b>{state}</b>", ParagraphStyle('StateLabel', fontName='Helvetica', fontSize=9.5)),
                Paragraph(f"{cnt} ({pct:.1f}%)", ParagraphStyle('StateCount', fontName='Helvetica-Bold', fontSize=9.5, alignment=1)),
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
        story.append(PageBreak())

        # 1.6. PLAN DE ACCIÓN Y ESTIMACIÓN DE ALCANCES (Para estimación de costos)
        story.append(Paragraph("<b>PLAN DE ACCIÓN Y ESTIMACIÓN DE ALCANCES</b>", ParagraphStyle('PlanTitle', fontName='Helvetica-Bold', fontSize=16, leading=20, textColor=COLORES_SULVY['primario'], spaceAfter=12)))
        
        plan_desc = "Esta sección consolida las intervenciones recomendadas por la inspección técnica. Clasifica el tipo de tarea prioritaria para facilitar el desarrollo de cotizaciones y estimación de costos de reparación o parada general de planta."
        story.append(Paragraph(plan_desc, ParagraphStyle('PlanDesc', fontName='Helvetica', fontSize=9.5, leading=14, textColor=COLORES_SULVY['texto'], spaceAfter=15)))
        
        table_text_style = ParagraphStyle(
            'PlanTableText',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=10,
            textColor=COLORES_SULVY['texto']
        )
        table_header_style = ParagraphStyle(
            'PlanTableHeader',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8.5,
            leading=11,
            textColor=colors.white,
            alignment=1
        )
        
        plan_data = [[
            Paragraph("<b>Equipo</b>", table_header_style),
            Paragraph("<b>Estado</b>", table_header_style),
            Paragraph("<b>Intervención Propuesta</b>", table_header_style),
            Paragraph("<b>Prioridad</b>", table_header_style),
            Paragraph("<b>Recomendaciones</b>", table_header_style)
        ]]
        
        all_ordered = criticos + regulares + buenos_y_otros
        for eq, insp in all_ordered:
            codigo = eq.get('codigo', 'N/A')
            nombre = eq.get('nombre', 'N/A')
            estado_val = str(insp.get('estado', 'BUENO')).upper()
            
            if 'CRIT' in estado_val:
                intervencion = "Reparación Urgente"
                prioridad = "Alta"
                estado_color = "#ef4444"
                prio_color = "#ef4444"
            elif 'REGULAR' in estado_val:
                intervencion = "Mantenimiento Prog."
                prioridad = "Media"
                estado_color = "#f59e0b"
                prio_color = "#f59e0b"
            elif 'BUENO' in estado_val:
                intervencion = "Monitoreo Prev."
                prioridad = "Baja"
                estado_color = "#22c55e"
                prio_color = "#22c55e"
            else:
                intervencion = "Re-inspección"
                prioridad = "Baja"
                estado_color = "#6b7280"
                prio_color = "#6b7280"
                
            recom = insp.get('recomendaciones', 'Sin recomendaciones.')
            if len(recom) > 130:
                recom = recom[:127] + "..."
                
            plan_data.append([
                Paragraph(f"<b>{codigo}</b><br/>{nombre}", table_text_style),
                Paragraph(f"<font color='{estado_color}'><b>{estado_val}</b></font>", ParagraphStyle('StateCol', parent=table_text_style, alignment=1)),
                Paragraph(intervencion, table_text_style),
                Paragraph(f"<font color='{prio_color}'><b>{prioridad}</b></font>", ParagraphStyle('PrioCol', parent=table_text_style, alignment=1)),
                Paragraph(recom.replace('\n', '<br/>'), table_text_style)
            ])
            
        plan_table = Table(plan_data, colWidths=[105, 70, 105, 50, 168])
        plan_table.setStyle([
            ('BACKGROUND', (0,0), (-1,0), COLORES_SULVY['primario']),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ])
        plan_table.repeatRows = 1
        story.append(plan_table)
        story.append(PageBreak())

        # 1.7. ÍNDICE GENERAL POR CAPÍTULOS
        story.append(Paragraph("<b>ÍNDICE DE EQUIPOS POR CAPÍTULOS</b>", ParagraphStyle('IndexTitle', fontName='Helvetica-Bold', fontSize=16, leading=20, textColor=COLORES_SULVY['primario'], spaceAfter=15)))
        
        index_data = []
        index_style = ParagraphStyle('IndexLine', fontName='Helvetica', fontSize=9.5, leading=13, textColor=COLORES_SULVY['texto'])
        chapter_style = ParagraphStyle('IndexChapter', fontName='Helvetica-Bold', fontSize=11, leading=16, textColor=COLORES_SULVY['primario'], spaceBefore=8, spaceAfter=4)
        page_style = ParagraphStyle('IndexPageNum', fontName='Helvetica-Bold', fontSize=9.5, leading=13, textColor=COLORES_SULVY['primario'], alignment=2)
        
        if criticos_indexed:
            index_data.append([Paragraph("<b>Capítulo I: Equipos en Estado Crítico</b>", chapter_style), "", ""])
            for idx, (eq, start_page) in enumerate(criticos_indexed):
                codigo = eq.get('codigo', 'N/A')
                nombre = eq.get('nombre', 'N/A')
                text = f"{codigo} - {nombre}"
                index_data.append([
                    Paragraph(text, index_style),
                    Paragraph(". . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .", ParagraphStyle('Dots', fontName='Helvetica', fontSize=9.5, textColor=colors.HexColor('#cbd5e1'))),
                    Paragraph(str(start_page), page_style)
                ])
                
        if regulares_indexed:
            index_data.append([Paragraph("<b>Capítulo II: Equipos en Estado Regular</b>", chapter_style), "", ""])
            for idx, (eq, start_page) in enumerate(regulares_indexed):
                codigo = eq.get('codigo', 'N/A')
                nombre = eq.get('nombre', 'N/A')
                text = f"{codigo} - {nombre}"
                index_data.append([
                    Paragraph(text, index_style),
                    Paragraph(". . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .", ParagraphStyle('Dots', fontName='Helvetica', fontSize=9.5, textColor=colors.HexColor('#cbd5e1'))),
                    Paragraph(str(start_page), page_style)
                ])
                
        if buenos_y_otros_indexed:
            index_data.append([Paragraph("<b>Capítulo III: Equipos en Estado Bueno / Otros</b>", chapter_style), "", ""])
            for idx, (eq, start_page) in enumerate(buenos_y_otros_indexed):
                codigo = eq.get('codigo', 'N/A')
                nombre = eq.get('nombre', 'N/A')
                text = f"{codigo} - {nombre}"
                index_data.append([
                    Paragraph(text, index_style),
                    Paragraph(". . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .", ParagraphStyle('Dots', fontName='Helvetica', fontSize=9.5, textColor=colors.HexColor('#cbd5e1'))),
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

        # Define chapter cover styles
        cap_title_style = ParagraphStyle(
            'ChapterCoverTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=22,
            leading=26,
            textColor=COLORES_SULVY['primario'],
            alignment=1,
            spaceAfter=15
        )
        cap_desc_style = ParagraphStyle(
            'ChapterCoverDesc',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=11,
            leading=15,
            textColor=COLORES_SULVY['secundario'],
            alignment=1,
            spaceAfter=30
        )
        line_table = Table([['']], colWidths=[200], rowHeights=[2])
        line_table.setStyle([
            ('BACKGROUND', (0,0), (-1,-1), COLORES_SULVY['primario']),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ])
        
        # CHAPTER I: EQUIPOS EN ESTADO CRÍTICO
        if criticos:
            story.append(Spacer(1, 150))
            story.append(Paragraph("CAPÍTULO I: EQUIPOS EN ESTADO CRÍTICO", cap_title_style))
            story.append(Paragraph("Equipos que presentan patologías graves o fallas estructurales que requieren reparación urgente o detención inmediata de operaciones para resguardar la seguridad y la integridad física de la planta.", cap_desc_style))
            story.append(line_table)
            story.append(PageBreak())
            
            for eq, insp in criticos:
                fotos = fotos_por_equipo.get(eq['id'], [])
                story.extend(obtener_flujo_equipo(eq, insp, fotos))
                story.append(PageBreak())
                
        # CHAPTER II: EQUIPOS EN ESTADO REGULAR
        if regulares:
            story.append(Spacer(1, 150))
            story.append(Paragraph("CAPÍTULO II: EQUIPOS EN ESTADO REGULAR", cap_title_style))
            story.append(Paragraph("Equipos con desviaciones operativas o patologías menores controladas. Se recomienda programar mantenimiento correctivo durante las paradas de planta regulares.", cap_desc_style))
            story.append(line_table)
            story.append(PageBreak())
            
            for eq, insp in regulares:
                fotos = fotos_por_equipo.get(eq['id'], [])
                story.extend(obtener_flujo_equipo(eq, insp, fotos))
                story.append(PageBreak())
                
        # CHAPTER III: EQUIPOS EN ESTADO BUENO / OTROS
        if buenos_y_otros:
            story.append(Spacer(1, 150))
            story.append(Paragraph("CAPÍTULO III: EQUIPOS EN ESTADO BUENO / OTROS", cap_title_style))
            story.append(Paragraph("Equipos en óptimo estado de conservación o cuya inspección parcial/fuera de ruta no detectó hallazgos relevantes. Se recomienda continuar con monitoreo preventivo de rutina.", cap_desc_style))
            story.append(line_table)
            story.append(PageBreak())
            
            for eq, insp in buenos_y_otros:
                fotos = fotos_por_equipo.get(eq['id'], [])
                story.extend(obtener_flujo_equipo(eq, insp, fotos))
                story.append(PageBreak())

        # Cierre: firma del equipo técnico
        story.append(Paragraph("<b>FIN DE INFORME CONSOLIDADO</b>", ParagraphStyle('EndTitle', fontName='Helvetica-Bold', fontSize=12, alignment=1, spaceAfter=20)))
        story.extend(generar_bloque_firma())

        canvas_maker = make_reporte_canvas_class(f"Libro {nombre_ubicacion} - {campania}")
        doc.build(story, canvasmaker=canvas_maker)
        
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
    except Exception as e:
        logger.error(f"Error generando PDF del Libro por Área: {e}", exc_info=True)
        raise e

