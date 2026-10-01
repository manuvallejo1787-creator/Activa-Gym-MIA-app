import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// __BUILD_ID__ queda estampado en el bundle en el momento de compilar.
// Sirve para responder en un segundo la pregunta que ya costó dos horas:
// "¿el navegador está corriendo el código nuevo o uno cacheado?".
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_ID__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
})
