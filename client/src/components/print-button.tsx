// Puerto de print-button.jsx
import { useLocation } from 'wouter'
import { ArrowLeft, Printer } from 'lucide-react'

export default function PrintButton() {
  const [, setLocation] = useLocation()
  return (
    <div className="acciones-imprimir">
      <button onClick={() => setLocation('/pedidos')} className="btn-volver">
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>
      <button onClick={() => window.print()} className="btn-imprimir">
        <Printer className="h-4 w-4" />
        Imprimir
      </button>
    </div>
  )
}
