'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconClipboardList, IconPencil, IconPlus, IconTrash } from '../../components/icons'
import { MODULOS, sanearModulos } from '@/lib/modulos'

const ROL_LABEL = { admin: 'Admin', capturista: 'Capturista', surtidor: 'Surtidor' }

function FilaModulos({ usuario }) {
  const { t } = useTranslation()
  const [abierto, setAbierto] = useState(false)
  const modsUsuario = sanearModulos(usuario.allowedModules)
  const modsOrdenados = MODULOS.filter((m) => modsUsuario.includes(m.id))
  const visibles = modsOrdenados.slice(0, 3)
  const restantes = modsOrdenados.slice(3)

  useEffect(() => {
    if (!abierto) return
    const cerrar = () => setAbierto(false)
    document.addEventListener('mousedown', cerrar)
    document.addEventListener('keydown', cerrar)
    return () => {
      document.removeEventListener('mousedown', cerrar)
      document.removeEventListener('keydown', cerrar)
    }
  }, [abierto])

  if (modsOrdenados.length === 0) return <span className="tag-empty">—</span>

  return (
    <div className="tags-celda modulos-celda-wrap">
      {visibles.map((m) => (
        <span key={m.id} className="tag tag-modulo">{t(m.labelKey)}</span>
      ))}
      {restantes.length > 0 && (
        <div className="modulos-mas-wrap">
          <button
            type="button"
            className="tag tag-mas"
            title={restantes.map((m) => t(m.labelKey)).join(', ')}
            aria-label={`${restantes.length} módulos más: ${restantes.map((m) => t(m.labelKey)).join(', ')}`}
            onClick={(e) => { e.stopPropagation(); setAbierto((v) => !v) }}
            aria-expanded={abierto}
          >
            +{restantes.length}
          </button>
          {abierto && (
            <div className="modulos-tooltip" onMouseDown={(e) => e.stopPropagation()}>
              {restantes.map((m) => (
                <span key={m.id} className="modulos-tooltip-item">{t(m.labelKey)}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function UsuariosTabla({
  usuariosPagina,
  totalFiltrado,
  totalUsuarios,
  pagina,
  totalPaginas,
  porPagina,
  onPaginaChange,
  onEditar,
  onEliminarClick,
  eliminandoId,
  onAgregarClick,
  onLimpiarFiltros,
  hayFiltrosActivos,
}) {
  const { t } = useTranslation()
  const desde = totalFiltrado === 0 ? 0 : (pagina - 1) * porPagina + 1
  const hasta = Math.min(pagina * porPagina, totalFiltrado)

  return (
    <div className="card usuarios-tabla-card">
      <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>
        {t('usuarios.usuariosRegistrados', { n: totalUsuarios })}
      </h2>

      {totalFiltrado === 0 ? (
        <div className="empty">
          <IconClipboardList width={40} height={40} />
          {hayFiltrosActivos ? (
            <>
              <h3>{t('usuarios.emptyFiltradoTitulo')}</h3>
              <p>{t('usuarios.emptyFiltradoTexto')}</p>
              <button type="button" className="btn btn-secondary" onClick={onLimpiarFiltros}>
                {t('usuarios.limpiarFiltros')}
              </button>
            </>
          ) : (
            <>
              <h3>{t('usuarios.emptyTitulo')}</h3>
              <p>{t('usuarios.emptyTexto')}</p>
              <button type="button" className="btn btn-primary" onClick={onAgregarClick}>
                <IconPlus /> {t('usuarios.agregarUsuario')}
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="tabla-wrap">
            <table className="tabla-pedidos">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Email</th>
                  <th>Login</th>
                  <th>{t('usuarios.modulosAccesos')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {usuariosPagina.map((u) => (
                  <tr key={u.id}>
                    <td data-label="Nombre">
                      <strong>{u.nombre || '—'}</strong>
                    </td>
                    <td data-label="Rol">
                      <span className={`nav-rol-badge rol-${u.rol}`}>{ROL_LABEL[u.rol] || u.rol}</span>
                    </td>
                    <td data-label="Email">
                      {u.email
                        ? <span className="celda-email-texto" title={u.email}>{u.email}</span>
                        : <span className="tag-empty">—</span>}
                    </td>
                    <td data-label="Login">
                      <div className="tags-celda">
                        {u.tienePin && <span className="tag tag-grb">PIN</span>}
                        {u.tieneNfc && <span className="tag tag-gra">NFC</span>}
                        {!u.tienePin && !u.tieneNfc && <span className="tag-empty">—</span>}
                      </div>
                    </td>
                    <td data-label={t('usuarios.modulosAccesos')}>
                      <FilaModulos usuario={u} />
                    </td>
                    <td>
                      <div className="acciones acciones-compactas">
                        <button
                          type="button"
                          onClick={() => onEditar(u)}
                          className="btn-icono btn-icono-editar"
                          aria-label={`${t('common.editar')} ${u.nombre || u.email || ''}`}
                          title={t('common.editar')}
                        >
                          <IconPencil />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEliminarClick(u)}
                          disabled={eliminandoId === u.id}
                          className="btn-icono btn-icono-eliminar"
                          aria-label={`${t('common.eliminar')} ${u.nombre || u.email || ''}`}
                          title={t('common.eliminar')}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="paginacion">
              <div className="paginacion-botones">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onPaginaChange(pagina - 1)}
                  disabled={pagina <= 1}
                >
                  {t('pedidos.anterior')}
                </button>
                <span className="paginacion-actual">{t('pedidos.pagina', { actual: pagina, total: totalPaginas })}</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onPaginaChange(pagina + 1)}
                  disabled={pagina >= totalPaginas}
                >
                  {t('pedidos.siguiente')}
                </button>
              </div>
              <span className="paginacion-info">
                Mostrando {desde} a {hasta} de {totalFiltrado} usuarios
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
