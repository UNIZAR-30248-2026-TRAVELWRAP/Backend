CREATE TYPE public.estado_viaje AS ENUM ('activo', 'finalizado', 'archivado');
CREATE TYPE public.rol_miembro AS ENUM ('creador', 'miembro');

CREATE TABLE public.perfiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  nombre text NOT NULL,
  email text,
  avatar_url text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.viajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creador_id uuid REFERENCES public.perfiles (id) ON DELETE SET NULL,
  nombre text NOT NULL,
  destino text NOT NULL,
  descripcion text,
  fecha_inicio date,
  fecha_fin date,
  imagen_portada_url text,
  moneda char(3) NOT NULL DEFAULT 'EUR',
  estado public.estado_viaje NOT NULL DEFAULT 'activo',
  finalizado_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT viajes_fechas_validas CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TABLE public.miembros_viaje (
  viaje_id uuid NOT NULL REFERENCES public.viajes (id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.perfiles (id) ON DELETE CASCADE,
  rol public.rol_miembro NOT NULL DEFAULT 'miembro',
  unido_en timestamptz NOT NULL DEFAULT now(),
  abandonado_en timestamptz,
  PRIMARY KEY (viaje_id, usuario_id)
);

CREATE INDEX miembros_viaje_usuario_idx ON public.miembros_viaje (usuario_id);
