import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

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
          <button
            onClick={()=>window.location.reload()}
            style={{background:'#CC0000',color:'#fff',border:'none',borderRadius:6,padding:'10px 24px',fontSize:14,fontWeight:700,cursor:'pointer'}}>
            Reintentar
          </button>
          <div style={{marginTop:16,fontSize:11,color:'#555'}}>
            Si el problema persiste, verificar las variables de entorno en Vercel (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY)
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
