'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { parsearTexto, filasAItems, aplicarCatalogo } from '@/lib/importar-pedido'
import { IconAlert, IconClipboard, IconExcel, IconDocument, IconCheck, IconClose, IconPlus } from './icons'

const TABS = [
  { id: 'pegar', label: 'Pegar', Icon: IconClipboard },
  { id: 'excel', label: 'Excel', Icon: IconExcel },
  { id: 'foto', label: 'Foto', Icon: IconDocument },
]

export default function ImportarPedidoPanel({ onImportar }) {
  const [abierto, setAbierto] = useState(false)
  const [tab, setTab] = useState('pegar')
  const [texto, setTexto] = useState('')
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [progreso, setProgreso] = useState(0)
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
    () => items.filter((it) => !it._flags.marcaOk || !it._flags.skuOk || !it._flags.pulgadasOk).length,
    [items]
  )

  const reset = () => {
    setTexto('')
    setItems([])
    setError('')
  }

  const cargarFilas = (filas) => {
    const nuevos = aplicarCatalogo(filasAItems(filas), catalogoRef.current)
    if (!nuevos.length) {
      setError('No se encontraron renglones. Revisa que sean columnas Marca / Modelo / Cantidad.')
      setItems([])
      return
    }
    setError('')
    setItems(nuevos)
  }

  const onPegar = (valor) => {
    setTexto(valor)
    if (valor.trim()) cargarFilas(parsearTexto(valor))
    else setItems([])
  }

  const onExcel = async (e) => {
    const file = e.target.files?.[0]
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
      cargarFilas(parsearTexto(lineas))
    } catch {
      setError('No se pudo leer el archivo de Excel.')
    } finally {
      if (excelRef.current) excelRef.current.value = ''
    }
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
      const filas = parsearTexto(data.text || '')
      if (!filas.length) {
        setError('No se pudo leer la tabla de la foto. Prueba con una imagen más nítida, o usa Pegar/Excel.')
        setItems([])
      } else {
        cargarFilas(filas)
      }
    } catch (err) {
      setError(err?.message || 'No se pudo procesar la imagen')
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
    reset()
    setAbierto(false)
  }

  if (!abierto) {
    return (
      <button type="button" className="btn-importar-toggle" onClick={() => setAbierto(true)}>
        <IconPlus />
        Importar pedido en lote
        <span className="atajo">pegar · Excel · foto</span>
      </button>
    )
  }

  return (
    <div className="importar-panel">
      <div className="importar-panel-header">
        <strong>Importar pedido</strong>
        <button type="button" className="btn-quitar" onClick={() => { reset(); setAbierto(false) }} aria-label="Cerrar">
          <IconClose width={14} height={14} />
          Cerrar
        </button>
      </div>

      <div className="importar-tabs">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`importar-tab ${tab === id ? 'activa' : ''}`}
            onClick={() => { setTab(id); }}
          >
            <Icon width={16} height={16} />
            {label}
          </button>
        ))}
      </div>

      <div className="importar-body">
        {tab === 'pegar' && (
          <textarea
            className="importar-textarea"
            value={texto}
            onChange={(e) => onPegar(e.target.value)}
            placeholder={'Pega aquí (copiado de Excel o WhatsApp). Una TV por renglón:\nHISENSE\t32H40G\t66\nONN\t100012585\t194'}
            rows={6}
          />
        )}

        {tab === 'excel' && (
          <div className="importar-dropzone">
            <input ref={excelRef} type="file" accept=".xlsx,.xls,.csv" onChange={onExcel} hidden />
            <button type="button" className="btn btn-secondary" onClick={() => excelRef.current?.click()}>
              <IconExcel width={16} height={16} />
              Elegir archivo .xlsx / .csv
            </button>
            <p className="hint">Columnas: Marca · Modelo · Cantidad</p>
          </div>
        )}

        {tab === 'foto' && (
          <div className="importar-dropzone">
            <input ref={fotoRef} type="file" accept="image/*" onChange={onFoto} hidden />
            <button type="button" className="btn btn-secondary" onClick={() => fotoRef.current?.click()} disabled={cargando}>
              <IconDocument width={16} height={16} />
              {cargando ? `Leyendo foto… ${progreso}%` : 'Elegir foto del pedido'}
            </button>
            <p className="hint">Lee la tabla de la foto gratis. Revisa los renglones marcados antes de importar.</p>
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
              <span><strong>{items.length}</strong> renglones · <strong>{totalPiezas}</strong> piezas</span>
              {conRevisar > 0 && <span className="importar-revisar">{conRevisar} por revisar</span>}
            </div>
            <div className="importar-preview">
              <table>
                <thead>
                  <tr><th>Marca</th><th>SKU</th><th>Pulg.</th><th>Cant.</th></tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i}>
                      <td className={it._flags.marcaOk ? '' : 'celda-revisar'}>
                        {it.marca || '—'} {it._flags.marcaOk ? <IconCheck width={12} height={12} /> : null}
                      </td>
                      <td className={it._flags.skuOk ? '' : 'celda-revisar'}>{it.modelo || '—'}</td>
                      <td className={it._flags.pulgadasOk ? '' : 'celda-revisar'}>
                        {it._flags.pulgadasOk ? `${it.pulgadas}"` : '?'}
                      </td>
                      <td>{it.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn btn-primary" onClick={confirmar}>
              <IconCheck width={16} height={16} />
              Importar {items.length} {items.length === 1 ? 'TV' : 'TVs'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
