import { STACK } from '@/lib/stack'

export const metadata = {
  title: 'Stack · mitech-tv-orders',
  description: STACK.description,
}

export const dynamic = 'force-dynamic'

function rolesText(r) {
  return Array.isArray(r) ? r.join(', ') : r
}

export default function StackPage() {
  const generado = new Date().toISOString()
  const s = STACK

  return (
    <main className="page-wide">
      <div className="page-header">
        <h1>{s.name}</h1>
        <p className="subtitle">{s.description}</p>
        <p className="subtitle" style={{ fontSize: '0.8rem', opacity: 0.7 }}>
          v{s.version} · generado {generado}
        </p>
        <p className="subtitle" style={{ marginTop: '0.5rem' }}>
          <a href="/stack.json">JSON</a> · <a href="/stack.md">Markdown</a> ·{' '}
          <a href="/llms.txt">llms.txt</a> · <a href="/sitemap.xml">sitemap</a>
        </p>
      </div>

      <div className="card">
        <h2>Tecnología</h2>
        <table className="tabla-pedidos">
          <tbody>
            {Object.entries(s.framework).map(([k, v]) => (
              <tr key={k}>
                <td><strong>{k}</strong></td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Dependencias runtime</h2>
        <div className="tags-celda">
          {Object.entries(s.dependencies.runtime).map(([k, v]) => (
            <span key={k} className="tag">{k} {v}</span>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Base de datos</h2>
        <table className="tabla-pedidos">
          <tbody>
            <tr><td><strong>Tipo</strong></td><td>{s.database.type}</td></tr>
            <tr><td><strong>Driver</strong></td><td>{s.database.driver} ({s.database.driverVersion})</td></tr>
            <tr><td><strong>Colecciones</strong></td><td>{s.database.collections.join(', ')}</td></tr>
            <tr><td><strong>Notas</strong></td><td>{s.database.notas}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Autenticación</h2>
        <table className="tabla-pedidos">
          <tbody>
            <tr><td><strong>Storage</strong></td><td>{s.auth.storage}</td></tr>
            <tr><td><strong>Duración</strong></td><td>{s.auth.duracion}</td></tr>
            <tr><td><strong>Métodos</strong></td><td>{s.auth.metodos.join(' · ')}</td></tr>
            <tr><td><strong>Roles</strong></td><td>{s.auth.roles.join(' · ')}</td></tr>
            <tr><td><strong>ACL</strong></td><td>{s.auth.middlewareACL}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Catálogos</h2>
        <h3 style={{ marginTop: '1rem' }}>MARCAS ({s.catalogs.MARCAS.length})</h3>
        <div className="tags-celda">
          {s.catalogs.MARCAS.map((m) => <span key={m} className="tag">{m}</span>)}
        </div>
        <h3 style={{ marginTop: '1rem' }}>PULGADAS</h3>
        <div className="tags-celda">
          {s.catalogs.PULGADAS.map((p) => <span key={p} className="tag">{p}"</span>)}
        </div>
        <h3 style={{ marginTop: '1rem' }}>CONDICIONES</h3>
        <div className="tags-celda">
          {s.catalogs.CONDICIONES.map((c) => <span key={c} className={`tag tag-${c.toLowerCase()}`}>{c}</span>)}
        </div>
        <h3 style={{ marginTop: '1rem' }}>UNIDADES</h3>
        <div className="tags-celda">
          {s.catalogs.UNIDADES.map((u) => <span key={u} className="tag">{u}</span>)}
        </div>
        <p style={{ marginTop: '1rem' }}>
          <strong>SKU_REGEX</strong>: <code>{s.catalogs.SKU_REGEX}</code>
        </p>
      </div>

      <div className="card">
        <h2>Rutas públicas</h2>
        <ul>
          {s.routes.public.map((r) => (
            <li key={r.path}><code>{r.path}</code> — {r.descripcion}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Rutas autenticadas</h2>
        <table className="tabla-pedidos">
          <thead>
            <tr><th>Ruta</th><th>Roles</th><th>Descripción</th></tr>
          </thead>
          <tbody>
            {s.routes.authenticated.map((r) => (
              <tr key={r.path}>
                <td><code>{r.path}</code></td>
                <td>{rolesText(r.roles)}</td>
                <td>{r.descripcion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>API</h2>
        <table className="tabla-pedidos">
          <thead>
            <tr><th>Método</th><th>Ruta</th><th>Roles</th></tr>
          </thead>
          <tbody>
            {s.routes.api.map((r) => (
              <tr key={`${r.method} ${r.path}`}>
                <td><strong>{r.method}</strong></td>
                <td><code>{r.path}</code></td>
                <td>{rolesText(r.roles)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Features</h2>
        <table className="tabla-pedidos">
          <tbody>
            {Object.entries(s.features).map(([k, v]) => (
              <tr key={k}>
                <td><strong>{k}</strong></td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Deploy</h2>
        <table className="tabla-pedidos">
          <tbody>
            {Object.entries(s.deploy).map(([k, v]) => (
              <tr key={k}>
                <td><strong>{k}</strong></td>
                <td>{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>AI / Claude Code</h2>
        <table className="tabla-pedidos">
          <tbody>
            {Object.entries(s.ai).map(([k, v]) => (
              <tr key={k}>
                <td><strong>{k}</strong></td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Descubrimiento</h2>
        <table className="tabla-pedidos">
          <tbody>
            {Object.entries(s.discovery).map(([k, v]) => (
              <tr key={k}>
                <td><strong>{k}</strong></td>
                <td><a href={v}><code>{v}</code></a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
