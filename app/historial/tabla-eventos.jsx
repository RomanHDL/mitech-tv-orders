'use client'

import { useTranslation } from 'react-i18next'
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
import { detalleLabel, detalleSecundarioLabel } from '@/lib/eventos-labels'

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
  const { t } = useTranslation()
  const clase = claseEvento(evento)
  const Icono = evento.tipo === 'CAMBIO_DUENO' ? IconUser : (ICONO_POR_CLASE[clase] || IconClipboardList)
  return (
    <span className={`circulo-evento ${clase}`} title={detalleLabel(t, evento)}>
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
  const { t, i18n } = useTranslation()

  if (error) {
    return (
      <div className="historial-tabla-vacio">
        <IconAlert width={32} height={32} />
        <p>{error}</p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onReintentar}>
          <IconRetry /> {t('common.reintentar')}
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
              <th>{t('historial.colFechaHora')}</th>
              <th>{t('historial.colNumeroPedido')}</th>
              <th>{t('historial.colPedido')}</th>
              <th>{t('historial.colEvento')}</th>
              <th>{t('historial.colEstadoAnterior')}</th>
              <th>{t('historial.colEstadoNuevo')}</th>
              <th>{t('historial.colUsuario')}</th>
              <th>{t('historial.colDetalle')}</th>
              <th>{t('historial.colAcciones')}</th>
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
        <p>{t('historial.sinEventosFiltro')}</p>
      </div>
    )
  }

  return (
    <div className="tabla-wrap">
      <table className="tabla-pedidos tabla-pedidos-densa tabla-eventos">
        <thead>
          <tr>
            <th className="th-icono"></th>
            <th>{t('historial.colFechaHora')}</th>
            <th>{t('historial.colNumeroPedido')}</th>
            <th>{t('historial.colPedido')}</th>
            <th>{t('historial.colEvento')}</th>
            <th>{t('historial.colEstadoAnterior')}</th>
            <th>{t('historial.colEstadoNuevo')}</th>
            <th>{t('historial.colUsuario')}</th>
            <th>{t('historial.colDetalle')}</th>
            <th>{t('historial.colAcciones')}</th>
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
                <td data-label={t('historial.colFechaHora')}><span className="pedido-fecha">{formatearFechaHora(e.creadoEn, i18n.language)}</span></td>
                <td data-label={t('historial.colNumeroPedido')}>
                  <button
                    type="button"
                    className="link-numero-pedido"
                    onClick={(ev) => { ev.stopPropagation(); onSeleccionar(e.pedidoId) }}
                  >
                    {e.numeroPedido || '—'}
                  </button>
                </td>
                <td data-label={t('historial.colPedido')}>{e.pedidoNombre || '—'}</td>
                <td data-label={t('historial.colEvento')}>{detalleLabel(t, e) || '—'}</td>
                <td data-label={t('historial.colEstadoAnterior')}>
                  {e.estadoAnterior
                    ? <span className={`badge-estado-op estado-${e.estadoAnterior.toLowerCase().replace('_', '-')}`}>{etiquetaEstado(t, e.estadoAnterior)}</span>
                    : <span className="tag-empty">—</span>}
                </td>
                <td data-label={t('historial.colEstadoNuevo')}>
                  {e.estadoNuevo
                    ? <span className={`badge-estado-op estado-${e.estadoNuevo.toLowerCase().replace('_', '-')}`}>{etiquetaEstado(t, e.estadoNuevo)}</span>
                    : <span className="tag-empty">—</span>}
                </td>
                <td data-label={t('historial.colUsuario')}>
                  <span className="evento-usuario"><IconUser /> {e.usuarioNombre || '—'}</span>
                </td>
                <td data-label={t('historial.colDetalle')}>
                  <div className="evento-detalle-celda">
                    <span>{detalleLabel(t, e)}</span>
                    {e.detalleSecundario && <span className="evento-detalle-sec">{detalleSecundarioLabel(t, e)}</span>}
                  </div>
                </td>
                <td data-label={t('historial.colAcciones')}>
                  <button
                    type="button"
                    className="btn-icono"
                    title={t('historial.verDetalle')}
                    aria-label={t('historial.verDetalle')}
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
