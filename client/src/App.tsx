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
import Nav from '@/components/nav'
import { AuthProvider } from '@/hooks/use-auth'

export default function App() {
  return (
    <AuthProvider>
      <Nav />
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={NuevoPedido} />
        <Route path="/pedidos" component={Pedidos} />
        <Route path="/pedidos/:id/editar" component={EditarPedido} />
        <Route path="/pedidos/:id/imprimir" component={Imprimir} />
        <Route path="/surtir" component={Surtir} />
        <Route path="/surtir/:id" component={SurtirDetalle} />
        <Route path="/historial" component={Historial} />
        <Route path="/pedidos-live" component={PedidosLive} />
        <Route path="/admin/usuarios" component={AdminUsuarios} />
        <Route path="/admin/catalogo-onn" component={AdminCatalogoOnn} />
        <Route path="/admin/tags" component={AdminTags} />
        <Route component={NotFound} />
      </Switch>
    </AuthProvider>
  )
}
