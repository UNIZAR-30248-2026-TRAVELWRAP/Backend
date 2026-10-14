-- 1. TIPOS ENUM (Con comprobación de existencia)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_viaje') THEN
    CREATE TYPE public.estado_viaje AS ENUM ('activo', 'finalizado', 'archivado');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rol_miembro') THEN
    CREATE TYPE public.rol_miembro AS ENUM ('creador', 'miembro');
  END IF;
END
$$;

-- 2. TABLAS
CREATE TABLE IF NOT EXISTS public.perfiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  nombre text NOT NULL,
  email text,
  avatar_url text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.viajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creador_id uuid REFERENCES public.perfiles (id) ON DELETE SET NULL,
  nombre text NOT NULL,
  -- Null mientras el destino está pendiente de decidir por votación
  destino text,
  descripcion text,
  fecha_inicio date,
  fecha_fin date,
  imagen_portada_url text,
  moneda char(3) NOT NULL DEFAULT 'EUR',
  -- Presupuesto estimado del viaje, en su moneda. Se fija al crearlo y se puede editar después
  presupuesto numeric(12,2) NOT NULL CHECK (presupuesto >= 0),
  estado public.estado_viaje NOT NULL DEFAULT 'activo',
  finalizado_en timestamptz,
  -- Token del enlace/QR de invitación: uno por viaje, permanente
  token_invitacion text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT viajes_fechas_validas CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TABLE IF NOT EXISTS public.miembros_viaje (
  viaje_id uuid NOT NULL REFERENCES public.viajes (id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.perfiles (id) ON DELETE CASCADE,
  rol public.rol_miembro NOT NULL DEFAULT 'miembro',
  unido_en timestamptz NOT NULL DEFAULT now(),
  abandonado_en timestamptz,
  PRIMARY KEY (viaje_id, usuario_id)
);

-- 3. ÍNDICES
CREATE INDEX IF NOT EXISTS miembros_viaje_usuario_idx ON public.miembros_viaje (usuario_id);