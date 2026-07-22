'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconSearch, IconDocument, IconAlert } from '../components/icons'

export default function ManualCliente() {
  const { t } = useTranslation()
  const [categorias, setCategorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [seleccion, setSeleccion] = useState(null) // { catSlug, pageSlug }
  const [pagina, setPagina] = useState(null)
  const [cargandoPagina, setCargandoPagina] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    fetch('/api/documentation/categories')
      .then((res) => res.json())
      .then((data) => {
        setCategorias(data.categorias || [])
        const primera = data.categorias?.[0]
        const primeraPagina = primera?.paginas?.[0]
        if (primera && primeraPagina) {
          setSeleccion({ catSlug: primera.slug, pageSlug: primeraPagina.slug })
        }
      })
      .catch(() => setError(t('manual.errorCargarIndice')))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    if (!seleccion) return
    setCargandoPagina(true)
    fetch(`/api/documentation/page/${seleccion.catSlug}/${seleccion.pageSlug}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('No encontrada'))))
      .then((data) => setPagina(data.pagina))
      .catch(() => setPagina(null))
      .finally(() => setCargandoPagina(false))
  }, [seleccion])

  useEffect(() => {
    const q = busqueda.trim()
    if (!q) {
      setResultados([])
      return
    }
    setBuscando(true)
    const t = setTimeout(() => {
      fetch(`/api/documentation/search?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data) => setResultados(data.resultados || []))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false))
    }, 250)
    return () => clearTimeout(t)
  }, [busqueda])

  const totalPaginas = useMemo(
    () => categorias.reduce((s, c) => s + c.paginas.length, 0),
    [categorias]
  )

  if (cargando) return <div className="card"><p>{t('common.cargando')}</p></div>

  if (error) {
    return (
      <div className="alerta alerta-error">
        <IconAlert />
        <span>{error}</span>
      </div>
    )
  }

  if (totalPaginas === 0) {
    return (
      <div className="card">
        <div className="empty">
          <IconDocument />
          <h3>{t('manual.sinContenido')}</h3>
          <p>{t('manual.adminAgregarHint')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="manual-layout">
      <aside className="manual-sidebar card">
        <div className="search-box manual-search">
          <IconSearch className="icon-search" />
          <input
            type="text"
            placeholder={t('manual.buscarPlaceholder')}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {busqueda.trim() ? (
          <div className="manual-resultados">
            {buscando ? (
              <p className="manual-vacio">{t('common.cargando')}</p>
            ) : resultados.length === 0 ? (
              <p className="manual-vacio">{t('common.sinResultados')}</p>
            ) : (
              resultados.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="manual-link"
                  onClick={() => { setSeleccion({ catSlug: r.categoriaSlug, pageSlug: r.slug }); setBusqueda('') }}
                >
                  <span className="manual-link-cat">{r.categoriaNombre}</span>
                  {r.titulo}
                </button>
              ))
            )}
          </div>
        ) : (
          categorias.map((c) => (
            <div key={c.id} className="manual-categoria">
              <h3>{c.nombre}</h3>
              {c.paginas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`manual-link ${seleccion?.catSlug === c.slug && seleccion?.pageSlug === p.slug ? 'activo' : ''}`}
                  onClick={() => setSeleccion({ catSlug: c.slug, pageSlug: p.slug })}
                >
                  {p.titulo}
                </button>
              ))}
            </div>
          ))
        )}
      </aside>

      <div className="manual-contenido card">
        {cargandoPagina ? (
          <p>{t('common.cargando')}</p>
        ) : !pagina ? (
          <p className="manual-vacio">{t('manual.seleccionaPagina')}</p>
        ) : (
          <>
            <span className="manual-contenido-cat">{pagina.categoriaNombre}</span>
            <h2>{pagina.titulo}</h2>
            <div className="manual-contenido-texto">{pagina.contenido}</div>
          </>
        )}
      </div>
    </div>
  )
}
