'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { parsearTexto, filasAItems, aplicarCatalogo, parsearBloqueAlternativas } from '@/lib/importar-pedido'
import { IconAlert, IconClipboard, IconExcel, IconDocument, IconCheck, IconDownload, IconUpload } from './icons'

const TABS = [
  { id: 'pegar', label: 'Pegar', Icon: IconClipboard },
  { id: 'excel', label: 'Excel', Icon: IconExcel },
  { id: 'foto', label: 'Foto', Icon: IconDocument },
]

function descargarPlantilla() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ['Marca', 'Modelo', 'Cantidad'],
    ['Hisense', '75A6H', 5],
    ['Samsung', 'DU7000', 10],
  ])
  ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Pedido')
  XLSX.writeFile(wb, 'plantilla-pedido.xlsx')
}

export default function ImportarPedidoPanel({ onImportar, disabled = false }) {
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
    () => items.filter((it) => !it._flags.marcaOk || !it._flags.skuOk || !it._flags.pulgadasOk).length,
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
      setError('No se encontraron renglones. Revisa que sean columnas Marca / Modelo / Cantidad.')
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
      setError('No se pudo leer el archivo de Excel.')
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
        setError('No se pudo leer la tabla de la foto. Prueba con una imagen más nítida, o usa Pegar/Excel.')
        setItems([])
      } else {
        cargarFilas(filas, crudo)
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
            Pedido completo — no se pueden importar más televisiones.
          </div>
        )}

        {tab === 'pegar' && (
          <textarea
            className="importar-textarea"
            value={texto}
            onChange={(e) => onPegar(e.target.value)}
            placeholder={'Pega aquí (copiado de Excel o WhatsApp). Una TV por renglón:\nHISENSE\t32H40G\t66\nONN\t100012585\t194'}
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
            <p className="importar-dropzone-titulo">Arrastra tu archivo aquí</p>
            <p className="hint">o</p>
            <button type="button" className="btn btn-secondary" onClick={() => excelRef.current?.click()} disabled={disabled}>
              <IconExcel width={16} height={16} />
              Elegir archivo .xlsx / .csv
            </button>
            <button type="button" className="btn-plantilla" onClick={descargarPlantilla}>
              <IconDownload width={14} height={14} />
              Descargar plantilla
            </button>
            <p className="hint">Columnas: Marca · Modelo · Cantidad</p>
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
                      <td className={it._flags.skuOk ? '' : 'celda-revisar'}>
                        {it.modelo || '—'}
                        {it.modelosAlternativos?.length > 0 && (
                          <span className="importar-alt-hint"> (+{it.modelosAlternativos.length} alt.)</span>
                        )}
                      </td>
                      <td className={it._flags.pulgadasOk ? '' : 'celda-revisar'}>
                        {it._flags.pulgadasOk ? `${it.pulgadas}"` : '?'}
                      </td>
                      <td>{it.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn btn-primary" onClick={confirmar} disabled={disabled}>
              <IconCheck width={16} height={16} />
              Importar {items.length} {items.length === 1 ? 'TV' : 'TVs'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
