import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// __BUILD_ID__ queda estampado en el bundle en el momento de compilar.
// Sirve para responder en un segundo la pregunta que ya costó dos horas:
// "¿el navegador está corriendo el código nuevo o uno cacheado?".
const BUILD_ID = new Date().toISOString().slice(0, 16).replace('T', ' ')

export default defineConfig({
  plugins: [
    react(),
    // Emite /build.json con el MISMO id que quedó estampado en el bundle.
    //
    // POR QUÉ EXISTE
    // El 28/10/2026 Manu pasó una noche creyendo que se había borrado el
    // screening completo de un cliente. La data estaba intacta en la base:
    // su navegador corría un bundle viejo que pintaba el formulario vacío.
    // Se resolvió con Ctrl+Shift+R — el tercer Ctrl+Shift+R en dos días.
    //
    // Una app que necesita que el usuario sepa un atajo de teclado para
    // mostrar datos correctos está rota. El bundle ya sabe de qué build es;
    // lo que faltaba era un lugar donde preguntar cuál es el build vigente.
    // Este archivo es ese lugar: no lleva hash en el nombre, así que la URL
    // es estable y se puede pedir con cache: 'no-store'.
    {
      name: 'estampar-build-json',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'build.json',
          source: JSON.stringify({ build: BUILD_ID }),
        })
      },
    },
  ],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
})
