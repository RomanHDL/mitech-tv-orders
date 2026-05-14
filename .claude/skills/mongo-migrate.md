---
name: mongo-migrate
description: Genera un endpoint admin one-shot `/api/admin/migrar-<nombre>` para retro-poblar campos en colecciones MongoDB existentes.
tools: Read, Write, Edit, Glob, Grep, Bash
---

# /mongo-migrate

Crea un endpoint admin para migrar/rellenar datos existentes en MongoDB
sin perder avances (cantidadSurtida, fechas, etc.).

## Cuándo usar

- Cuando se agrega un nuevo campo al esquema y los pedidos viejos no lo tienen.
- Cuando hace falta normalizar valores (uppercase de SKUs, etc.).

## Plantilla

Ubicación: `app/api/admin/migrar-<nombre>/route.js`

```js
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { getRol } from '@/lib/auth'

export async function POST() {
  if ((await getRol()) !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const db = await getDb()
  const pendientes = await db.collection('pedidos')
    .find({ /* filtro de los que faltan */ })
    .toArray()

  const actualizados = []
  for (const p of pendientes) {
    // calcular el valor a setear sin tocar cantidadSurtida ni otros avances
    const valor = /* ... */
    if (valor == null) continue
    await db.collection('pedidos').updateOne(
      { _id: p._id },
      { $set: { /* campo: valor */ } }
    )
    actualizados.push({ id: p._id.toString(), valor })
  }

  return NextResponse.json({
    revisados: pendientes.length,
    actualizados: actualizados.length,
    pedidos: actualizados,
  })
}
```

## Reglas

- **Solo admin** (verificar con `getRol()`).
- **No tocar `cantidadSurtida`** ni avances del operador.
- **Idempotente**: filtra por "campo no existe" para que correr dos
  veces no reescriba nada.
- Devolver `revisados` y `actualizados` para auditoría.

## Cómo dispararla
Desde la consola del navegador (logueado como admin):
```js
fetch('/api/admin/migrar-<nombre>', { method: 'POST' })
  .then(r => r.json()).then(console.log)
```

## Referencia
Ya existe: `app/api/admin/migrar-cantidad-total/route.js`.
