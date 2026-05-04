# MiTech TV Orders

Aplicación interna para capturar, ordenar e imprimir pedidos de televisiones.

## Stack
- Next.js 15 (App Router) + React 19
- MongoDB Atlas
- Deploy en Vercel

## Correr en local

```bash
npm install
cp .env.local.example .env.local   # editar con credenciales
npm run dev
```

Abrir http://localhost:3000

## Configurar MongoDB Atlas

1. Crear cuenta en https://www.mongodb.com/atlas
2. Crear cluster gratuito (M0)
3. En "Database Access" crear usuario y contraseña
4. En "Network Access" permitir 0.0.0.0/0 (o tu IP)
5. Copiar el connection string a `.env.local` como `MONGODB_URI`

## Deploy en Vercel

1. Push a GitHub
2. Importar el repo en https://vercel.com/new
3. Agregar variables de entorno:
   - `MONGODB_URI`
   - `MONGODB_DB`
4. Deploy automático en cada push a `main`

## Estructura

```
app/
  page.jsx                          formulario
  api/pedidos/route.js              POST crea pedido
  pedidos/[id]/imprimir/page.jsx    vista de impresión
lib/
  mongodb.js                        cliente Mongo (cacheado)
  catalogos.js                      marcas, pulgadas, condiciones
```

## Agregar más marcas

Editar el array `MARCAS` en `lib/catalogos.js`.

## Modelo de datos

Colección `pedidos`:

```js
{
  _id: ObjectId,
  pedidoNombre: String,
  condiciones: [String],     // GRA, GRB, GRC
  televisiones: [{
    marca: String,
    pulgadas: Number,
    modelo: String,
    cantidad: Number
  }],
  fecha: Date
}
```

## Flujo de uso

1. Usuario abre `/`, llena el formulario (nombre, condiciones, TVs)
2. Al enviar, se guarda en Mongo y se redirige a `/pedidos/[id]/imprimir`
3. La vista de impresión agrupa por marca y ordena por pulgadas
4. Botón "Imprimir" abre el diálogo nativo del navegador
