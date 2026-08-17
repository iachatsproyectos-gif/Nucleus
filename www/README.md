# Nucleus

Organizador mental espacial: mapas, niveles y conexiones en el navegador.

## Abrir la app

```bash
cd Nucleus
python -m http.server 8080
```

Visita `http://localhost:8080` — recarga forzada (`Ctrl+Shift+R`) tras actualizaciones.

**PWA:** instala desde el navegador. El service worker cachea assets para uso offline.

## Funciones principales

- **Canvas espacial:** nodos, subs, títulos, regiones, conexiones con puertos
- **Niveles:** entrar en una sub y volver con la barra superior o `Alt+↑`
- **Media:** documentos, enlaces y fotos en el mapa
- **Búsqueda:** `Ctrl+K` con filtros por tipo
- **Nucleus:** checklist diaria + holograma 3D con accesos a home, buscar, encuadrar y subir nivel
- **Respaldo local:** exportar/importar JSON desde la barra superior

## Atajos

| Atajo | Acción |
|-------|--------|
| `Ctrl+Z` | Deshacer |
| `Ctrl+K` | Buscar |
| `Alt+↑` / `Backspace` | Subir nivel |
| `Alt+←/→` | Historial de navegación |
| Shift + clic marcador | Etiqueta de vida |

## Privacidad

El mapa se guarda en `localStorage` de tu navegador. Usa **respaldo → exportar** para copias de seguridad en archivo.

## Estructura

```
Nucleus/
├── index.html
├── sw.js
├── css/
├── js/
└── MANIFESTO.md
```

## Licencia

Uso personal del autor del repositorio.
