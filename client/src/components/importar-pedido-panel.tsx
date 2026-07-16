// Puerto de app/components/importar-pedido-panel.jsx — import en lote
// (pegar texto / Excel / foto con OCR en el navegador). tesseract.js se
// importa dinámicamente (igual que el original) para no inflar el bundle
// inicial. El catálogo ONN se lee de GET /api/catalogo-onn (antes
// /api/admin/catalogo-onn — ver Fase 5: se abrió lectura a capturista).
import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Check, Clipboard, FileSpreadsheet, FileImage, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  parsearTexto,
  filasAItems,
  aplicarCatalogo,
  parsearBloqueAlternativas,
  type ItemImportado,
} from '@shared/import-pedido'

const TABS = [
  { id: 'pegar', key: 'importar.tabPegar', Icon: Clipboard },
  { id: 'excel', key: 'importar.tabExcel', Icon: FileSpreadsheet },
  { id: 'foto', key: 'importar.tabFoto', Icon: FileImage },
] as const

export default function ImportarPedidoPanel({ onImportar }: { onImportar: (items: ItemImportado[]) => void }) {
  const { t } = useTranslation()
  const [abierto, setAbierto] = useState(false)
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('pegar')
  const [texto, setTexto] = useState('')
  const [items, setItems] = useState<ItemImportado[]>([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const excelRef = useRef<HTMLInputElement>(null)
  const fotoRef = useRef<HTMLInputElement>(null)
  // Catálogo ONN (modelo -> pulgada). Capturista y admin lo reciben; otros
  // roles (no aplica aquí, el form solo lo usan ellos dos) obtendrían 403
  // y el mapa quedaría vacío sin romper el import.
  const catalogoRef = useRef<Record<string, number>>({})

  useEffect(() => {
    let activo = true
    fetch('/api/catalogo-onn', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: { modelo: string; pulgadas: number }[]) => {
        if (!activo || !Array.isArray(lista)) return
        const mapa: Record<string, number> = {}
        for (const it of lista) mapa[it.modelo] = it.pulgadas
        catalogoRef.current = mapa
        setItems((prev) => (prev.length ? aplicarCatalogo(prev, mapa) : prev))
      })
      .catch(() => {})
    return () => {
      activo = false
    }
  }, [])

  const totalPiezas = useMemo(() => items.reduce((s, it) => s + (Number(it.cantidad) || 0), 0), [items])
  const conRevisar = useMemo(() => items.filter((it) => !it._flags.marcaOk || !it._flags.skuOk || !it._flags.pulgadasOk).length, [items])

  const reset = () => {
    setTexto('')
    setItems([])
    setError('')
  }

  const cargarFilas = (filas: ReturnType<typeof parsearTexto>, crudo?: string) => {
    if (!filas.length) {
      const bloque = parsearBloqueAlternativas(crudo || '')
      if (bloque) {
        setError('')
        setItems(aplicarCatalogo(bloque, catalogoRef.current))
        return
      }
      setError(t('importar.errSinRenglones'))
      setItems([])
      return
    }
    setError('')
    setItems(aplicarCatalogo(filasAItems(filas), catalogoRef.current))
  }

  const onPegar = (valor: string) => {
    setTexto(valor)
    if (valor.trim()) cargarFilas(parsearTexto(valor), valor)
    else setItems([])
  }

  const onExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }) as unknown[][]
      const lineas = aoa.map((fila) => (Array.isArray(fila) ? fila.map((c) => (c == null ? '' : String(c))).join('\t') : '')).join('\n')
      cargarFilas(parsearTexto(lineas), lineas)
    } catch {
      setError(t('importar.errExcel'))
    } finally {
      if (excelRef.current) excelRef.current.value = ''
    }
  }

  // OCR gratis en el navegador — sin API key, sin subir la imagen a ningún lado.
  const onFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setCargando(true)
    setProgreso(0)
    try {
      const { default: Tesseract } = await import('tesseract.js')
      const { data } = await Tesseract.recognize(file, 'eng', {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') setProgreso(Math.round(m.progress * 100))
        },
      })
      const crudo = data.text || ''
      const filas = parsearTexto(crudo)
      if (!filas.length && !parsearBloqueAlternativas(crudo)) {
        setError(t('importar.errFoto'))
        setItems([])
      } else {
        cargarFilas(filas, crudo)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('importar.errProcesarImagen'))
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
      <Button type="button" variant="secondary" className="w-full" onClick={() => setAbierto(true)}>
        <Plus className="h-4 w-4" />
        {t('importar.importarEnLote')}
        <span className="text-xs text-muted-foreground">{t('importar.metodos')}</span>
      </Button>
    )
  }

  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-sm">{t('importar.importarPedido')}</strong>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground"
          onClick={() => {
            reset()
            setAbierto(false)
          }}
        >
          <X className="h-3.5 w-3.5" /> {t('common.cerrar')}
        </button>
      </div>

      <div className="mb-2 flex gap-1 rounded-md bg-secondary p-1">
        {TABS.map(({ id, key, Icon }) => (
          <button
            key={id}
            type="button"
            className={`flex flex-1 items-center justify-center gap-1 rounded-sm px-2 py-1.5 text-sm font-medium ${tab === id ? 'bg-card shadow-sm' : ''}`}
            onClick={() => setTab(id)}
          >
            <Icon className="h-4 w-4" />
            {t(key)}
          </button>
        ))}
      </div>

      {tab === 'pegar' && (
        <textarea
          className="w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={texto}
          onChange={(e) => onPegar(e.target.value)}
          placeholder={t('importar.pegarPlaceholder')}
          rows={6}
        />
      )}

      {tab === 'excel' && (
        <div className="rounded-md border border-dashed p-4 text-center">
          <input ref={excelRef} type="file" accept=".xlsx,.xls,.csv" onChange={onExcel} hidden />
          <Button type="button" variant="secondary" onClick={() => excelRef.current?.click()}>
            <FileSpreadsheet className="h-4 w-4" /> {t('importar.elegirExcel')}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">{t('importar.columnasExcel')}</p>
        </div>
      )}

      {tab === 'foto' && (
        <div className="rounded-md border border-dashed p-4 text-center">
          <input ref={fotoRef} type="file" accept="image/*" onChange={onFoto} hidden />
          <Button type="button" variant="secondary" onClick={() => fotoRef.current?.click()} disabled={cargando}>
            <FileImage className="h-4 w-4" />
            {cargando ? t('importar.leyendoFoto', { pct: progreso }) : t('importar.elegirFoto')}
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">{t('importar.hintFoto')}</p>
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{t('importar.resumen', { renglones: items.length, piezas: totalPiezas })}</span>
            {conRevisar > 0 && <span className="font-semibold text-destructive">{t('importar.porRevisar', { count: conRevisar })}</span>}
          </div>
          <div className="mt-2 max-h-64 overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-secondary">
                <tr>
                  <th className="p-1.5 text-left">{t('pedidoForm.marca')}</th>
                  <th className="p-1.5 text-left">SKU</th>
                  <th className="p-1.5 text-left">{t('importar.pulgAbrev')}</th>
                  <th className="p-1.5 text-left">{t('importar.cantAbrev')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-t">
                    <td className={`p-1.5 ${it._flags.marcaOk ? '' : 'bg-destructive/10'}`}>
                      {it.marca || '—'} {it._flags.marcaOk && <Check className="inline h-3 w-3" />}
                    </td>
                    <td className={`p-1.5 ${it._flags.skuOk ? '' : 'bg-destructive/10'}`}>
                      {it.modelo || '—'}
                      {it.modelosAlternativos?.length > 0 && <span className="text-muted-foreground"> {t('importar.masAlternativos', { count: it.modelosAlternativos.length })}</span>}
                    </td>
                    <td className={`p-1.5 ${it._flags.pulgadasOk ? '' : 'bg-destructive/10'}`}>{it._flags.pulgadasOk ? `${it.pulgadas}"` : '?'}</td>
                    <td className="p-1.5">{it.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button type="button" className="mt-2 w-full" onClick={confirmar}>
            <Check className="h-4 w-4" />
            {t('importar.importarBoton', { count: items.length })}
          </Button>
        </>
      )}
    </div>
  )
}
