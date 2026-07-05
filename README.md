# Nucleus

Organizador mental espacial: mapas, niveles y capítulos con niebla.

## Abrir la app

```bash
cd Nucleus
python -m http.server 8080
```

Visita `http://localhost:8080` — recarga forzada (`Ctrl+Shift+R`) tras actualizaciones.

**PWA:** instala desde el navegador. El service worker cachea assets offline (v6).

## Funciones principales

- **Capítulos:** presente, horizonte (niebla), cierre guiado, archivo de cerrados
- **Captura:** `Ctrl+Shift+N` → pila INBOX
- **Navegación:** modo enfoque (F), historial `Alt+←/→`, subir nivel `Alt+↑`
- **Datos:** multi-mapa local, snapshots (IndexedDB), export/import JSON
- **Keep:** export/import manual; API vía servidor opcional
- **Sync nube (opcional):** cifrado client-side + backend en `server/`

## Atajos

| Atajo | Acción |
|-------|--------|
| `Ctrl+Z` | Deshacer |
| `Ctrl+K` | Buscar |
| `Ctrl+Shift+N` | Captura rápida → INBOX |
| `F` | Modo enfoque |
| `Alt+↑` / `Backspace` | Subir nivel |
| `Alt+←/→` | Historial de navegación |
| Shift + clic marcador | Etiqueta de vida |

## Servidor sync (opcional)

```bash
cd server
npm install
npm start
```

API en `http://localhost:3001`. Registra usuario con `POST /auth/register`, login en panel **datos → sync nube**.

## Privacidad

Por defecto todo vive en `localStorage` + IndexedDB local. Sync y Keep API son opt-in.

## Estructura

```
Nucleus/
├── index.html
├── sw.js
├── css/
├── js/
├── server/          # Sync + Keep API stub
└── MANIFESTO.md
```

## Licencia

Uso personal del autor del repositorio.
