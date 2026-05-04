# MiTech TV Orders

Aplicación interna de MiTechnologies para capturar, ordenar e imprimir pedidos de televisiones.

Reemplaza pedidos por WhatsApp y Word con un formulario web y una hoja de impresión en letra grande para surtidores.

## Stack
- **Next.js 15** (App Router) + React 19
- **MongoDB Atlas** (driver oficial, sin Mongoose)
- **Vercel** (deploy)

## Funcionalidades
- Formulario público (sin login) en `/`
- Lista de todos los pedidos en `/pedidos`
- Eliminar pedidos
- Vista de impresión optimizada en `/pedidos/[id]/imprimir`:
  - Agrupada por marca
  - Ordenada por pulgadas (ascendente)
  - Letra grande, blanco y negro, sin nav ni botones al imprimir

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
3. En **Database Access** crear usuario y contraseña
4. En **Network Access** permitir `0.0.0.0/0` (acceso desde cualquier IP — necesario para Vercel)
5. En el cluster, click en **Connect → Drivers** y copiar el connection string
6. Reemplazar `<password>` y pegar en `.env.local` como `MONGODB_URI`

Ejemplo:
```
MONGODB_URI=mongodb+srv://miuser:supersecret@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=mitech
```

La colección `pedidos` se crea automáticamente al primer insert.

## Deploy en Vercel

1. Push a GitHub (este repo)
2. En https://vercel.com/new importar el repo `mitech-tv-orders`
3. En **Environment Variables** agregar:
   - `MONGODB_URI` → connection string completo
   - `MONGODB_DB` → `mitech`
4. Click **Deploy**
5. Cada push a `main` re-despliega automáticamente

## Estructura

```
app/
  layout.jsx                        layout raíz con nav
  page.jsx                          formulario de pedidos
  loading.jsx                       estado de carga global
  not-found.jsx                     página 404
  error.jsx                         error boundary global
  components/nav.jsx                barra de navegación
  api/pedidos/route.js              POST  crea pedido
  api/pedidos/[id]/route.js         GET   un pedido
                                    DELETE elimina pedido
  pedidos/page.jsx                  lista de pedidos
  pedidos/lista-cliente.jsx         tabla con eliminar
  pedidos/[id]/imprimir/
    page.jsx                        vista de impresión
    print-button.jsx                botones Volver / Imprimir
    imprimir.css                    estilos @media print
lib/
  mongodb.js                        cliente Mongo cacheado
  catalogos.js                      marcas, pulgadas, condiciones
```

## Modelo de datos

Colección `pedidos` en MongoDB:

```js
{
  _id: ObjectId,
  pedidoNombre: String,            // "Pedido Jesica"
  condiciones: [String],           // ["GRA", "GRB"]
  televisiones: [{
    marca: String,                 // "Samsung"
    pulgadas: Number,              // 70
    modelo: String,                // "" si no se especifica
    cantidad: Number               // 20
  }],
  fecha: Date
}
```

## Catálogos

Editar `lib/catalogos.js`:

- **`MARCAS`** — array plano de marcas permitidas
- **`PULGADAS`** — array de números (pulgadas)
- **`CONDICIONES_GRUPOS`** — condiciones agrupadas por categoría con un color asociado

```js
export const CONDICIONES_GRUPOS = [
  { titulo: 'Estado',    color: 'success', items: ['GRA', 'GRB', 'GRC', 'NUEVO', ...] },
  { titulo: 'Daños',     color: 'danger',  items: ['DAÑO ESTÉTICO', 'NO ENCIENDE', ...] },
  { titulo: 'Faltantes', color: 'warning', items: ['SIN CAJA', 'SIN CONTROL', ...] },
  { titulo: 'Otros',     color: 'neutral', items: ['EXHIBICIÓN', 'DEVOLUCIÓN', ...] },
]
```

Para agregar una condición nueva basta con meterla al array `items` de la categoría correspondiente. El form, los tags coloreados de la lista y la validación del API se actualizan automáticamente.

Colores disponibles: `success` (verde), `danger` (rojo), `warning` (ámbar), `neutral` (gris).

La validación se hace tanto en cliente (al enviar el form) como en servidor (en `/api/pedidos`).

## Marca vs Modelo

- **Marca** = fabricante (Samsung, LG, Sony…). Obligatoria. Dropdown con buscador, validada contra `MARCAS`.
- **Modelo** = código específico del producto dentro de la marca (ej. `UN70AU8000`, `OLED55C2`). Opcional, texto libre. Solo lo usas cuando necesitas distinguir entre varios modelos de la misma marca y pulgadas.

## Endpoints API

| Método  | Ruta                    | Acción                       |
|---------|-------------------------|------------------------------|
| POST    | `/api/pedidos`          | Crear pedido                 |
| GET     | `/api/pedidos/[id]`     | Obtener pedido por id        |
| DELETE  | `/api/pedidos/[id]`     | Eliminar pedido              |

## Flujo de uso típico

1. Operador abre `/`, llena nombre del pedido y condiciones (GRA/GRB/GRC)
2. Agrega TVs (marca con buscador, pulgadas, modelo opcional, cantidad)
3. Click **Enviar pedido** → guarda en Mongo → redirige a la vista de impresión
4. Click **Imprimir** → diálogo nativo del navegador
5. Después puede ver y reimprimir desde `/pedidos`
