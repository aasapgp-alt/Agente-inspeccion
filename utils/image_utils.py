# utils/image_utils.py

from PIL import Image, ImageOps
import io

def descargar_imagen(fid, drive, max_dim=1200, max_kb=450):
    """Descarga y procesa una imagen desde Drive, devuelve PIL Image"""
    from services.drive_service import descargar_archivo
    
    data = descargar_archivo(fid, drive)
    if not data:
        return None
    
    try:
        img = Image.open(io.BytesIO(data))
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGB")
        try:
            img = ImageOps.exif_transpose(img)
        except Exception as e:
            st.logger.warning(f"⚠️ Error exif_transpose: {e}")
        
        w, h = img.size
        if max(w, h) > max_dim:
            r = max_dim / max(w, h)
            img = img.resize((int(w * r), int(h * r)), Image.Resampling.LANCZOS)
        
        # Comprimir si es necesario
        if max_kb:
            q = 88
            buf = None  # ✅ Inicializar
            while q >= 35:
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=q, optimize=True)
                if buf.tell() / 1024 <= max_kb:
                    break
                q -= 8
            
            if buf and buf.tell() > 0:
                buf.seek(0)
                img = Image.open(buf)
            else:
                st.logger.warning(f"⚠️ No se pudo comprimir imagen a {max_kb}KB")
        
        return img
        
    except Exception as e:
        st.logger.error(f"❌ Error procesando imagen: {e}", exc_info=True)
        return None

def pil_a_bytes(img, quality=82):
    """Convierte PIL Image a bytes"""
    try:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality)
        return buf.getvalue()
    except Exception as e:
        st.logger.error(f"❌ Error convirtiendo imagen a bytes: {e}")
        return None
