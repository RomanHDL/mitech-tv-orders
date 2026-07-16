// Placeholder — el panel real (pegar texto / Excel / foto con OCR) se
// construye en la Fase 5 (lib/importar-pedido.js portado a shared/import-pedido.ts
// + tabs con xlsx y tesseract.js). El contrato de props ya queda fijo aquí
// para que <PedidoForm> no necesite cambios cuando se reemplace.
export type ItemImportado = {
  marca: string
  pulgadas: number | ''
  modelo: string
  cantidad: number
  unidad?: 'pieza' | 'pallet'
  modelosAlternativos?: string[]
}

export default function ImportarPedidoPanel({
  onImportar,
}: {
  onImportar: (items: ItemImportado[]) => void
}) {
  void onImportar
  return (
    <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
      Importar por texto / Excel / foto — próximamente (Fase 5)
    </p>
  )
}
