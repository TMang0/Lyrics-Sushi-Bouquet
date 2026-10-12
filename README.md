# Lyrics Sushi Bouquet

Experiencia web interactiva: un bouquet de sushi en 3D con intro sincronizada al audio, letras cinéticas y fuegos artificiales. Todo corre en el navegador, sin backend.

**Demo:** https://tmang0.github.io/Lyrics-Sushi-Bouquet/

## Qué hace

1. **Enter** desbloquea el audio y arranca un loop sin cortes (`Untitled Bounce.wav`).
2. **Tap to start** deja terminar el ciclo actual, lanza una ráfaga de haces de color y empieza `Untitled Bounce2.wav`.
3. Las letras aparecen palabra por palabra en el instante exacto en que se cantan, con énfasis en rojo y tachados animados.
4. En "Got a flower for you" el bouquet sube al centro y se difumina.
5. Al terminar, se revela el modelo 3D con fuegos artificiales detrás. Dos segundos después arranca `Untitled Bounce3.wav` en loop.

El bouquet se puede girar arrastrando o con gestos táctiles.

## Stack

- React 19 + Vite
- Three.js (GLB con compresión Meshopt)
- Web Audio API: loops sample-accurate, secuenciación por reloj de audio, análisis de graves para mover el texto
- Canvas 2D para los fuegos artificiales

## Desarrollo

```bash
cd viewer
npm install
npm run dev
```

## Optimización del modelo

El OBJ original (344 MB) se convirtió a GLB comprimido (12.8 MB):

```bash
npx obj2gltf -i modelo.obj -o modelo.glb --binary
npx gltf-transform optimize modelo.glb public/sushi-bouquet.glb --compress meshopt
```

## Sincronización de letras

Los tiempos por palabra se detectaron con `faster-whisper`:

```bash
cd viewer
python3 -m venv tools/.venv
tools/.venv/bin/pip install faster-whisper numpy
tools/.venv/bin/python tools/align_lyrics.py small
```

Genera `tools/lyric-words.json`. Los tiempos se copian a `lyricLines` en `src/App.jsx`.

## Despliegue

Cada push a `main` construye y publica en GitHub Pages mediante `.github/workflows/deploy.yml`.
