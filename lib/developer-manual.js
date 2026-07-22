// Developer Manual — documentación técnica del modelo de datos real de esta
// app (MongoDB). Objeto estático mantenido a mano: si cambia el esquema de
// una colección, actualizar aquí en el mismo commit (igual convención que el
// MI Stack). Fuente de verdad autoritativa sobre lib/mongodb.js y los
// route handlers de app/api/**.
export const DEVELOPER_MANUAL = {
  generadoEn: '2026-07-20',
  stack: 'Next.js 15 + MongoDB (driver oficial, sin ORM)',
  colecciones: [
    {
      nombre: 'pedidos',
      descripcion: 'Un pedido de televisiones con sus partidas embebidas.',
      campos: [
        { campo: 'numeroPedido', tipo: 'string', notas: 'Folio libre, requerido' },
        { campo: 'pedidoNombre', tipo: 'string', notas: 'Nombre libre, requerido' },
        { campo: 'condiciones', tipo: 'string[]', notas: 'Tag general del pedido, subset de CONDICIONES (lib/catalogos.js)' },
        { campo: 'cantidadTotal', tipo: 'number | null', notas: 'Cupo opcional a nivel pedido' },
        { campo: 'televisiones', tipo: 'array embebido', notas: 'Ver colección lógica "pedido_televisiones" abajo' },
        { campo: 'fecha', tipo: 'Date', notas: 'Creación, automática' },
        { campo: 'fechaLimite', tipo: 'string YYYY-MM-DD', notas: 'Requerida' },
        { campo: 'creadoPor / creadoPorNombre / creadoPorRol', tipo: 'string | null', notas: 'Dueño del pedido' },
        { campo: 'comentarios', tipo: 'string', notas: 'Notas del envío, máx 2000 chars' },
        { campo: 'comentariosActualizado(Por/PorNombre)', tipo: 'Date/string', notas: 'Auditoría del último comentario' },
      ],
      reglas: [
        'Un TV con sinLimite=true guarda cantidad=0 (el cupo lo lleva cantidadTotal).',
        'El emparejamiento al editar (PUT) que preserva cantidadSurtida usa marca+pulgadas+modelo+unidad+condiciones como clave (condiciones comparadas como conjunto, sin importar el orden) — dos partidas del mismo SKU con un conjunto de condiciones distinto son líneas independientes.',
      ],
    },
    {
      nombre: 'pedidos.televisiones (embebido)',
      descripcion: 'Cada partida/línea de un pedido.',
      campos: [
        { campo: 'marca', tipo: 'string', notas: 'Subset de MARCAS' },
        { campo: 'pulgadas', tipo: 'number', notas: 'Subset de PULGADAS' },
        { campo: 'condiciones', tipo: 'string[]', notas: 'Una o varias condiciones por partida (ej. la misma SKU puede aceptar GRA y GRB) — subset de CONDICIONES, mismo catálogo unificado que pedidos.condiciones' },
        { campo: 'modelo', tipo: 'string', notas: 'SKU, 3-20 alfanumérico, uppercase' },
        { campo: 'modelosAlternativos', tipo: 'string[]', notas: 'SKUs alternativos válidos para la misma partida' },
        { campo: 'cantidad', tipo: 'number', notas: '0 si sinLimite=true' },
        { campo: 'unidad', tipo: "'pieza' | 'pallet'", notas: '—' },
        { campo: 'sinLimite', tipo: 'boolean', notas: 'Cubre la diferencia hasta cantidadTotal' },
        { campo: 'cantidadSurtida', tipo: 'number', notas: 'Progreso de surtido' },
      ],
      reglas: [],
    },
    {
      nombre: 'usuarios',
      descripcion: 'Cuentas de acceso (admin/capturista/surtidor).',
      campos: [
        { campo: 'email', tipo: 'string | null' },
        { campo: 'pin', tipo: 'string | null', notas: 'Mín. 6 dígitos (texto plano — ver nota de seguridad)' },
        { campo: 'nfcUid', tipo: 'string | null', notas: 'UID físico del tag NFC' },
        { campo: 'rol', tipo: "'admin' | 'capturista' | 'surtidor'" },
        { campo: 'nombre', tipo: 'string' },
        { campo: 'creado', tipo: 'Date' },
      ],
      reglas: ['Login por NFC UID, email+PIN, o solo PIN si es único en el sistema.'],
    },
    {
      nombre: 'catalogo_onn',
      descripcion: 'Mapeo modelo ONN → pulgadas, usado para autollenar el import en lote.',
      campos: [
        { campo: 'modelo', tipo: 'string', notas: 'Único' },
        { campo: 'pulgadas', tipo: 'number' },
        { campo: 'actualizado', tipo: 'Date' },
      ],
      reglas: [],
    },
    {
      nombre: 'changelog_entries',
      descripcion: 'Versiones publicadas de la app, mostradas en /changelog y el modal de novedades.',
      campos: [
        { campo: 'version', tipo: 'string semver x.y.z', notas: 'Único' },
        { campo: 'titulo', tipo: 'string' },
        { campo: 'categoria', tipo: "'feature'|'improvement'|'bugfix'|'security'" },
        { campo: 'prioridad', tipo: "'critical'|'high'|'normal'|'low'" },
        { campo: 'items', tipo: 'string[]', notas: 'Detalles, uno por línea' },
        { campo: 'publicadoEn', tipo: 'Date' },
      ],
      reglas: [],
    },
    {
      nombre: 'changelog_dismissals',
      descripcion: 'Qué usuario ya cerró el modal de novedades de qué entrada (no se re-muestra).',
      campos: [
        { campo: 'entryId', tipo: 'string (ObjectId de changelog_entries)' },
        { campo: 'usuarioId', tipo: 'string (userId de la cookie)' },
        { campo: 'descartadoEn', tipo: 'Date' },
      ],
      reglas: ['Único lógico por (entryId, usuarioId) — se hace upsert, nunca duplicados.'],
    },
    {
      nombre: 'documentation_categories / documentation_pages',
      descripcion: 'User Manual (/manual): categorías y páginas de ayuda para el usuario final.',
      campos: [
        { campo: 'documentation_categories.slug', tipo: 'string', notas: 'Único' },
        { campo: 'documentation_categories.nombre / orden', tipo: 'string / number' },
        { campo: 'documentation_pages.categoriaId', tipo: 'string (ObjectId)' },
        { campo: 'documentation_pages.slug / titulo / contenido / orden', tipo: 'string / string / string / number' },
      ],
      reglas: ['Slug único por categoría (categoriaId + slug).'],
    },
  ],
}

export function developerManualToMarkdown() {
  const lineas = [`# Developer Manual — mitech-tv-orders`, '', `_Generado: ${DEVELOPER_MANUAL.generadoEn}_`, '', `Stack: ${DEVELOPER_MANUAL.stack}`, '']
  for (const col of DEVELOPER_MANUAL.colecciones) {
    lineas.push(`## ${col.nombre}`, '', col.descripcion, '')
    lineas.push('| Campo | Tipo | Notas |', '|---|---|---|')
    for (const c of col.campos) {
      lineas.push(`| ${c.campo} | ${c.tipo} | ${c.notas || ''} |`)
    }
    if (col.reglas?.length) {
      lineas.push('', '**Reglas:**')
      for (const r of col.reglas) lineas.push(`- ${r}`)
    }
    lineas.push('')
  }
  return lineas.join('\n')
}
