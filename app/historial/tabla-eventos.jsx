'use client'

import {
  IconActivity,
  IconAlert,
  IconBan,
  IconCheckCircle,
  IconClipboardList,
  IconEye,
  IconForklift,
  IconPencil,
  IconPlus,
  IconRetry,
  IconTruck,
  IconTruckCheck,
  IconUser,
} from '../components/icons'
import { claseEvento, etiquetaEstado, formatearFechaHora } from './eventos-helpers'

const ICONO_POR_CLASE = {
  'evt-creacion': IconPlus,
  'evt-proceso': IconActivity,
  'evt-terminado': IconCheckCircle,
  'evt-carga': IconForklift,
  'evt-listo': IconTruckCheck,
  'evt-despacho': IconTruck,
  'evt-edicion': IconPencil,
  'evt-cancelacion': IconBan,
  'evt-otro': IconClipboardList,
}

function CirculoEvento({ evento }) {
  const clase = claseEvento(evento)
  const Icono = evento.tipo === 'CAMBIO_DUENO' ? IconUser : (ICONO_POR_CLASE[clase] || IconClipboardList)
  return (
    <span className={`circulo-evento ${clase}`} title={evento.detalle}>
      <Icono />
    </span>
  )
}

export default function TablaEventos({
  eventos,
  cargando,
  error,
  onReintentar,
  pedidoSeleccionadoId,
  onSeleccionar,
}) {
  if (error) {
    return (
      <div className="historial-tabla-vacio">
        <IconAlert width={32} height={32} />
        <p>{error}</p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onReintentar}>
          <IconRetry /> Reintentar
        </button>
      </div>
    )
  }

  if (cargando) {
    return (
      <div className="tabla-wrap">
        <table className="tabla-pedidos tabla-pedidos-densa tabla-eventos">
          <thead>
            <tr>
              <th className="th-icono"></th>
              <th>Fecha y hora</th>
              <th>N.º Pedido</th>
              <th>Pedido</th>
              <th>Evento</th>
              <th>Estado anterior</th>
              <th>Estado nuevo</th>
              <th>Usuario</th>
              <th>Detalle</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="fila-skeleton">
                {Array.from({ length: 10 }).map((__, j) => (
                  <td key={j}><div className="skeleton-linea" /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (eventos.length === 0) {
    return (
      <div className="historial-tabla-vacio">
        <IconClipboardList width={32} height={32} />
        <p>No se encontraron eventos con los filtros seleccionados.</p>
      </div>
    )
  }

  return (
    <div className="tabla-wrap">
      <table className="tabla-pedidos tabla-pedidos-densa tabla-eventos">
        <thead>
          <tr>
            <th className="th-icono"></th>
            <th>Fecha y hora</th>
            <th>N.º Pedido</th>
            <th>Pedido</th>
            <th>Evento</th>
            <th>Estado anterior</th>
            <th>Estado nuevo</th>
            <th>Usuario</th>
            <th>Detalle</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {eventos.map((e) => {
            const seleccionada = e.pedidoId === pedidoSeleccionadoId
            return (
              <tr
                key={e._id}
                className={seleccionada ? 'fila-seleccionada' : ''}
                onClick={() => onSeleccionar(e.pedidoId)}
              >
                <td className="td-icono"><CirculoEvento evento={e} /></td>
                <td data-label="Fecha y hora"><span className="pedido-fecha">{formatearFechaHora(e.creadoEn)}</span></td>
                <td data-label="N.º Pedido">
                  <button
                    type="button"
                    className="link-numero-pedido"
                    onClick={(ev) => { ev.stopPropagation(); onSeleccionar(e.pedidoId) }}
                  >
                    {e.numeroPedido || '—'}
                  </button>
                </td>
                <td data-label="Pedido">{e.pedidoNombre || '—'}</td>
                <td data-label="Evento">{e.detalle || '—'}</td>
                <td data-label="Estado anterior">
                  {e.estadoAnterior
                    ? <span className={`badge-estado-op estado-${e.estadoAnterior.toLowerCase().replace('_', '-')}`}>{etiquetaEstado(e.estadoAnterior)}</span>
                    : <span className="tag-empty">—</span>}
                </td>
                <td data-label="Estado nuevo">
                  {e.estadoNuevo
                    ? <span className={`badge-estado-op estado-${e.estadoNuevo.toLowerCase().replace('_', '-')}`}>{etiquetaEstado(e.estadoNuevo)}</span>
                    : <span className="tag-empty">—</span>}
                </td>
                <td data-label="Usuario">
                  <span className="evento-usuario"><IconUser /> {e.usuarioNombre || '—'}</span>
                </td>
                <td data-label="Detalle">
                  <div className="evento-detalle-celda">
                    <span>{e.detalle}</span>
                    {e.detalleSecundario && <span className="evento-detalle-sec">{e.detalleSecundario}</span>}
                  </div>
                </td>
                <td data-label="Acciones">
                  <button
                    type="button"
                    className="btn-icono"
                    title="Ver detalle"
                    aria-label="Ver detalle"
                    onClick={(ev) => { ev.stopPropagation(); onSeleccionar(e.pedidoId) }}
                  >
                    <IconEye />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
