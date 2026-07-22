'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CHANGELOG_CATEGORIAS,
  CHANGELOG_PRIORIDADES,
  categoriaLabel,
  prioridadLabel,
} from '@/lib/changelog'
import { IconAlert, IconPlus, IconTrash } from '../../components/icons'

export default function AdminChangelogCliente() {
  const { t } = useTranslation()
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
      if (!res.ok) throw new Error(data.error || t('changelogAdmin.errorCargar'))
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
      if (!res.ok) throw new Error(data.error || t('changelogAdmin.errorGuardar'))
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
    if (!confirm(t('changelogAdmin.eliminarConfirm', { titulo: tituloEntrada }))) return
    setEliminandoId(id)
    try {
      const res = await fetch(`/api/changelog/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('changelogAdmin.errorEliminar'))
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
          <h2>{t('changelogAdmin.nuevaEntrada')}</h2>
        </div>
        <form onSubmit={enviar}>
          <div className="section">
            <label className="label" htmlFor="cl-version">{t('changelogAdmin.versionLabel')}</label>
            <input
              id="cl-version"
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder={t('changelogAdmin.versionPlaceholder')}
              required
            />
          </div>
          <div className="section">
            <label className="label" htmlFor="cl-titulo">{t('changelogAdmin.tituloLabel')}</label>
            <input
              id="cl-titulo"
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={t('changelogAdmin.tituloPlaceholder')}
              required
            />
          </div>
          <div className="section">
            <label className="label" htmlFor="cl-categoria">{t('changelogAdmin.categoriaLabel')}</label>
            <select id="cl-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {CHANGELOG_CATEGORIAS.map((c) => (
                <option key={c} value={c}>{categoriaLabel(t, c)}</option>
              ))}
            </select>
          </div>
          <div className="section">
            <label className="label" htmlFor="cl-prioridad">{t('changelogAdmin.prioridadLabel')}</label>
            <select id="cl-prioridad" value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
              {CHANGELOG_PRIORIDADES.map((p) => (
                <option key={p} value={p}>{prioridadLabel(t, p)}</option>
              ))}
            </select>
          </div>
          <div className="section">
            <label className="label" htmlFor="cl-items">
              {t('changelogAdmin.detallesLabel')} <span className="label-help">{t('changelogAdmin.detallesHelp')}</span>
            </label>
            <textarea
              id="cl-items"
              rows={5}
              value={itemsTexto}
              onChange={(e) => setItemsTexto(e.target.value)}
              placeholder={t('changelogAdmin.detallesPlaceholder')}
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
            {enviando ? t('changelogAdmin.publicando') : t('changelogAdmin.publicarEntrada')}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="section-header">
          <h2>{t('changelogAdmin.entradasPublicadas')}</h2>
          <span className="count">{entradas.length}</span>
        </div>
        {cargando ? (
          <p>{t('changelogAdmin.cargando')}</p>
        ) : entradas.length === 0 ? (
          <div className="empty">
            <p>{t('changelogAdmin.sinEntradas')}</p>
          </div>
        ) : (
          <div className="tabla-wrap">
            <table className="tabla-pedidos">
              <thead>
                <tr>
                  <th>{t('changelogAdmin.colVersion')}</th>
                  <th>{t('changelogAdmin.colTitulo')}</th>
                  <th>{t('changelogAdmin.colCategoria')}</th>
                  <th>{t('changelogAdmin.colPrioridad')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entradas.map((e) => (
                  <tr key={e._id}>
                    <td data-label={t('changelogAdmin.colVersion')}>v{e.version}</td>
                    <td data-label={t('changelogAdmin.colTitulo')}>{e.titulo}</td>
                    <td data-label={t('changelogAdmin.colCategoria')}>
                      <span className={`tag tag-cat-${e.categoria}`}>{categoriaLabel(t, e.categoria)}</span>
                    </td>
                    <td data-label={t('changelogAdmin.colPrioridad')}>
                      <span className={`tag tag-pri-${e.prioridad}`}>{prioridadLabel(t, e.prioridad)}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => eliminar(e._id, e.titulo)}
                        disabled={eliminandoId === e._id}
                        className="btn btn-danger btn-sm"
                      >
                        <IconTrash />
                        {eliminandoId === e._id ? t('changelogAdmin.eliminando') : t('changelogAdmin.eliminar')}
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
