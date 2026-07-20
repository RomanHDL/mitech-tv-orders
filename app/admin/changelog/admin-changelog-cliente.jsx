'use client'

import { useEffect, useState } from 'react'
import {
  CHANGELOG_CATEGORIAS,
  CHANGELOG_PRIORIDADES,
  CATEGORIA_LABEL,
  PRIORIDAD_LABEL,
} from '@/lib/changelog'
import { IconAlert, IconPlus, IconTrash } from '../../components/icons'

export default function AdminChangelogCliente() {
  const [entradas, setEntradas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [eliminandoId, setEliminandoId] = useState(null)

  const [version, setVersion] = useState('')
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState('feature')
  const [prioridad, setPrioridad] = useState('normal')
  const [itemsTexto, setItemsTexto] = useState('')

  const cargar = async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/changelog')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al cargar')
      setEntradas(data.entradas || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const res = await fetch('/api/changelog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: version.trim(),
          titulo: titulo.trim(),
          categoria,
          prioridad,
          items: itemsTexto.split('\n').map((l) => l.trim()).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      setVersion('')
      setTitulo('')
      setCategoria('feature')
      setPrioridad('normal')
      setItemsTexto('')
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const eliminar = async (id, tituloEntrada) => {
    if (!confirm(`¿Eliminar la entrada "${tituloEntrada}"? Esta acción no se puede deshacer.`)) return
    setEliminandoId(id)
    try {
      const res = await fetch(`/api/changelog/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar')
      await cargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEliminandoId(null)
    }
  }

  return (
    <div className="usuarios-grid">
      <div className="card">
        <div className="section-header">
          <h2>Nueva entrada</h2>
        </div>
        <form onSubmit={enviar}>
          <div className="section">
            <label className="label" htmlFor="cl-version">Versión (semver)</label>
            <input
              id="cl-version"
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="Ej. 1.2.0"
              required
            />
          </div>
          <div className="section">
            <label className="label" htmlFor="cl-titulo">Título</label>
            <input
              id="cl-titulo"
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej. Nuevo módulo de condiciones por SKU"
              required
            />
          </div>
          <div className="section">
            <label className="label" htmlFor="cl-categoria">Categoría</label>
            <select id="cl-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {CHANGELOG_CATEGORIAS.map((c) => (
                <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div className="section">
            <label className="label" htmlFor="cl-prioridad">Prioridad</label>
            <select id="cl-prioridad" value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
              {CHANGELOG_PRIORIDADES.map((p) => (
                <option key={p} value={p}>{PRIORIDAD_LABEL[p]}</option>
              ))}
            </select>
          </div>
          <div className="section">
            <label className="label" htmlFor="cl-items">
              Detalles <span className="label-help">(uno por línea)</span>
            </label>
            <textarea
              id="cl-items"
              rows={5}
              value={itemsTexto}
              onChange={(e) => setItemsTexto(e.target.value)}
              placeholder={'Agregado X\nCorregido Y'}
            />
          </div>

          {error && (
            <div className="alerta alerta-error">
              <IconAlert />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={enviando} className="btn btn-primary btn-large">
            <IconPlus />
            {enviando ? 'Publicando…' : 'Publicar entrada'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="section-header">
          <h2>Entradas publicadas</h2>
          <span className="count">{entradas.length}</span>
        </div>
        {cargando ? (
          <p>Cargando…</p>
        ) : entradas.length === 0 ? (
          <div className="empty">
            <p>Sin entradas todavía.</p>
          </div>
        ) : (
          <div className="tabla-wrap">
            <table className="tabla-pedidos">
              <thead>
                <tr>
                  <th>Versión</th>
                  <th>Título</th>
                  <th>Categoría</th>
                  <th>Prioridad</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entradas.map((e) => (
                  <tr key={e._id}>
                    <td data-label="Versión">v{e.version}</td>
                    <td data-label="Título">{e.titulo}</td>
                    <td data-label="Categoría">
                      <span className={`tag tag-cat-${e.categoria}`}>{CATEGORIA_LABEL[e.categoria]}</span>
                    </td>
                    <td data-label="Prioridad">
                      <span className={`tag tag-pri-${e.prioridad}`}>{PRIORIDAD_LABEL[e.prioridad]}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => eliminar(e._id, e.titulo)}
                        disabled={eliminandoId === e._id}
                        className="btn btn-danger btn-sm"
                      >
                        <IconTrash />
                        {eliminandoId === e._id ? '…' : 'Eliminar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
