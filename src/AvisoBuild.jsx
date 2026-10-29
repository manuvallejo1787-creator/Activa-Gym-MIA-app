// AvisoBuild.jsx — avisa cuando el navegador está corriendo un bundle viejo
//
// EL CASO QUE LO ORIGINÓ
// El 28/10/2026 Manu reportó que "se borró toda la información cargada del
// screening" de un cliente. La base tenía las 121 claves con valor, intactas:
// su navegador corría un bundle viejo y el formulario se pintaba vacío.
// Pasó la noche creyendo que había perdido una evaluación completa.
//
// Se resolvió recargando. Fue el tercer Ctrl+Shift+R en dos días, y ese es el
// problema: el atajo no es la solución, es el síntoma. Un dato mostrado de
// menos es indistinguible de un dato borrado, así que el usuario no tiene
// forma de saber que lo que necesita es recargar.
//
// POR QUÉ UN CARTEL Y NO UNA RECARGA AUTOMÁTICA
// Una recarga automática en medio de un screening de 132 campos tira a la
// basura el trabajo sin guardar, que es un daño real y seguro para evitar un
// daño posible. El cartel no se puede cerrar y ocupa el ancho de la pantalla:
// imposible de no ver, y la decisión de cuándo recargar queda en quien sabe
// si tiene algo a medio cargar.
//
// CUÁNDO PREGUNTA
// Al montar, cada vez que la pestaña vuelve a estar visible, y cada 10 min.
// La vuelta a visible es la que más importa: cubre el caso de la app abierta
// en el celular desde ayer, que es exactamente el de Facundo Kidd.
import { useState, useEffect, useCallback } from 'react'

const BUILD_LOCAL = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : null

async function buildDesplegado() {
  // cache: 'no-store' y un parámetro único: build.json no lleva hash en el
  // nombre, así que sin esto el propio caché que queremos detectar nos
  // contestaría con la respuesta vieja.
  const r = await fetch(`/build.json?t=${Date.now()}`, { cache: 'no-store' })
  if (!r.ok) throw new Error('build.json ' + r.status)
  const j = await r.json()
  return j?.build || null
}

export default function AvisoBuild() {
  const [viejo, setViejo] = useState(false)
  const [recargando, setRecargando] = useState(false)

  const revisar = useCallback(async () => {
    if (!BUILD_LOCAL) return
    try {
      const remoto = await buildDesplegado()
      // Sólo avisa si el remoto existe y es DISTINTO. Un fallo de red, un
      // 404 o un JSON roto no tienen que inventar un aviso: en la duda, no
      // molestar. Lo único que se afirma es una diferencia comprobada.
      if (remoto && remoto !== BUILD_LOCAL) setViejo(true)
    } catch { /* sin red o sin build.json: no se afirma nada */ }
  }, [])

  useEffect(() => {
    revisar()
    const alVolver = () => { if (document.visibilityState === 'visible') revisar() }
    document.addEventListener('visibilitychange', alVolver)
    const t = setInterval(revisar, 600000)
    return () => { document.removeEventListener('visibilitychange', alVolver); clearInterval(t) }
  }, [revisar])

  const actualizar = async () => {
    setRecargando(true)
    try {
      if ('caches' in window) {
        const ks = await caches.keys()
        await Promise.all(ks.map(k => caches.delete(k)))
      }
      if (navigator.serviceWorker?.getRegistrations) {
        const rs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(rs.map(r => r.unregister()))
      }
    } catch { /* la limpieza es best-effort: la URL nueva alcanza */ }
    const u = new URL(window.location.href)
    u.searchParams.set('_v', Date.now())
    window.location.replace(u.toString())
  }

  if (!viejo) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
      background: '#CC0000', color: '#fff', padding: '10px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 14, flexWrap: 'wrap', fontFamily: 'Arial,sans-serif',
      boxShadow: '0 2px 10px rgba(0,0,0,.35)',
    }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>
        Estás viendo una versión vieja de la app
      </span>
      <span style={{ fontSize: 12, opacity: .9 }}>
        Puede mostrar información incompleta o faltante. Los datos están guardados.
      </span>
      <button
        onClick={actualizar}
        disabled={recargando}
        style={{
          background: '#fff', color: '#CC0000', border: 'none', borderRadius: 6,
          padding: '6px 16px', fontSize: 13, fontWeight: 800,
          cursor: recargando ? 'default' : 'pointer', flexShrink: 0,
        }}>
        {recargando ? 'Actualizando…' : 'Actualizar ahora'}
      </button>
    </div>
  )
}
