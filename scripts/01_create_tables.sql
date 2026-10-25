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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_votacion') THEN
    CREATE TYPE public.tipo_votacion AS ENUM ('fecha', 'destino', 'presupuesto', 'actividad', 'otro');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_votacion') THEN
    CREATE TYPE public.estado_votacion AS ENUM ('abierta', 'cerrada');
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
  -- activo: se puede editar. archivado: solo lectura; es el único estado desde el que se puede eliminar
  estado public.estado_viaje NOT NULL DEFAULT 'activo',
  -- Momento en que se cerró el viaje (al finalizarlo o archivarlo)
  finalizado_en timestamptz,
  -- Token del enlace/QR de invitación: uno por viaje, permanente
  token_invitacion text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT viajes_fechas_validas CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TABLE IF NOT EXISTS public.miembros_viaje (
  -- Al eliminar el viaje se borran sus miembros
  viaje_id uuid NOT NULL REFERENCES public.viajes (id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.perfiles (id) ON DELETE CASCADE,
  rol public.rol_miembro NOT NULL DEFAULT 'miembro',
  unido_en timestamptz NOT NULL DEFAULT now(),
  abandonado_en timestamptz,
  PRIMARY KEY (viaje_id, usuario_id)
);

-- Votaciones del grupo (fechas, destino, actividades...). La de destino se abre al crear un viaje sin destino
CREATE TABLE IF NOT EXISTS public.votaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Al eliminar el viaje se borran sus votaciones, y con ellas sus opciones y votos
  viaje_id uuid NOT NULL REFERENCES public.viajes (id) ON DELETE CASCADE,
  titulo text NOT NULL CHECK (char_length(btrim(titulo)) BETWEEN 1 AND 200),
  descripcion text,
  tipo public.tipo_votacion NOT NULL DEFAULT 'otro',
  estado public.estado_votacion NOT NULL DEFAULT 'abierta',
  -- Opción ganadora, que se guarda al cerrar la votación (con empate, una de las empatadas al azar)
  opcion_ganadora_id uuid,
  creado_por uuid REFERENCES public.perfiles (id) ON DELETE SET NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  cerrada_en timestamptz,
  CONSTRAINT votaciones_cierre_coherente CHECK ((estado = 'cerrada') = (cerrada_en IS NOT NULL))
);

-- Opciones entre las que se vota. Cualquier miembro puede proponer nuevas mientras la votación está abierta
CREATE TABLE IF NOT EXISTS public.opciones_votacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  votacion_id uuid NOT NULL REFERENCES public.votaciones (id) ON DELETE CASCADE,
  texto text NOT NULL CHECK (char_length(btrim(texto)) BETWEEN 1 AND 100),
  -- Solo en las votaciones de fechas
  valor_fecha date,
  -- Posición en la lista; las propuestas nuevas van al final
  orden int NOT NULL DEFAULT 0,
  -- Permite exigir que la opción de un voto sea de su misma votación
  CONSTRAINT opciones_votacion_id_votacion_unica UNIQUE (id, votacion_id)
);

-- Voto de un usuario en una votación. Cambiar el voto actualiza la fila; retirarlo la borra
CREATE TABLE IF NOT EXISTS public.votos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  votacion_id uuid NOT NULL REFERENCES public.votaciones (id) ON DELETE CASCADE,
  opcion_id uuid NOT NULL,
  usuario_id uuid NOT NULL REFERENCES public.perfiles (id) ON DELETE CASCADE,
  emitido_en timestamptz NOT NULL DEFAULT now(),
  -- Un voto por usuario y votación
  CONSTRAINT votos_un_voto_por_usuario UNIQUE (votacion_id, usuario_id),
  -- La opción votada tiene que ser de la misma votación
  CONSTRAINT votos_opcion_de_la_votacion FOREIGN KEY (opcion_id, votacion_id)
    REFERENCES public.opciones_votacion (id, votacion_id) ON DELETE CASCADE
);

-- votaciones y opciones_votacion se referencian entre sí: la clave de la opción ganadora se añade al final
ALTER TABLE public.votaciones DROP CONSTRAINT IF EXISTS votaciones_opcion_ganadora_fk;
ALTER TABLE public.votaciones ADD CONSTRAINT votaciones_opcion_ganadora_fk
  FOREIGN KEY (opcion_ganadora_id) REFERENCES public.opciones_votacion (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.actividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id uuid NOT NULL REFERENCES public.viajes (id) ON DELETE CASCADE,
  titulo text NOT NULL CHECK (char_length(btrim(titulo)) BETWEEN 1 AND 200),
  descripcion text,
  fecha date NOT NULL,
  hora_inicio time,
  hora_fin time,
  orden int NOT NULL DEFAULT 0,
  ubicacion_nombre text,
  latitud numeric(9,6) CHECK (latitud BETWEEN -90 AND 90),
  longitud numeric(9,6) CHECK (longitud BETWEEN -180 AND 180),
  lugar_externo_id text,
  categoria text,
  creado_por uuid REFERENCES public.perfiles (id) ON DELETE SET NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT actividades_horas_validas CHECK (hora_fin IS NULL OR hora_inicio IS NULL OR hora_fin >= hora_inicio)
);

CREATE OR REPLACE FUNCTION public.marcar_actualizado_en()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS actividades_actualizado_en ON public.actividades;
CREATE TRIGGER actividades_actualizado_en
  BEFORE UPDATE ON public.actividades
  FOR EACH ROW EXECUTE FUNCTION public.marcar_actualizado_en();

-- 3. ÍNDICES
CREATE INDEX IF NOT EXISTS miembros_viaje_usuario_idx ON public.miembros_viaje (usuario_id);
CREATE INDEX IF NOT EXISTS votaciones_viaje_idx ON public.votaciones (viaje_id);
-- Un viaje tiene como mucho una votación de destino
CREATE UNIQUE INDEX IF NOT EXISTS votaciones_destino_unica_idx ON public.votaciones (viaje_id) WHERE tipo = 'destino';
-- No se repite una opción dentro de la misma votación (sin distinguir mayúsculas ni espacios)
CREATE UNIQUE INDEX IF NOT EXISTS opciones_votacion_texto_unico_idx ON public.opciones_votacion (votacion_id, lower(btrim(texto)));
CREATE INDEX IF NOT EXISTS votos_opcion_idx ON public.votos (opcion_id);
CREATE INDEX IF NOT EXISTS actividades_viaje_fecha_idx ON public.actividades (viaje_id, fecha);
