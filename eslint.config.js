// eslint.config.js — la barrera que faltaba
//
// POR QUÉ EXISTE
// El 21/10/2026 llegó a producción un `bandasRef is not defined`: la variable
// se declaró dentro de App() y se usó dentro de ClientWizardModal, que es otro
// componente. El build de Vite pasó en verde, porque empaquetar no resuelve
// identificadores: el error recién aparece al pintar la pantalla.
//
// Es el mismo tipo de falla que tiró el portal el 16/10 —build verde, roto en
// el navegador— y por eso esta configuración se queda en DOS reglas, las dos
// que detectan ese tipo de error, y ninguna de estilo:
//
//   no-undef                      usar algo que no existe en el alcance
//   react-hooks/rules-of-hooks    hooks condicionales o fuera de orden
//
// Nada de comas, comillas ni sangrías: esto no está para opinar sobre el
// código, está para que no se despliegue algo que se rompe al abrirlo.
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        // Navegador
        window: 'readonly', document: 'readonly', navigator: 'readonly',
        location: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly',
        fetch: 'readonly', Blob: 'readonly', URL: 'readonly', FileReader: 'readonly',
        Image: 'readonly', FormData: 'readonly', Headers: 'readonly',
        alert: 'readonly', confirm: 'readonly', prompt: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
        requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
        console: 'readonly', crypto: 'readonly', atob: 'readonly', btoa: 'readonly',
        AbortController: 'readonly', Event: 'readonly', CustomEvent: 'readonly',
        MutationObserver: 'readonly', IntersectionObserver: 'readonly',
        ResizeObserver: 'readonly', performance: 'readonly', structuredClone: 'readonly',
        TextEncoder: 'readonly', TextDecoder: 'readonly',
        createImageBitmap: 'readonly', caches: 'readonly',
        // Vite: lo inyecta vite.config.js con `define`
        process: 'readonly', import_meta: 'readonly', __BUILD_ID__: 'readonly',
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'no-undef': 'error',
      'react-hooks/rules-of-hooks': 'error',
      // AVISO, no error, agregada el 29/10/2026.
      //
      // POR QUÉ SE ENCENDIÓ
      // Al conectar el contador de sesiones del riel dejé `lineasBase` y
      // `bloqueos` fuera de las dependencias de un useMemo. El código
      // compilaba, eslint pasaba, y la tarjeta de sala simplemente no se
      // actualizaba cuando esos datos llegaban: un no-op silencioso, que es
      // peor que un error porque no deja rastro.
      //
      // POR QUÉ AVISO Y NO ERROR
      // Hay ocho casos en todo el código y algunos son deliberados —el
      // `initialExercises` de useEjercicios no debe re-disparar la carga
      // cuando cambia la identidad del array semilla. Como error bloquearía
      // el despliegue por decisiones correctas; como aviso aparece en cada
      // corrida de salud y se mira cuando toca ese archivo.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
