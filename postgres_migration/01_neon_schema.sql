-- ==============================================================================
-- DATABASE SCHEMA: Agente Inspector (Neon PostgreSQL)
-- Descripción: Esquema relacional completo para PostgreSQL / Neon Serverless
-- ==============================================================================

-- Habilitar extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla: empresas
CREATE TABLE IF NOT EXISTS empresas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) UNIQUE NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla: ubicaciones (Áreas de inspección por empresa)
CREATE TABLE IF NOT EXISTS ubicaciones (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    codigo VARCHAR(100),
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    drive_folder_id VARCHAR(255),
    CONSTRAINT fk_ubicaciones_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    CONSTRAINT uq_empresa_ubicacion UNIQUE (empresa_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_empresa ON ubicaciones(empresa_id);

-- 3. Tabla: campanias
CREATE TABLE IF NOT EXISTS campanias (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_campanias_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    CONSTRAINT uq_empresa_campania UNIQUE (empresa_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_campanias_empresa ON campanias(empresa_id);

-- 4. Tabla: equipos
CREATE TABLE IF NOT EXISTS equipos (
    id SERIAL PRIMARY KEY,
    ubicacion_id INTEGER NOT NULL,
    codigo VARCHAR(100) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    tag VARCHAR(100),
    material VARCHAR(100),
    criticidad VARCHAR(50),
    fluido VARCHAR(100),
    presion_diseno NUMERIC(10,2),
    temperatura_diseno NUMERIC(10,2),
    estado_actual VARCHAR(50) DEFAULT 'PENDIENTE',
    activo BOOLEAN DEFAULT TRUE,
    fecha_instalacion DATE,
    fabricante VARCHAR(255),
    modelo VARCHAR(255),
    drive_folder_id VARCHAR(255),
    CONSTRAINT fk_equipos_ubicacion FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id) ON DELETE CASCADE,
    CONSTRAINT uq_ubicacion_codigo UNIQUE (ubicacion_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_equipos_ubicacion ON equipos(ubicacion_id);
CREATE INDEX IF NOT EXISTS idx_equipos_codigo ON equipos(codigo);
CREATE INDEX IF NOT EXISTS idx_equipos_estado ON equipos(estado_actual);
CREATE INDEX IF NOT EXISTS idx_equipos_tag ON equipos(tag);

-- 5. Tabla: usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(255) NOT NULL,
    rol VARCHAR(50) DEFAULT 'inspector' CHECK(rol IN ('inspector', 'supervisor', 'admin')),
    empresa VARCHAR(255),
    activo BOOLEAN DEFAULT TRUE,
    ultimo_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

-- 6. Tabla: sesiones_activas
CREATE TABLE IF NOT EXISTS sesiones_activas (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sesiones_usuario FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sesiones_token ON sesiones_activas(token);
CREATE INDEX IF NOT EXISTS idx_sesiones_user_id ON sesiones_activas(user_id);

-- 7. Tabla: auditoria
CREATE TABLE IF NOT EXISTS auditoria (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    accion VARCHAR(100) NOT NULL,
    tabla VARCHAR(100),
    registro_id INTEGER,
    detalles TEXT,
    ip_address VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auditoria_usuario FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_auditoria_user ON auditoria(user_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_created ON auditoria(created_at);

-- 8. Tabla: inspecciones
CREATE TABLE IF NOT EXISTS inspecciones (
    id SERIAL PRIMARY KEY,
    equipo_id INTEGER NOT NULL,
    anio INTEGER,
    estado VARCHAR(50),
    acciones TEXT,
    diagnostico TEXT,
    recomendaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reporte_generado BOOLEAN DEFAULT FALSE,
    ruta_pdf_local TEXT,
    ruta_pdf_drive TEXT,
    drive_file_id VARCHAR(255),
    fecha_generacion_reporte TIMESTAMP WITH TIME ZONE,
    tipo_reporte VARCHAR(100),
    numero_acta VARCHAR(100),
    estado_generacion VARCHAR(50),
    error_generacion TEXT,
    metadata_historica JSONB,
    CONSTRAINT fk_inspecciones_equipo FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_inspecciones_equipo ON inspecciones(equipo_id);
CREATE INDEX IF NOT EXISTS idx_inspecciones_anio ON inspecciones(anio);
CREATE INDEX IF NOT EXISTS idx_inspecciones_created ON inspecciones(created_at);

-- 9. Tabla: libros
CREATE TABLE IF NOT EXISTS libros (
    id SERIAL PRIMARY KEY,
    ubicacion_id INTEGER NOT NULL,
    nombre_ubicacion VARCHAR(255) NOT NULL,
    empresa_id INTEGER NOT NULL,
    nombre_empresa VARCHAR(255) NOT NULL,
    fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    usuario_id INTEGER NOT NULL,
    numero_equipos INTEGER,
    ruta_pdf_local TEXT,
    ruta_pdf_drive TEXT,
    drive_file_id VARCHAR(255),
    tamanio_pdf BIGINT,
    campania VARCHAR(100) DEFAULT 'PGP 2026',
    resumen_estados TEXT,
    equipos_incluidos TEXT,
    CONSTRAINT fk_libros_ubicacion FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id),
    CONSTRAINT fk_libros_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
CREATE INDEX IF NOT EXISTS idx_libros_ubicacion ON libros(ubicacion_id);
CREATE INDEX IF NOT EXISTS idx_libros_campania ON libros(campania);

-- 10. Tabla: reportes (Reportes individuales)
CREATE TABLE IF NOT EXISTS reportes (
    id SERIAL PRIMARY KEY,
    equipo_id INTEGER NOT NULL,
    nombre_equipo VARCHAR(255) NOT NULL,
    codigo_equipo VARCHAR(100),
    fecha_inspeccion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    estado_general VARCHAR(50),
    ruta_pdf_local TEXT,
    ruta_pdf_drive TEXT,
    tamanio_pdf BIGINT,
    usuario_id INTEGER,
    resumen_diagnostico TEXT,
    numero_acta VARCHAR(255),
    campania VARCHAR(100) DEFAULT 'PGP 2026',
    CONSTRAINT fk_reportes_equipo FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
    CONSTRAINT fk_reportes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_reportes_equipo ON reportes(equipo_id);
CREATE INDEX IF NOT EXISTS idx_reportes_campania ON reportes(campania);
CREATE INDEX IF NOT EXISTS idx_reportes_fecha ON reportes(fecha_generacion);

-- 11. Tabla: versiones_reportes
CREATE TABLE IF NOT EXISTS versiones_reportes (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL, -- 'individual' o 'libro'
    reporte_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    ruta_pdf_local TEXT,
    ruta_pdf_drive TEXT,
    drive_file_id VARCHAR(255),
    fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    usuario_id INTEGER,
    notas TEXT,
    CONSTRAINT fk_versiones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_versiones_reporte ON versiones_reportes(tipo, reporte_id);

-- 12. Tabla: reportes_versiones (legacy)
CREATE TABLE IF NOT EXISTS reportes_versiones (
    id SERIAL PRIMARY KEY,
    inspeccion_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    ruta_pdf_local TEXT,
    ruta_pdf_drive TEXT,
    drive_file_id VARCHAR(255),
    fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    usuario_id INTEGER,
    notas TEXT,
    CONSTRAINT fk_repvers_inspeccion FOREIGN KEY (inspeccion_id) REFERENCES inspecciones(id) ON DELETE CASCADE,
    CONSTRAINT fk_repvers_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_repvers_inspeccion ON reportes_versiones(inspeccion_id);

-- 11. Tabla: anotaciones_imagenes
CREATE TABLE IF NOT EXISTS anotaciones_imagenes (
    id SERIAL PRIMARY KEY,
    equipo_id INTEGER NOT NULL,
    image_id VARCHAR(255) NOT NULL,
    annotations TEXT NOT NULL,
    comentario TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_anotaciones_equipo FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
    CONSTRAINT uq_equipo_imagen UNIQUE (equipo_id, image_id)
);
CREATE INDEX IF NOT EXISTS idx_anotaciones_equipo ON anotaciones_imagenes(equipo_id);

-- 12. Tabla: configuracion
CREATE TABLE IF NOT EXISTS configuracion (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    tipo VARCHAR(50) DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
    descripcion TEXT,
    categoria VARCHAR(50), -- 'general', 'drive', 'ia', 'pdf', 'reportes', 'notificaciones'
    editable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_configuracion_clave ON configuracion(clave);

-- 13. Tabla: drive_folders_cache
CREATE TABLE IF NOT EXISTS drive_folders_cache (
    id SERIAL PRIMARY KEY,
    drive_id VARCHAR(255) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    parent_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_drive_folders_drive_id ON drive_folders_cache(drive_id);
CREATE INDEX IF NOT EXISTS idx_drive_folders_parent_id ON drive_folders_cache(parent_id);

-- 14. Tabla: aprendizaje
CREATE TABLE IF NOT EXISTS aprendizaje (
    id SERIAL PRIMARY KEY,
    equipo VARCHAR(255),
    ia_dijo TEXT,
    inspector_corrigio TEXT,
    leccion TEXT,
    fecha DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_aprendizaje_equipo ON aprendizaje(equipo);

-- 15. Tabla: plan_inspeccion_diaria (Itinerarios)
CREATE TABLE IF NOT EXISTS plan_inspeccion_diaria (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    fecha DATE NOT NULL,
    equipo_id INTEGER NOT NULL,
    orden INTEGER NOT NULL,
    estado VARCHAR(50) DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE', 'COMPLETADO', 'OMITIDO')),
    completado_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_itinerario_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_itinerario_equipo FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
    CONSTRAINT uq_itinerario_usuario_fecha_equipo UNIQUE (usuario_id, fecha, equipo_id)
);
CREATE INDEX IF NOT EXISTS idx_itinerario_usuario_fecha ON plan_inspeccion_diaria(usuario_id, fecha);
