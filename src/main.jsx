import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AuthGate from './AuthGate.jsx'

// Error boundary — si algo falla, muestra mensaje en lugar de pantalla en blanco
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(e) { return { hasError: true, error: e } }
  componentDidCatch(e, info) { console.error('App error:', e, info) }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{fontFamily:'Arial,sans-serif',padding:32,background:'#1a1a1a',minHeight:'100vh',color:'#fff',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
          <div style={{fontSize:40,marginBottom:16}}>⚠️</div>
          <div style={{fontSize:20,fontWeight:800,color:'#CC0000',marginBottom:8}}>Error al cargar la aplicación</div>
          <div style={{fontSize:13,color:'#999',marginBottom:24,maxWidth:480,textAlign:'center'}}>
            {this.state.error?.message || 'Error desconocido'}
          </div>
          {/* Un reload común puede devolver el MISMO bundle cacheado, y entonces
              el botón repite el error para siempre. Este limpia cachés y fuerza
              una URL distinta, así el navegador no tiene de dónde reusar nada. */}
          <button
            onClick={async()=>{
              try{
                if('caches' in window){
                  const ks=await caches.keys()
                  await Promise.all(ks.map(k=>caches.delete(k)))
                }
                if(navigator.serviceWorker?.getRegistrations){
                  const rs=await navigator.serviceWorker.getRegistrations()
                  await Promise.all(rs.map(r=>r.unregister()))
                }
              }catch(e){ console.warn('limpieza de caché:',e) }
              const u=new URL(window.location.href)
              u.searchParams.set('_v', Date.now())
              window.location.replace(u.toString())
            }}
            style={{background:'#CC0000',color:'#fff',border:'none',borderRadius:6,padding:'10px 24px',fontSize:14,fontWeight:700,cursor:'pointer'}}>
            Recargar limpiando caché
          </button>
          <div style={{marginTop:16,fontSize:11,color:'#555',maxWidth:480,textAlign:'center'}}>
            Si el problema persiste, verificar las variables de entorno en Vercel (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY)
          </div>
          <div style={{marginTop:10,fontSize:10,color:'#444',fontFamily:'monospace'}}>
            build {typeof __BUILD_ID__!=='undefined'?__BUILD_ID__:'desconocido'}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthGate>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </AuthGate>
)
