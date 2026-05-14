import { NextResponse } from 'next/server'
import { STACK } from '@/lib/stack'

export const dynamic = 'force-dynamic'

export async function GET() {
  const body = `# ${STACK.name}

> ${STACK.description}

## Discovery
- [Stack (HTML)](/stack)
- [Stack (JSON)](/stack.json)
- [Stack (JSON alias)](/api/public/stack)
- [Stack (Markdown)](/stack.md)
- [Sitemap](/sitemap.xml)

## Stack resumido
- Framework: ${STACK.framework.framework} (${STACK.framework.language})
- React: ${STACK.framework.react}
- Base de datos: ${STACK.database.type}
- Auth: ${STACK.auth.storage} (roles: ${STACK.auth.roles.join(', ')})
- Deploy: ${STACK.deploy.plataforma} (branch ${STACK.deploy.branch})

## API
${STACK.routes.api.map((r) => `- ${r.method} ${r.path}`).join('\n')}
`

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=600',
    },
  })
}
