'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconAlert, IconPlus, IconTrash } from '../../components/icons'

export default function AdminManualCliente() {
  const { t } = useTranslation()
  const [categorias, setCategorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [catSlug, setCatSlug] = useState('')
  const [catNombre, setCatNombre] = useState('')
  const [catRolMinimo, setCatRolMinimo] = useState('')
  const [enviandoCat, setEnviandoCat] = useState(false)

  const [pagCategoriaId, setPagCategoriaId] = useState('')
  const [pagSlug, setPagSlug] = useState('')
  const [pagTitulo, setPagTitulo] = useState('')
  const [pagContenido, setPagContenido] = useState('')
  const [enviandoPag, setEnviandoPag] = useState(false)

  const cargar = async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/documentation/categories')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('manualAdmin.errorCargar'))
      setCategorias(data.categorias || [])
      if (!pagCategoriaId && data.categorias?.[0]) setPagCategoriaId(data.categorias[0].id)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const crearCategoria = async (e) => {
    e.preventDefault()
    setError('')
    setEnviandoCat(true)
    try {
      const res = await fetch('/api/admin/documentation/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: catSlug, nombre: catNombre, rolMinimo: catRolMinimo || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('manualAdmin.errorGuardar'))
      setCatSlug('')
      setCatNombre('')
      setCatRolMinimo('')
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviandoCat(false)
    }
  }

  const eliminarCategoria = async (id, nombre) => {
    if (!confirm(t('manualAdmin.confirmarEliminarCategoria', { nombre }))) return
    try {
      await fetch(`/api/admin/documentation/categories/${id}`, { method: 'DELETE' })
      await cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  const crearPagina = async (e) => {
    e.preventDefault()
    setError('')
    if (!pagCategoriaId) return setError(t('manualAdmin.errorPrimeroCategoria'))
    setEnviandoPag(true)
    try {
      const res = await fetch('/api/admin/documentation/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoriaId: pagCategoriaId, slug: pagSlug, titulo: pagTitulo, contenido: pagContenido }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('manualAdmin.errorGuardar'))
      setPagSlug('')
      setPagTitulo('')
      setPagContenido('')
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviandoPag(false)
    }
  }

  const eliminarPagina = async (id, titulo) => {
    if (!confirm(t('manualAdmin.confirmarEliminarPagina', { titulo }))) return
    try {
      await fetch(`/api/admin/documentation/pages/${id}`, { method: 'DELETE' })
      await cargar()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="usuarios-grid">
      <div className="card">
        <div className="section-header"><h2>{t('manualAdmin.nuevaCategoria')}</h2></div>
        <form onSubmit={crearCategoria}>
          <div className="section">
            <label className="label" htmlFor="cat-slug">{t('manualAdmin.slugLabel')}</label>
            <input id="cat-slug" type="text" value={catSlug} onChange={(e) => setCatSlug(e.target.value)} placeholder={t('manualAdmin.slugPlaceholderCategoria')} required />
          </div>
          <div className="section">
            <label className="label" htmlFor="cat-nombre">{t('manualAdmin.nombreLabel')}</label>
            <input id="cat-nombre" type="text" value={catNombre} onChange={(e) => setCatNombre(e.target.value)} placeholder={t('manualAdmin.nombrePlaceholderCategoria')} required />
          </div>
          <div className="section">
            <label className="label" htmlFor="cat-rol">{t('manualAdmin.rolMinimoLabel')} <span className="label-help">{t('manualAdmin.rolMinimoHelp')}</span></label>
            <select id="cat-rol" value={catRolMinimo} onChange={(e) => setCatRolMinimo(e.target.value)}>
              <option value="">{t('manualAdmin.cualquierRol')}</option>
              <option value="admin">{t('manualAdmin.soloAdmin')}</option>
              <option value="capturista">{t('manualAdmin.capturistaPlus')}</option>
              <option value="surtidor">{t('manualAdmin.surtidorPlus')}</option>
            </select>
          </div>
          <button type="submit" disabled={enviandoCat} className="btn btn-primary btn-large">
            <IconPlus />
            {enviandoCat ? t('manualAdmin.guardando') : t('manualAdmin.crearCategoria')}
          </button>
        </form>

        <div className="section-header" style={{ marginTop: '2rem' }}><h2>{t('manualAdmin.nuevaPagina')}</h2></div>
        <form onSubmit={crearPagina}>
          <div className="section">
            <label className="label" htmlFor="pag-cat">{t('manualAdmin.categoriaLabel')}</label>
            <select id="pag-cat" value={pagCategoriaId} onChange={(e) => setPagCategoriaId(e.target.value)} required>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="section">
            <label className="label" htmlFor="pag-slug">{t('manualAdmin.slugLabel')}</label>
            <input id="pag-slug" type="text" value={pagSlug} onChange={(e) => setPagSlug(e.target.value)} placeholder={t('manualAdmin.slugPlaceholderPagina')} required />
          </div>
          <div className="section">
            <label className="label" htmlFor="pag-titulo">{t('manualAdmin.tituloLabel')}</label>
            <input id="pag-titulo" type="text" value={pagTitulo} onChange={(e) => setPagTitulo(e.target.value)} placeholder={t('manualAdmin.tituloPlaceholderPagina')} required />
          </div>
          <div className="section">
            <label className="label" htmlFor="pag-contenido">{t('manualAdmin.contenidoLabel')}</label>
            <textarea id="pag-contenido" rows={6} value={pagContenido} onChange={(e) => setPagContenido(e.target.value)} placeholder={t('manualAdmin.contenidoPlaceholder')} />
          </div>

          {error && (
            <div className="alerta alerta-error">
              <IconAlert />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={enviandoPag} className="btn btn-primary btn-large">
            <IconPlus />
            {enviandoPag ? t('manualAdmin.guardando') : t('manualAdmin.crearPagina')}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="section-header"><h2>{t('manualAdmin.contenidoActual')}</h2></div>
        {cargando ? (
          <p>{t('manualAdmin.cargando')}</p>
        ) : categorias.length === 0 ? (
          <div className="empty"><p>{t('manualAdmin.sinCategorias')}</p></div>
        ) : (
          categorias.map((c) => (
            <div key={c.id} className="manual-admin-categoria">
              <div className="manual-admin-categoria-header">
                <strong>{c.nombre}</strong>
                {c.rolMinimo && <span className="tag">{c.rolMinimo}+</span>}
                <button type="button" onClick={() => eliminarCategoria(c.id, c.nombre)} className="btn btn-danger btn-sm">
                  <IconTrash /> {t('manualAdmin.eliminarCategoria')}
                </button>
              </div>
              {c.paginas.length === 0 ? (
                <p className="manual-vacio">{t('manualAdmin.sinPaginas')}</p>
              ) : (
                <ul className="manual-admin-paginas">
                  {c.paginas.map((p) => (
                    <li key={p.id}>
                      {p.titulo}
                      <button type="button" onClick={() => eliminarPagina(p.id, p.titulo)} className="link-eliminar">
                        {t('common.eliminar')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
