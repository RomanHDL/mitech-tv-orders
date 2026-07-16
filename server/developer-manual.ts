// Developer Manual (gate check #10) — definición autoritativa del modelo de
// datos: tablas, columnas, relaciones, enums y reglas de negocio. Mandato
// del stack: "Schema changes MUST update the Developer Manual in the same
// commit" — este archivo se actualiza junto con shared/schema.ts, no aparte.
// Se sirve en dos capas: HTML/Markdown legible (GET /developer-manual,
// /developer-manual.md) y diccionario estructurado para agentes
// (GET /api/developer-manual.json).

export type ColumnaManual = {
  nombre: string
  tipo: string
  notas?: string
}

export type TablaManual = {
  nombre: string
  descripcion: string
  columnas: ColumnaManual[]
  relaciones?: string[]
  reglas?: string[]
}

export const DEVELOPER_MANUAL: { modulo: string; tablas: TablaManual[] }[] = [
  {
    modulo: 'Auth e identidad',
    tablas: [
      {
        nombre: 'usuarios',
        descripcion: 'Identidad híbrida: admin/capturista entran por Nextcloud OIDC, surtidor por NFC/PIN.',
        columnas: [
          { nombre: 'id', tipo: 'uuid PK' },
          { nombre: 'email', tipo: 'text NULL, único', notas: 'Requerido para admin/capturista (identidad OIDC); opcional para surtidor. Se canoniza (@mitechnologiesinc.com ≡ @miglobal.com.mx) antes de comparar — ver server/auth/canonical.ts.' },
          { nombre: 'nombre', tipo: 'text NOT NULL' },
          { nombre: 'rol', tipo: "enum('admin','capturista','surtidor') NOT NULL" },
          { nombre: 'oidc_sub', tipo: 'text NULL', notas: 'Subject claim de Nextcloud; se completa solo en el primer login OIDC exitoso.' },
          { nombre: 'nfc_uid', tipo: 'text NULL, único', notas: 'Serial de hardware del tag NFC (event.serialNumber), no contenido escrito en el tag.' },
          { nombre: 'pin_hash', tipo: 'text NULL', notas: 'bcrypt. Solo debe existir para rol=surtidor — reforzado en server/routes/usuarios.ts, no a nivel de columna.' },
          { nombre: 'creado', tipo: 'timestamptz NOT NULL default now()' },
        ],
        reglas: [
          'admin/capturista: email obligatorio, pin_hash y nfc_uid deben ser NULL (entran solo por OIDC).',
          'surtidor: al menos uno de pin_hash / nfc_uid debe existir; email es opcional.',
          'Índices únicos en email y nfc_uid permiten múltiples NULL sin choque (comportamiento estándar de Postgres).',
        ],
      },
    ],
  },
  {
    modulo: 'Pedidos',
    tablas: [
      {
        nombre: 'pedidos',
        descripcion: 'Cabecera de un pedido de televisiones a capturar/surtir/imprimir.',
        columnas: [
          { nombre: 'id', tipo: 'uuid PK' },
          { nombre: 'numero_pedido', tipo: 'text NOT NULL' },
          { nombre: 'pedido_nombre', tipo: 'text NOT NULL', notas: 'Usado para agrupar en /historial (case-insensitive, trim).' },
          { nombre: 'condiciones', tipo: 'text[] NOT NULL default {}', notas: 'Subconjunto de CONDICIONES (shared/schema.ts) — catálogo cerrado, no tabla.' },
          { nombre: 'cantidad_total', tipo: 'integer NULL', notas: 'Cupo del pedido. NULL = sin límite (se infiere de la suma de televisiones).' },
          { nombre: 'fecha', tipo: 'timestamptz NOT NULL default now()' },
          { nombre: 'fecha_limite', tipo: 'date NOT NULL' },
          { nombre: 'comentarios', tipo: 'text NULL', notas: 'Máx 2000 caracteres (aplicado en server/routes/pedidos.ts, no en columna).' },
          { nombre: 'comentarios_actualizado', tipo: 'timestamptz NULL' },
          { nombre: 'comentarios_actualizado_por', tipo: 'uuid NULL FK → usuarios.id' },
          { nombre: 'comentarios_actualizado_por_nombre', tipo: 'text NULL', notas: 'Denormalizado a propósito — evita join solo para mostrar el nombre.' },
          { nombre: 'creado_por', tipo: 'uuid NULL FK → usuarios.id', notas: 'Dueño del pedido. Determina qué ve un capturista en /surtir y /historial (no en /pedidos, que es sin filtro).' },
          { nombre: 'creado_por_nombre', tipo: 'text NULL', notas: 'Denormalizado.' },
          { nombre: 'creado_por_rol', tipo: 'text NULL', notas: 'Denormalizado — rol del creador al momento de crear el pedido.' },
        ],
        relaciones: ['1:N con pedido_televisiones (onDelete cascade)'],
        reglas: [
          'GET /api/pedidos (sin filtro): admin y capturista ven todos los pedidos.',
          'GET /api/surtir (cola de surtido + historial): capturista ve solo donde creado_por = su id; admin y surtidor ven todos.',
          'Reasignar dueño: PATCH /api/pedidos/:id/dueno, solo admin.',
        ],
      },
      {
        nombre: 'pedido_televisiones',
        descripcion: 'Línea de TV dentro de un pedido — antes era un array embebido en Mongo, ahora tabla normalizada.',
        columnas: [
          { nombre: 'id', tipo: 'uuid PK' },
          { nombre: 'pedido_id', tipo: 'uuid NOT NULL FK → pedidos.id ON DELETE CASCADE' },
          { nombre: 'orden', tipo: 'integer NOT NULL', notas: 'Preserva el índice original del array (usado por el módulo de surtido para exponer un orden estable).' },
          { nombre: 'marca', tipo: 'text NOT NULL', notas: 'Debe pertenecer a MARCAS (catálogo cerrado en shared/schema.ts).' },
          { nombre: 'pulgadas', tipo: 'integer NOT NULL', notas: 'Debe pertenecer a PULGADAS.' },
          { nombre: 'modelo', tipo: 'text NOT NULL', notas: 'SKU. Regex 3-20 alfanuméricos, mayúsculas (SKU_REGEX).' },
          { nombre: 'modelos_alternativos', tipo: 'text[] NOT NULL default {}', notas: 'SKUs intercambiables — cualquiera de ellos sirve para esta misma línea.' },
          { nombre: 'cantidad', tipo: 'integer NOT NULL default 0', notas: '0 cuando sin_limite=true.' },
          { nombre: 'unidad', tipo: "enum('pieza','pallet') NOT NULL default 'pieza'" },
          { nombre: 'sin_limite', tipo: 'boolean NOT NULL default false', notas: 'Línea abierta — cubre la diferencia hasta cantidad_total del pedido, no aporta cantidad fija.' },
          { nombre: 'cantidad_surtida', tipo: 'integer NOT NULL default 0', notas: 'Avance de picking. Nunca debe exceder `cantidad` salvo sin_limite=true (validado en el PATCH, no en columna).' },
        ],
        reglas: [
          'PUT /api/pedidos/:id (edición completa): preserva cantidad_surtida cuando una línea nueva coincide en (marca, pulgadas, modelo, unidad) con una existente.',
          'PATCH /api/pedidos/:id/televisiones/:tvId: actualiza solo cantidad_surtida. admin: cualquier pedido; capturista: solo el suyo (creado_por); surtidor: cualquiera.',
        ],
      },
    ],
  },
  {
    modulo: 'Catálogos administrables',
    tablas: [
      {
        nombre: 'catalogo_onn',
        descripcion: 'Mapa modelo→pulgadas para autollenar SKUs de la marca ONN al importar (su modelo no trae el tamaño codificado).',
        columnas: [
          { nombre: 'id', tipo: 'uuid PK' },
          { nombre: 'modelo', tipo: 'text NOT NULL, único' },
          { nombre: 'pulgadas', tipo: 'integer NOT NULL' },
          { nombre: 'actualizado', tipo: 'timestamptz NOT NULL default now()' },
        ],
        reglas: ['Lectura: admin + capturista. Escritura (POST/PATCH/DELETE): solo admin.'],
      },
    ],
  },
  {
    modulo: 'Documentación (User Manual — gate #11)',
    tablas: [
      {
        nombre: 'documentation_categories',
        descripcion: 'Categorías del manual de usuario, jerárquicas por `orden`, bilingües.',
        columnas: [
          { nombre: 'id', tipo: 'uuid PK' },
          { nombre: 'slug', tipo: 'text NOT NULL, único' },
          { nombre: 'nombre_es', tipo: 'text NOT NULL' },
          { nombre: 'nombre_en', tipo: 'text NOT NULL' },
          { nombre: 'orden', tipo: 'integer NOT NULL default 0' },
          { nombre: 'rol_minimo', tipo: 'enum NULL', notas: 'NULL = visible a cualquier rol logueado. Si se define, solo ese rol (no jerárquico) la ve.' },
        ],
      },
      {
        nombre: 'documentation_pages',
        descripcion: 'Páginas del manual, bilingües (columnas *_es/*_en en vez de filas separadas por idioma).',
        columnas: [
          { nombre: 'id', tipo: 'uuid PK' },
          { nombre: 'categoria_id', tipo: 'uuid NOT NULL FK → documentation_categories.id ON DELETE CASCADE' },
          { nombre: 'slug', tipo: 'text NOT NULL', notas: 'Único junto con categoria_id.' },
          { nombre: 'titulo_es / titulo_en', tipo: 'text NOT NULL' },
          { nombre: 'contenido_es / contenido_en', tipo: 'text NOT NULL', notas: 'Texto plano/Markdown simple — sin editor WYSIWYG (fuera de alcance de esta fase).' },
          { nombre: 'orden', tipo: 'integer NOT NULL default 0' },
          { nombre: 'actualizado', tipo: 'timestamptz NOT NULL default now()' },
        ],
        reglas: ['Búsqueda: ILIKE sobre titulo_es/titulo_en/contenido_es/contenido_en (no tsvector — decisión de alcance).'],
      },
    ],
  },
  {
    modulo: 'Changelog (gate #12)',
    tablas: [
      {
        nombre: 'changelog_entries',
        descripcion: 'Una fila por versión publicada (semver).',
        columnas: [
          { nombre: 'id', tipo: 'uuid PK' },
          { nombre: 'version', tipo: 'text NOT NULL, único', notas: 'Formato x.y.z.' },
          { nombre: 'titulo_es / titulo_en', tipo: 'text NOT NULL' },
          { nombre: 'categoria', tipo: "enum('feature','improvement','bugfix','security') NOT NULL" },
          { nombre: 'prioridad', tipo: "enum('critical','high','normal','low') NOT NULL" },
          { nombre: 'publicado_en', tipo: 'timestamptz NOT NULL default now()' },
        ],
      },
      {
        nombre: 'changelog_items',
        descripcion: 'Bullets bilingües bajo una entrada.',
        columnas: [
          { nombre: 'id', tipo: 'uuid PK' },
          { nombre: 'entry_id', tipo: 'uuid NOT NULL FK → changelog_entries.id ON DELETE CASCADE' },
          { nombre: 'orden', tipo: 'integer NOT NULL default 0' },
          { nombre: 'texto_es / texto_en', tipo: 'text NOT NULL' },
        ],
      },
      {
        nombre: 'changelog_dismissals',
        descripcion: 'Qué usuario ya cerró el modal "novedades" de qué versión.',
        columnas: [
          { nombre: 'id', tipo: 'uuid PK' },
          { nombre: 'entry_id', tipo: 'uuid NOT NULL FK → changelog_entries.id ON DELETE CASCADE' },
          { nombre: 'usuario_id', tipo: 'uuid NOT NULL FK → usuarios.id ON DELETE CASCADE' },
          { nombre: 'descartado_en', tipo: 'timestamptz NOT NULL default now()' },
        ],
        reglas: ['Único (entry_id, usuario_id) — un usuario descarta cada versión una sola vez.'],
      },
    ],
  },
  {
    modulo: 'Infraestructura',
    tablas: [
      {
        nombre: 'session',
        descripcion: 'Sesión de Express (connect-pg-simple). Creada automáticamente por la librería, no por Drizzle.',
        columnas: [
          { nombre: 'sid', tipo: 'varchar PK' },
          { nombre: 'sess', tipo: 'json NOT NULL', notas: 'Incluye passport.user = usuarios.id.' },
          { nombre: 'expire', tipo: 'timestamp NOT NULL' },
        ],
      },
    ],
  },
]

export function toMarkdown(): string {
  const lines: string[] = ['# Developer Manual — mitech-tv-orders', '']
  lines.push('> Fuente de verdad: `shared/schema.ts`. Cualquier cambio de esquema debe actualizar `server/developer-manual.ts` en el mismo commit.', '')
  for (const { modulo, tablas } of DEVELOPER_MANUAL) {
    lines.push(`## ${modulo}`, '')
    for (const t of tablas) {
      lines.push(`### \`${t.nombre}\``, '', t.descripcion, '')
      lines.push('| Columna | Tipo | Notas |', '|---|---|---|')
      for (const c of t.columnas) {
        lines.push(`| \`${c.nombre}\` | ${c.tipo} | ${c.notas || ''} |`)
      }
      lines.push('')
      if (t.relaciones?.length) {
        lines.push('**Relaciones:**')
        for (const r of t.relaciones) lines.push(`- ${r}`)
        lines.push('')
      }
      if (t.reglas?.length) {
        lines.push('**Reglas de negocio:**')
        for (const r of t.reglas) lines.push(`- ${r}`)
        lines.push('')
      }
    }
  }
  return lines.join('\n')
}
