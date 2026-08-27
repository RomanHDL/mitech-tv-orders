'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import { parsearTexto, filasAItems, aplicarCatalogo, parsearBloqueAlternativas } from '@/lib/importar-pedido'
import { IconAlert, IconClipboard, IconExcel, IconDocument, IconCheck, IconDownload, IconUpload } from './icons'

function descargarPlantilla() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ['SKU', 'QTY', 'TIPO DE TV (MARCA)', 'CONDICIÓN'],
    ['SNTV001763', 5, 'Hisense', 'GRB'],
    ['SNTV001764', 10, 'Samsung', 'GRA'],
  ])
  ws['!cols'] = [{ wch: 16 }, { wch: 8 }, { wch: 18 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Pedido')
  XLSX.writeFile(wb, 'plantilla-pedido.xlsx')
}

export default function ImportarPedidoPanel({ onImportar, disabled = false }) {
  const { t } = useTranslation()
  const TABS = [
    { id: 'pegar', label: t('importar.tabPegar'), Icon: IconClipboard },
    { id: 'excel', label: t('historial.excel'), Icon: IconExcel },
    { id: 'foto', label: t('importar.tabFoto'), Icon: IconDocument },
  ]
  const [tab, setTab] = useState('pegar')
  const [texto, setTexto] = useState('')
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [arrastrando, setArrastrando] = useState(false)
  const excelRef = useRef(null)
  const fotoRef = useRef(null)
  // Catálogo ONN (modelo -> pulgada). Solo el admin lo recibe; otros roles
  // reciben 403 y el mapa queda vacío (no autollena).
  const catalogoRef = useRef({})

  useEffect(() => {
    let activo = true
    fetch('/api/admin/catalogo-onn')
      .then((r) => (r.ok ? r.json() : []))
      .then((lista) => {
        if (!activo || !Array.isArray(lista)) return
        const mapa = {}
        for (const it of lista) mapa[it.modelo] = it.pulgadas
        catalogoRef.current = mapa
        // Reaplica a lo ya cargado por si el catálogo llegó después de pegar.
        setItems((prev) => (prev.length ? aplicarCatalogo(prev, mapa) : prev))
      })
      .catch(() => {})
    return () => { activo = false }
  }, [])

  const totalPiezas = useMemo(
    () => items.reduce((s, it) => s + (Number(it.cantidad) || 0), 0),
    [items]
  )
  const conRevisar = useMemo(
    () => items.filter((it) => !it._flags.marcaOk || !it._flags.skuOk || !it._flags.pulgadasOk || !it._flags.condicionOk).length,
    [items]
  )

  const cargarFilas = (filas, crudo) => {
    if (!filas.length) {
      const bloque = parsearBloqueAlternativas(crudo || '')
      if (bloque) {
        setError('')
        setItems(aplicarCatalogo(bloque, catalogoRef.current))
        return
      }
      setError(t('importar.errorSinRenglones'))
      setItems([])
      return
    }
    const nuevos = aplicarCatalogo(filasAItems(filas), catalogoRef.current)
    setError('')
    setItems(nuevos)
  }

  const onPegar = (valor) => {
    setTexto(valor)
    if (valor.trim()) cargarFilas(parsearTexto(valor), valor)
    else setItems([])
  }

  const leerExcel = async (file) => {
    if (!file) return
    setError('')
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })
      const lineas = aoa
        .map((fila) => (Array.isArray(fila) ? fila.map((c) => (c == null ? '' : String(c))).join('\t') : ''))
        .join('\n')
      cargarFilas(parsearTexto(lineas), lineas)
    } catch {
      setError(t('importar.errorLeerExcel'))
    }
  }

  const onExcel = async (e) => {
    const file = e.target.files?.[0]
    await leerExcel(file)
    if (excelRef.current) excelRef.current.value = ''
  }

  const onDropExcel = async (e) => {
    e.preventDefault()
    setArrastrando(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    await leerExcel(file)
  }

  // Lee la foto con OCR gratis EN EL NAVEGADOR (tesseract.js). Sin API key.
  const onFoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setCargando(true)
    setProgreso(0)
    try {
      const { default: Tesseract } = await import('tesseract.js')
      const { data } = await Tesseract.recognize(file, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') setProgreso(Math.round(m.progress * 100))
        },
      })
      const crudo = data.text || ''
      const filas = parsearTexto(crudo)
      if (!filas.length && !parsearBloqueAlternativas(crudo)) {
        setError(t('importar.errorLeerFoto'))
        setItems([])
      } else {
        cargarFilas(filas, crudo)
      }
    } catch (err) {
      setError(err?.message || t('importar.errorProcesarImagen'))
      setItems([])
    } finally {
      setCargando(false)
      setProgreso(0)
      if (fotoRef.current) fotoRef.current.value = ''
    }
  }

  const confirmar = () => {
    if (!items.length) return
    onImportar(items)
    setTexto('')
    setItems([])
    setError('')
  }

  return (
    <div className={`importar-panel ${disabled ? 'deshabilitado' : ''}`}>
      <div className="importar-tabs">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`importar-tab ${tab === id ? 'activa' : ''}`}
            onClick={() => setTab(id)}
            disabled={disabled}
          >
            <Icon width={16} height={16} />
            {label}
          </button>
        ))}
      </div>

      <div className="importar-body">
        {disabled && (
          <div className="importar-deshabilitado-aviso">
            {t('importar.pedidoCompletoAviso')}
          </div>
        )}

        {tab === 'pegar' && (
          <textarea
            className="importar-textarea"
            value={texto}
            onChange={(e) => onPegar(e.target.value)}
            placeholder={t('importar.pegarPlaceholder')}
            rows={5}
            disabled={disabled}
          />
        )}

        {tab === 'excel' && (
          <div
            className={`importar-dropzone ${arrastrando ? 'arrastrando' : ''}`}
            onDragOver={(e) => { e.preventDefault(); if (!disabled) setArrastrando(true) }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={onDropExcel}
          >
            <input ref={excelRef} type="file" accept=".xlsx,.xls,.csv" onChange={onExcel} hidden disabled={disabled} />
            <span className="importar-dropzone-icono">
              <IconUpload width={28} height={28} />
            </span>
            <p className="importar-dropzone-titulo">{t('importar.arrastraArchivo')}</p>
            <p className="hint">{t('login.o')}</p>
            <button type="button" className="btn btn-secondary" onClick={() => excelRef.current?.click()} disabled={disabled}>
              <IconExcel width={16} height={16} />
              {t('importar.elegirArchivoExcel')}
            </button>
            <button type="button" className="btn-plantilla" onClick={descargarPlantilla}>
              <IconDownload width={14} height={14} />
              {t('importar.descargarPlantilla')}
            </button>
            <p className="hint">{t('importar.columnasHint')}</p>
          </div>
        )}

        {tab === 'foto' && (
          <div className="importar-dropzone">
            <input ref={fotoRef} type="file" accept="image/*" onChange={onFoto} hidden disabled={disabled} />
            <span className="importar-dropzone-icono">
              <IconDocument width={28} height={28} />
            </span>
            <button type="button" className="btn btn-secondary" onClick={() => fotoRef.current?.click()} disabled={cargando || disabled}>
              <IconDocument width={16} height={16} />
              {cargando ? t('importar.leyendoFoto', { n: progreso }) : t('importar.elegirFoto')}
            </button>
            <p className="hint">{t('importar.fotoHint')}</p>
          </div>
        )}

        {error && (
          <div className="alerta alerta-error">
            <IconAlert />
            <span>{error}</span>
          </div>
        )}

        {items.length > 0 && (
          <>
            <div className="importar-resumen">
              <span>{t('importar.renglonesPiezas', { renglones: items.length, piezas: totalPiezas })}</span>
              {conRevisar > 0 && <span className="importar-revisar">{t('importar.porRevisar', { n: conRevisar })}</span>}
            </div>
            <div className="importar-preview">
              <table>
                <thead>
                  <tr>
                    <th>{t('pedidoDetalle.colSku')}</th>
                    <th>{t('pedidoForm.placeholderCant')}</th>
                    <th>{t('common.marca')}</th>
                    <th>{t('pedidoForm.condicion')}</th>
                    <th>{t('importar.colPulg')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i}>
                      <td className={it._flags.skuOk ? '' : 'celda-revisar'}>
                        {it.modelo || '—'}
                        {it.modelosAlternativos?.length > 0 && (
                          <span className="importar-alt-hint">{t('importar.altHint', { n: it.modelosAlternativos.length })}</span>
                        )}
                      </td>
                      <td>{it.cantidad}</td>
                      <td className={it._flags.marcaOk ? '' : 'celda-revisar'}>
                        {it.marca || '—'} {it._flags.marcaOk ? <IconCheck width={12} height={12} /> : null}
                      </td>
                      <td className={it._flags.condicionOk ? '' : 'celda-revisar'}>
                        {it.condicion ? (
                          <span className={`tv-condicion-chip tv-condicion-chip-${it.condicion.toLowerCase()} tv-fila-condicion-chip`}>{it.condicion}</span>
                        ) : '—'}
                      </td>
                      <td className={it._flags.pulgadasOk ? '' : 'celda-revisar'}>
                        {it._flags.pulgadasOk ? `${it.pulgadas}"` : '?'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn btn-primary" onClick={confirmar} disabled={disabled}>
              <IconCheck width={16} height={16} />
              {t('importar.importarBtn', { count: items.length })}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
