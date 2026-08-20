# 🚀 Guía de Despliegue en Producción (Vercel + Render)

Esta guía explica paso a paso cómo desplegar el **Frontend en Vercel** y el **Backend en Render**.

---

## 1. Despliegue del Backend en Render

### Paso 1.1: Crear el servicio Web en Render
1. Ingresa a [render.com](https://render.com) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **New +** y selecciona **Web Service**.
3. Conecta el repositorio de GitHub de este proyecto (`Agente-Inspector`).
4. Configura los siguientes campos:
   * **Name**: `agente-inspector-api` (o el nombre que elijas).
   * **Language**: `Python 3` (o `Docker`).
   * **Branch**: `main` (o tu rama principal).
   * **Build Command**: `pip install -r requirements.txt`
   * **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   * **Instance Type**: `Free` o `Starter`.

### Paso 1.2: Configurar las Variables de Entorno en Render
En la pestaña **Environment** de tu servicio en Render, agrega las siguientes claves:

| Variable | Valor / Descripción |
| :--- | :--- |
| `PYTHON_VERSION` | `3.11.9` |
| `JWT_SECRET` | Genera una cadena aleatoria y segura (ej: `openssl rand -hex 32`) |
| `GEMINI_API_KEY` | Tu API Key de Google Gemini |
| `DRIVE_FOLDER_ID` | ID de la carpeta raíz de Google Drive para almacenamiento |
| `ADMIN_INITIAL_PASSWORD` | Contraseña inicial para el usuario `admin` |
| `DB_PATH` | `data/inspecciones.db` |

### Paso 1.3: Subir Credenciales de Google Drive (Service Account)
Si utilizas cuenta de servicio para Google Drive:
1. En Render, ve a la sección **Secret Files**.
2. Añade un archivo secreto con el nombre `service_account.json` y pega el contenido JSON de tus credenciales de Google Cloud.

> 💡 **Nota**: Una vez desplegado, Render te asignará una URL pública HTTPS, por ejemplo:  
> `https://agente-inspector-api.onrender.com`

---

## 2. Despliegue del Frontend en Vercel

### Paso 2.1: Importar el Proyecto en Vercel
1. Ingresa a [vercel.com](https://vercel.com) e inicia sesión con tu GitHub.
2. Haz clic en **Add New...** > **Project**.
3. Selecciona tu repositorio `Agente-Inspector`.

### Paso 2.2: Configurar el Directorio Raíz (Root Directory)
1. En la pantalla de configuración del proyecto, haz clic en **Edit** junto a **Root Directory**.
2. Selecciona la carpeta **`frontend`** y guarda.
3. El Framework Preset se detectará automáticamente como **Next.js**.

### Paso 2.3: Configurar la URL del Backend
En la sección **Environment Variables** de Vercel, agrega:

| Variable | Valor |
| :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://agente-inspector-api.onrender.com/api` (la URL de tu Render con `/api` al final) |

4. Haz clic en **Deploy**.

---

## 3. Concurrencia y Uso Simultáneo

* **Frontend**: Vercel distribuye la aplicación mediante una CDN global sin límite de conexiones simultáneas.
* **Backend y Base de Datos**:
  * SQLite ha sido configurado en modo **WAL (Write-Ahead Logging)** con un `busy_timeout` de 30 segundos y `synchronous = NORMAL`.
  * Esto permite que múltiples inspectores en planta consulten, sincronicen datos y generen informes simultáneamente sin bloqueos ni errores de bloqueo (`database is locked`).
