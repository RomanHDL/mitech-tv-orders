export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || ''
  const now = new Date()
  const urls = ['/', '/stack', '/stack.json', '/stack.md', '/llms.txt']
  return urls.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: path === '/' ? 1.0 : 0.6,
  }))
}
