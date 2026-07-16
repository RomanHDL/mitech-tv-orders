// Configuración de Passport: serialización de sesión + estrategia OIDC
// (Nextcloud) para admin/capturista. El login NFC/PIN de surtidor NO es una
// "Strategy" de Passport — son rutas propias en server/routes/auth.ts que
// llaman req.login() directo tras validar contra la tabla `usuarios`.
import passport from 'passport'
import { Strategy as OpenIDConnectStrategy } from 'passport-openidconnect'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { usuarios } from '../../shared/schema'
import { canonicalEmail } from './canonical'

passport.serializeUser((usuario, done) => {
  done(null, usuario.id)
})

passport.deserializeUser(async (id: string, done) => {
  try {
    const [usuario] = await db.select().from(usuarios).where(eq(usuarios.id, id))
    done(null, usuario ?? false)
  } catch (err) {
    done(err as Error)
  }
})

// Bandera simple en vez de inspeccionar `passport._strategy(...)` (API
// interna sin tipos públicos) — server/routes/auth.ts la consulta para
// devolver 501 claro si Nextcloud no está configurado en este entorno.
export let oidcConfigured = false

export async function configurePassport() {
  const { OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_REDIRECT_URI } = process.env

  if (!OIDC_ISSUER_URL || !OIDC_CLIENT_ID || !OIDC_CLIENT_SECRET || !OIDC_REDIRECT_URI) {
    console.warn(
      '[auth] OIDC_* no configurado — login Nextcloud (admin/capturista) deshabilitado. ' +
        'El login NFC/PIN de surtidor no depende de esto.'
    )
    return
  }

  // passport-openidconnect (0.1.x) no hace discovery automático desde el
  // issuer como openid-client — hay que resolver los endpoints a mano vía
  // .well-known/openid-configuration antes de construir la Strategy.
  const discoveryUrl = `${OIDC_ISSUER_URL.replace(/\/$/, '')}/.well-known/openid-configuration`
  const res = await fetch(discoveryUrl)
  if (!res.ok) {
    throw new Error(`No se pudo obtener la configuración OIDC de ${discoveryUrl} (HTTP ${res.status})`)
  }
  const discovery = (await res.json()) as {
    authorization_endpoint: string
    token_endpoint: string
    userinfo_endpoint: string
  }

  passport.use(
    new OpenIDConnectStrategy(
      {
        issuer: OIDC_ISSUER_URL,
        authorizationURL: discovery.authorization_endpoint,
        tokenURL: discovery.token_endpoint,
        userInfoURL: discovery.userinfo_endpoint,
        clientID: OIDC_CLIENT_ID,
        clientSecret: OIDC_CLIENT_SECRET,
        callbackURL: OIDC_REDIRECT_URI,
        scope: 'profile email',
        // Gotcha conocido del stack: sin skipUserProfile:false, algunos
        // IdPs (incluido Nextcloud) no adjuntan el email al perfil.
        skipUserProfile: false,
      },
      async (_issuer: string, profile: any, done: (err: Error | null, user?: any, info?: any) => void) => {
        try {
          const rawEmail: string | undefined = profile?.emails?.[0]?.value
          if (!rawEmail) {
            return done(null, false, { message: 'El proveedor no devolvió un email.' })
          }
          const email = canonicalEmail(rawEmail)
          const [usuario] = await db.select().from(usuarios).where(eq(usuarios.email, email))

          if (!usuario) {
            return done(null, false, {
              message: 'Tu cuenta no está registrada. Pide a un admin que te dé de alta en /admin/usuarios.',
            })
          }
          // Los surtidores entran por NFC/PIN (piso, dispositivo compartido);
          // aunque tuvieran cuenta Nextcloud, no deben entrar por aquí.
          if (usuario.rol === 'surtidor') {
            return done(null, false, { message: 'Los surtidores entran por NFC o PIN, no por Nextcloud.' })
          }
          if (!usuario.oidcSub && profile.id) {
            await db.update(usuarios).set({ oidcSub: profile.id }).where(eq(usuarios.id, usuario.id))
          }
          return done(null, usuario)
        } catch (err) {
          return done(err as Error)
        }
      }
    )
  )

  oidcConfigured = true
  console.log('[auth] Estrategia OIDC (Nextcloud) configurada.')
}
