import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getUsuario } from '@/lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 60

// Esquema de salida estructurada: filas tal cual aparecen en la tabla.
const ROWS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          brand: { type: 'string' },
          model: { type: 'string' },
          qty: { type: 'integer' },
        },
        required: ['brand', 'model', 'qty'],
      },
    },
  },
  required: ['rows'],
}

const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(req) {
  const usuario = await getUsuario()
  if (!usuario) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Falta ANTHROPIC_API_KEY en el servidor. Usa Pegar o Excel mientras tanto.' },
      { status: 503 }
    )
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  let { imageBase64, mediaType } = body || {}
  if (typeof imageBase64 !== 'string' || !imageBase64) {
    return NextResponse.json({ error: 'Falta la imagen' }, { status: 400 })
  }
  // Acepta data URLs ("data:image/png;base64,....") y base64 puro.
  const dataUrl = imageBase64.match(/^data:(image\/[a-z+]+);base64,(.*)$/i)
  if (dataUrl) {
    mediaType = mediaType || dataUrl[1]
    imageBase64 = dataUrl[2]
  }
  if (!MEDIA_TYPES.includes(mediaType)) {
    return NextResponse.json({ error: 'Formato de imagen no soportado' }, { status: 400 })
  }

  try {
    const client = new Anthropic()
    const resp = await client.messages.create({
      model: 'claude-opus-4-8', // alternativa más barata: 'claude-haiku-4-5'
      max_tokens: 4096,
      output_config: { format: { type: 'json_schema', schema: ROWS_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            {
              type: 'text',
              text:
                'Esta imagen es una tabla de un pedido de televisiones con columnas Brand (marca), Model (código de modelo) y QTY (cantidad). ' +
                'Extrae cada renglón con brand, model y qty exactamente como aparecen. ' +
                'Ignora la fila de encabezado y la fila de "Total". Si una celda está vacía, déjala vacía.',
            },
          ],
        },
      ],
    })

    if (resp.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'La IA no pudo procesar la imagen' }, { status: 422 })
    }

    let rows = resp.parsed_output?.rows
    if (!rows) {
      // Respaldo: parsear el texto JSON del primer bloque.
      const textBlock = resp.content.find((b) => b.type === 'text')
      try {
        rows = JSON.parse(textBlock?.text || '{}').rows
      } catch {
        rows = null
      }
    }
    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: 'No se pudo leer la tabla de la imagen' }, { status: 422 })
    }

    return NextResponse.json({ rows })
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || 'Error al leer la imagen con IA' },
      { status: 500 }
    )
  }
}
