// Hook genérico de debounce — no existía uno reutilizable en el proyecto.
// Se usa en el buscador de Pedidos para no recalcular el filtro en cada
// tecla (el filtro sigue siendo client-side sobre datos ya cargados, así
// que esto NO evita llamadas a la API, solo recálculos de UI).
import { useEffect, useState } from 'react'

export function useDebouncedValue<T>(valor: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(valor)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(valor), delayMs)
    return () => clearTimeout(id)
  }, [valor, delayMs])

  return debounced
}
