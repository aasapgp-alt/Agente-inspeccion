"""
Servicio de gestión de manuales técnicos (RAG básico).
Carga documentos desde Google Drive, extrae texto y devuelve contexto relevante
según material y palabras clave detectadas en la inspección.
"""

from typing import Dict
from services.drive_service import DriveService
from services.pdf_service import PDFService


class ManualService:

    def __init__(self, folder_id: str):
        self.folder_id = folder_id
        self.drive = DriveService()
        self.pdf = PDFService()

        self.manuales: Dict[str, str] = {}
        self._cargar_manuales()

    # ==========================================
    # CARGA DESDE GOOGLE DRIVE
    # ==========================================
    def _cargar_manuales(self):

        try:
            archivos = self.drive.descargar_manuales(self.folder_id)

            for nombre, contenido in archivos.items():

                nombre_upper = nombre.upper()

                # PDF
                if nombre.lower().endswith(".pdf"):
                    texto = self.pdf.extraer_texto_bytes(contenido)

                # TXT
                elif nombre.lower().endswith(".txt"):
                    texto = contenido.decode("utf-8", errors="ignore")

                # DOCX (opcional futuro)
                else:
                    continue

                # limpiar texto básico
                texto = self._limpiar_texto(texto)

                self.manuales[nombre_upper] = texto

        except Exception as e:
            print(f"[ManualService] Error cargando manuales: {e}")

    # ==========================================
    # LIMPIEZA DE TEXTO
    # ==========================================
    def _limpiar_texto(self, texto: str) -> str:

        reemplazos = {
            'Ã¡': 'á', 'Ã©': 'é', 'Ã­': 'í',
            'Ã³': 'ó', 'Ãº': 'ú',
            'Ã±': 'ñ', 'Ã‘': 'Ñ'
        }

        for mal, bien in reemplazos.items():
            texto = texto.replace(mal, bien)

        return texto

    # ==========================================
    # SELECCIÓN DE MANUAL POR MATERIAL
    # ==========================================
    def _seleccionar_manual(self, material: str) -> str:

        material = material.upper()

        for nombre, contenido in self.manuales.items():

            # matching flexible
            if material in nombre:
                return contenido

            # fallback por palabras comunes
            if "FRP" in material and "FRP" in nombre:
                return contenido

            if "ACR" in material and "ACR" in nombre:
                return contenido

            if "INOX" in material and "INOX" in nombre:
                return contenido

        return ""

    # ==========================================
    # RAG SIMPLE POR KEYWORDS (CORE)
    # ==========================================
    def get_contexto_relevante(self, material: str, texto_referencia: str) -> str:

        manual = self._seleccionar_manual(material)

        if not manual:
            return ""

        texto_referencia = texto_referencia.lower()

        keywords = [
            "ampolla",
            "fisura",
            "corrosión",
            "corrosion",
            "fuga",
            "filtración",
            "filtracion",
            "delaminación",
            "delaminacion",
            "recubrimiento",
            "espesor",
            "desgaste",
            "degradación",
            "degradacion",
            "incrustación",
            "incrustacion",
            "fibra expuesta"
        ]

        lineas = manual.split("\n")
        relevantes = []

        for linea in lineas:

            linea_l = linea.lower()

            for k in keywords:
                if k in linea_l and k in texto_referencia:
                    relevantes.append(linea.strip())
                    break

        # fallback: si no encuentra nada, devolver primeras líneas útiles
        if not relevantes:
            relevantes = lineas[:10]

        # limitar tamaño para no romper prompt
        contexto = "\n".join(relevantes[:12])

        return contexto

    # ==========================================
    # DEBUG / INFO
    # ==========================================
    def listar_manuales_cargados(self):

        return list(self.manuales.keys())