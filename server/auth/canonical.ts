// Canonicalización de dominios de email — HARD RULE del stack (2026-06-08):
// Nextcloud OIDC emite indistintamente @miglobal.com.mx o
// @mitechnologiesinc.com para el mismo usuario. Cualquier chequeo por email
// (login, allowlists, roles) debe tratar ambos dominios como el mismo
// usuario. Se normaliza siempre al dominio canónico antes de comparar o
// guardar en `usuarios.email`.
const CANONICAL_DOMAIN = 'miglobal.com.mx'
const DOMAIN_ALIASES: Record<string, string> = {
  'mitechnologiesinc.com': CANONICAL_DOMAIN,
}

export function canonicalEmail(email: string): string {
  const trimmed = email.trim().toLowerCase()
  const at = trimmed.lastIndexOf('@')
  if (at === -1) return trimmed
  const user = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1)
  const canonDomain = DOMAIN_ALIASES[domain] || domain
  return `${user}@${canonDomain}`
}
