import { Switch, Route } from 'wouter'
import NotFound from '@/pages/not-found'
import Login from '@/pages/login'
import NuevoPedido from '@/pages/nuevo-pedido'
import Pedidos from '@/pages/pedidos'
import EditarPedido from '@/pages/editar-pedido'
import Imprimir from '@/pages/imprimir'
import Surtir from '@/pages/surtir'
import SurtirDetalle from '@/pages/surtir-detalle'
import Historial from '@/pages/historial'
import PedidosLive from '@/pages/pedidos-live'
import AdminUsuarios from '@/pages/admin-usuarios'
import AdminCatalogoOnn from '@/pages/admin-catalogo-onn'
import AdminTags from '@/pages/admin-tags'
import Manual from '@/pages/manual'
import Changelog from '@/pages/changelog'
import Nav from '@/components/nav'
import ChangelogModal from '@/components/changelog-modal'
import { AuthProvider } from '@/hooks/use-auth'
import { ProtectedRoute } from '@/components/protected-route'

// Matriz de roles por ruta — equivalente a verificarAcceso() en el
// middleware.js original. La imprimir queda abierta a cualquier rol logueado.
export default function App() {
  return (
    <AuthProvider>
      <Nav />
      <ChangelogModal />
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/manual">
          <ProtectedRoute>
            <Manual />
          </ProtectedRoute>
        </Route>
        <Route path="/changelog">
          <ProtectedRoute>
            <Changelog />
          </ProtectedRoute>
        </Route>
        <Route path="/">
          <ProtectedRoute roles={['admin', 'capturista']}>
            <NuevoPedido />
          </ProtectedRoute>
        </Route>
        <Route path="/pedidos">
          <ProtectedRoute roles={['admin', 'capturista']}>
            <Pedidos />
          </ProtectedRoute>
        </Route>
        <Route path="/pedidos/:id/editar">
          <ProtectedRoute roles={['admin']}>
            <EditarPedido />
          </ProtectedRoute>
        </Route>
        <Route path="/pedidos/:id/imprimir">
          <ProtectedRoute>
            <Imprimir />
          </ProtectedRoute>
        </Route>
        <Route path="/surtir">
          <ProtectedRoute roles={['admin', 'capturista', 'surtidor']}>
            <Surtir />
          </ProtectedRoute>
        </Route>
        <Route path="/surtir/:id">
          <ProtectedRoute roles={['admin', 'capturista', 'surtidor']}>
            <SurtirDetalle />
          </ProtectedRoute>
        </Route>
        <Route path="/historial">
          <ProtectedRoute roles={['admin']}>
            <Historial />
          </ProtectedRoute>
        </Route>
        <Route path="/pedidos-live">
          <ProtectedRoute roles={['admin']}>
            <PedidosLive />
          </ProtectedRoute>
        </Route>
        <Route path="/admin/usuarios">
          <ProtectedRoute roles={['admin']}>
            <AdminUsuarios />
          </ProtectedRoute>
        </Route>
        <Route path="/admin/catalogo-onn">
          <ProtectedRoute roles={['admin']}>
            <AdminCatalogoOnn />
          </ProtectedRoute>
        </Route>
        <Route path="/admin/tags">
          <ProtectedRoute roles={['admin']}>
            <AdminTags />
          </ProtectedRoute>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AuthProvider>
  )
}
