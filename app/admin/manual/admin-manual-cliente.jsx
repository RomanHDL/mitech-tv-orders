'use client'

import { useEffect, useState } from 'react'
import { IconAlert, IconPlus, IconTrash } from '../../components/icons'

export default function AdminManualCliente() {
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
      if (!res.ok) throw new Error(data.error || 'Error al cargar')
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
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
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
    if (!confirm(`¿Eliminar la categoría "${nombre}" y todas sus páginas? Esta acción no se puede deshacer.`)) return
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
    if (!pagCategoriaId) return setError('Primero crea una categoría')
    setEnviandoPag(true)
    try {
      const res = await fetch('/api/admin/documentation/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoriaId: pagCategoriaId, slug: pagSlug, titulo: pagTitulo, contenido: pagContenido }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
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
    if (!confirm(`¿Eliminar la página "${titulo}"? Esta acción no se puede deshacer.`)) return
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
        <div className="section-header"><h2>Nueva categoría</h2></div>
        <form onSubmit={crearCategoria}>
          <div className="section">
            <label className="label" htmlFor="cat-slug">Slug</label>
            <input id="cat-slug" type="text" value={catSlug} onChange={(e) => setCatSlug(e.target.value)} placeholder="ej. primeros-pasos" required />
          </div>
          <div className="section">
            <label className="label" htmlFor="cat-nombre">Nombre</label>
            <input id="cat-nombre" type="text" value={catNombre} onChange={(e) => setCatNombre(e.target.value)} placeholder="Ej. Primeros pasos" required />
          </div>
          <div className="section">
            <label className="label" htmlFor="cat-rol">Rol mínimo <span className="label-help">(vacío = todos)</span></label>
            <select id="cat-rol" value={catRolMinimo} onChange={(e) => setCatRolMinimo(e.target.value)}>
              <option value="">Cualquier rol</option>
              <option value="admin">Solo admin</option>
              <option value="capturista">Capturista+</option>
              <option value="surtidor">Surtidor+</option>
            </select>
          </div>
          <button type="submit" disabled={enviandoCat} className="btn btn-primary btn-large">
            <IconPlus />
            {enviandoCat ? 'Guardando…' : 'Crear categoría'}
          </button>
        </form>

        <div className="section-header" style={{ marginTop: '2rem' }}><h2>Nueva página</h2></div>
        <form onSubmit={crearPagina}>
          <div className="section">
            <label className="label" htmlFor="pag-cat">Categoría</label>
            <select id="pag-cat" value={pagCategoriaId} onChange={(e) => setPagCategoriaId(e.target.value)} required>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="section">
            <label className="label" htmlFor="pag-slug">Slug</label>
            <input id="pag-slug" type="text" value={pagSlug} onChange={(e) => setPagSlug(e.target.value)} placeholder="ej. como-crear-un-pedido" required />
          </div>
          <div className="section">
            <label className="label" htmlFor="pag-titulo">Título</label>
            <input id="pag-titulo" type="text" value={pagTitulo} onChange={(e) => setPagTitulo(e.target.value)} placeholder="Ej. Cómo crear un pedido" required />
          </div>
          <div className="section">
            <label className="label" htmlFor="pag-contenido">Contenido</label>
            <textarea id="pag-contenido" rows={6} value={pagContenido} onChange={(e) => setPagContenido(e.target.value)} placeholder="Texto de la página…" />
          </div>

          {error && (
            <div className="alerta alerta-error">
              <IconAlert />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={enviandoPag} className="btn btn-primary btn-large">
            <IconPlus />
            {enviandoPag ? 'Guardando…' : 'Crear página'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="section-header"><h2>Contenido actual</h2></div>
        {cargando ? (
          <p>Cargando…</p>
        ) : categorias.length === 0 ? (
          <div className="empty"><p>Sin categorías todavía.</p></div>
        ) : (
          categorias.map((c) => (
            <div key={c.id} className="manual-admin-categoria">
              <div className="manual-admin-categoria-header">
                <strong>{c.nombre}</strong>
                {c.rolMinimo && <span className="tag">{c.rolMinimo}+</span>}
                <button type="button" onClick={() => eliminarCategoria(c.id, c.nombre)} className="btn btn-danger btn-sm">
                  <IconTrash /> Eliminar categoría
                </button>
              </div>
              {c.paginas.length === 0 ? (
                <p className="manual-vacio">Sin páginas.</p>
              ) : (
                <ul className="manual-admin-paginas">
                  {c.paginas.map((p) => (
                    <li key={p.id}>
                      {p.titulo}
                      <button type="button" onClick={() => eliminarPagina(p.id, p.titulo)} className="link-eliminar">
                        Eliminar
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
