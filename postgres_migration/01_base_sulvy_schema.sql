-- ==============================================================================
-- DATABASE SCHEMA: base_sulvy (PostgreSQL)
-- Descripción: Esquema relacional y jerárquico para el Asistente de Inspección
-- ==============================================================================

-- Habilitar extensión para generación de UUIDs al vuelo
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla: empresas
CREATE TABLE IF NOT EXISTS empresas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) UNIQUE NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla: areas (Ubicaciones Técnicas)
CREATE TABLE IF NOT EXISTS areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empresa_id UUID NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    codigo_ubicacion_tecnica VARCHAR(100),
    CONSTRAINT fk_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);
CREATE INDEX idx_areas_empresa ON areas(empresa_id);

-- 3. Tabla: equipos
CREATE TABLE IF NOT EXISTS equipos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    area_id UUID NOT NULL,
    tag_codigo VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT,
    material VARCHAR(100),
    fluido VARCHAR(100),
    temperatura_diseno NUMERIC(10,2),
    presion_diseno NUMERIC(10,2),
    estado_actual VARCHAR(50), -- Ej: 'Bueno', 'Alerta', 'Roto'
    CONSTRAINT fk_area FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
);
CREATE INDEX idx_equipos_area ON equipos(area_id);
CREATE INDEX idx_equipos_estado ON equipos(estado_actual);

-- 4. Tabla: inspecciones
CREATE TABLE IF NOT EXISTS inspecciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipo_id UUID NOT NULL,
    fecha_inspeccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    inspector VARCHAR(255),
    origen VARCHAR(100), -- Ej: 'Telegram', 'Web App'
    transcripcion_audio TEXT,
    url_foto_drive TEXT,
    diagnostico_ia TEXT,
    dictamen_final VARCHAR(100), -- Ej: 'Aprobado', 'Observación', 'Rechazado'
    url_informe_pdf TEXT,
    metadata_historica JSONB, -- Almacena registros legacy como Estado_PGP2024 para continuidad analítica
    CONSTRAINT fk_equipo FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE
);
CREATE INDEX idx_inspecciones_equipo ON inspecciones(equipo_id);
-- Índice GIN para búsquedas de alta velocidad sobre el payload histórico JSONB
CREATE INDEX idx_inspecciones_metadata ON inspecciones USING GIN (metadata_historica);

-- 5. Tabla: configuracion
CREATE TABLE IF NOT EXISTS configuracion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    descripcion TEXT
);

-- 6. Tabla: aprendizaje (Retroalimentación de la IA)
CREATE TABLE IF NOT EXISTS aprendizaje (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipo_id UUID NOT NULL,
    chat_history JSONB, -- Historial de interacción Humano-IA
    correccion_humana TEXT,
    fecha_retroalimentacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_equipo_aprendizaje FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE
);
CREATE INDEX idx_aprendizaje_equipo ON aprendizaje(equipo_id);
