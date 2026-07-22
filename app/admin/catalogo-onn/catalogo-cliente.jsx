'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { PULGADAS } from '@/lib/catalogos'
import { IconAlert, IconCheck, IconTrash, IconSearch } from '../../components/icons'

const limpiarModelo = (raw) =>
  String(raw || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20).toUpperCase()

export default function CatalogoOnnCliente({ items }) {
  const { t } = useTranslation()
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [modelo, setModelo] = useState('')
  const [pulgadas, setPulgadas] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [guardandoId, setGuardandoId] = useState(null)

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toUpperCase()
    if (!q) return items
    return items.filter((it) => it.modelo.includes(q))
  }, [items, busqueda])

  const agregar = async (e) => {
    e.preventDefault()
    setError('')
    setExito('')
    const m = limpiarModelo(modelo)
    if (m.length < 3) return setError(t('catalogoOnn.errorCodigoCorto'))
    if (!pulgadas) return setError(t('catalogoOnn.errorElegirPulgada'))
    setEnviando(true)
    try {
      const res = await fetch('/api/admin/catalogo-onn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelo: m, pulgadas: Number(pulgadas) }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t('catalogoOnn.errorGuardar'))
      }
      setExito(t('catalogoOnn.exitoAgregado', { modelo: m, pulgadas }))
      setModelo('')
      setPulgadas('')
      startTransition(() => router.refresh())
      setTimeout(() => setExito(''), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const cambiarPulgada = async (it, nueva) => {
    setGuardandoId(it.id)
    setError('')
    try {
      const res = await fetch(`/api/admin/catalogo-onn/${it.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pulgadas: Number(nueva) }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t('catalogoOnn.errorActualizar'))
      }
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardandoId(null)
    }
  }

  const eliminar = async (it) => {
    if (!confirm(t('catalogoOnn.confirmarEliminar', { modelo: it.modelo }))) return
    setGuardandoId(it.id)
    setError('')
    try {
      const res = await fetch(`/api/admin/catalogo-onn/${it.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t('catalogoOnn.errorEliminar'))
      }
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardandoId(null)
    }
  }

  return (
    <main className="page-wide">
      <div className="page-header">
        <h1>{t('catalogoOnn.titulo')}</h1>
        <p className="subtitle">{t('catalogoOnn.subtitulo')}</p>
      </div>

      <div className="usuarios-grid">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{t('catalogoOnn.agregarCodigo')}</h2>
          <form onSubmit={agregar}>
            <div className="section">
              <label className="label" htmlFor="c-modelo">{t('catalogoOnn.codigoLabel')}</label>
              <input
                id="c-modelo"
                type="text"
                value={modelo}
                onChange={(e) => setModelo(limpiarModelo(e.target.value))}
                placeholder={t('catalogoOnn.codigoPlaceholder')}
                required
              />
            </div>
            <div className="section">
              <label className="label" htmlFor="c-pulgadas">{t('catalogoOnn.pulgadasLabel')}</label>
              <select
                id="c-pulgadas"
                value={pulgadas}
                onChange={(e) => setPulgadas(e.target.value)}
                required
              >
                <option value="">{t('catalogoOnn.elegirPulgada')}</option>
                {PULGADAS.map((p) => (
                  <option key={p} value={p}>{p}"</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="alerta alerta-error"><IconAlert /><span>{error}</span></div>
            )}
            {exito && (
              <div className="alerta alerta-exito"><IconCheck /><span>{exito}</span></div>
            )}

            <div className="form-acciones">
              <button type="submit" disabled={enviando} className="btn btn-primary btn-large">
                {enviando ? t('catalogoOnn.guardando') : t('catalogoOnn.agregarAlCatalogo')}
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0, marginBottom: '0.8rem' }}>
            {t('catalogoOnn.codigosGuardados', { n: items.length })}
          </h2>
          <div className="section">
            <div className="search-box">
              <IconSearch className="icon-search" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={t('catalogoOnn.buscarCodigoPlaceholder')}
              />
            </div>
          </div>
          {filtrados.length === 0 ? (
            <div className="empty"><p>{items.length === 0 ? t('catalogoOnn.sinCodigos') : t('catalogoOnn.sinResultados')}</p></div>
          ) : (
            <div className="tabla-wrap">
              <table className="tabla-pedidos">
                <thead>
                  <tr><th>{t('catalogoOnn.colCodigo')}</th><th>{t('catalogoOnn.colPulgadas')}</th><th></th></tr>
                </thead>
                <tbody>
                  {filtrados.map((it) => (
                    <tr key={it.id}>
                      <td data-label={t('catalogoOnn.colCodigo')}><strong>{it.modelo}</strong></td>
                      <td data-label={t('catalogoOnn.colPulgadas')}>
                        <select
                          value={it.pulgadas}
                          disabled={guardandoId === it.id}
                          onChange={(e) => cambiarPulgada(it, e.target.value)}
                        >
                          {PULGADAS.map((p) => (
                            <option key={p} value={p}>{p}"</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="acciones">
                          <button
                            onClick={() => eliminar(it)}
                            disabled={guardandoId === it.id}
                            className="btn btn-danger btn-sm"
                          >
                            <IconTrash />
                            {guardandoId === it.id ? t('catalogoOnn.eliminando') : t('common.eliminar')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
