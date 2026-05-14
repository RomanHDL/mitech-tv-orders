export default function robots() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || ''
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/stack', '/stack.json', '/stack.md', '/llms.txt', '/login'],
        disallow: ['/api/', '/pedidos', '/surtir', '/historial', '/admin'],
      },
    ],
    sitemap: base ? `${base}/sitemap.xml` : '/sitemap.xml',
  }
}
