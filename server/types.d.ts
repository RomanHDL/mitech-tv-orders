// Aumenta el tipo Express.User (usado por Passport para req.user) con la
// forma real de nuestra tabla `usuarios`, para no castear `as Usuario` en
// cada handler.
import type { Usuario } from '../shared/schema'

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends Usuario {}
  }
}

export {}
