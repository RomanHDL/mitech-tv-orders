// Encabezado del módulo Pedidos — icono circular + título + subtítulo fijo.
import { FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function PedidosHeader() {
  const { t } = useTranslation()
  return (
    <div className="mb-7 flex items-center gap-4">
      <span className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full bg-blue-50 text-primary">
        <FileText className="h-8 w-8" />
      </span>
      <div>
        <h1 className="text-[34px] font-bold leading-tight tracking-tight text-foreground">{t('nav.pedidos')}</h1>
        <p className="mt-1 text-base text-muted-foreground">{t('pedidos.subtitulo')}</p>
      </div>
    </div>
  )
}
