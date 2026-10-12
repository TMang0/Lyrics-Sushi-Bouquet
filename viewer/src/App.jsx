import { useEffect, useRef, useState } from 'react'
import {
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  PointLight,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import bounceSound from './assets/Untitled Bounce.wav'
import bounceOutroSound from './assets/Untitled Bounce2.wav'
import bounceAfterSound from './assets/Untitled Bounce3.wav'
import moveTouchIcon from './assets/noun_movetouch_2529285.svg'
import Fireworks from './Fireworks.jsx'
import './App.css'

const modelUrl = `${import.meta.env.BASE_URL}sushi-bouquet.glb`
const beamColors = ['#ff1500', '#ffff00', '#ff00ff', '#00ff9f', '#ff5500', '#ffaa00', '#00a9ff', '#bf00ff', '#ffdd00', '#00ffff']
// Word onsets detected with tools/align_lyrics.py (faster-whisper); mis-heard words corrected by hand, timings kept.
const lyricLines = [
  { id: 'uber', start: 5.24, end: 9.2, layout: 'wide', text: 'I could spent the last twenty dollars that I own on an Uber to your house', emphasis: ['Uber'], wordTimes: [5.24, 5.72, 5.84, 6.1, 6.32, 6.56, 6.86, 7.28, 7.54, 7.74, 8.04, 8.26, 8.42, 8.68, 8.92, 9.14] },
  { id: 'alone', start: 9.4, end: 10.99, layout: 'left', text: 'Just to get us both alone, baby', emphasis: ['both alone'], wordTimes: [9.4, 9.64, 9.84, 10.0, 10.2, 10.34, 10.7] },
  { id: 'friends', start: 11, end: 12.22, layout: 'swap', text: 'Maybe we just', struck: 'friends', replacement: 'couple', wordTimes: [10.7, 11.12, 11.7] },
  { id: 'zone', start: 12.34, end: 13.66, layout: 'vertical', text: 'maybe we outside the zone', overlay: 'we are', wordTimes: [12.34, 12.56, 12.84, 13.2, 13.38] },
  { id: 'tell', start: 13.66, end: 15.26, layout: 'right', text: 'I can never really tell with you', emphasis: ['with you'], wordTimes: [13.66, 13.92, 14.06, 14.34, 14.66, 14.98, 15.16] },
  { id: 'know', start: 15.3, end: 16.48, layout: 'left', text: 'So baby, let me know', emphasis: ['So baby'], wordTimes: [15.3, 15.46, 15.74, 16.0, 16.16] },
  { id: 'tellme', start: 16.48, end: 16.95, layout: 'center', text: 'tell me', emphasis: ['tell me'], wordTimes: [16.48, 16.72] },
  { id: 'mind', start: 17.08, end: 19.54, layout: 'wide', text: "'Cause I just wanna be in your mind", emphasis: ['in your mind'], wordTimes: [17.08, 17.2, 17.52, 17.76, 18.02, 18.46, 18.56, 19.12] },
  { id: 'line', start: 19.54, end: 22.32, layout: 'vertical', text: 'When you need somebody to hit your line', emphasis: ['hit your line'], wordTimes: [19.54, 19.9, 20.26, 20.54, 21.02, 21.28, 21.64, 22.0] },
  { id: 'fine', start: 22.8, end: 24.78, layout: 'right', text: 'Can you tell me it all will be just fine?', emphasis: ['just fine'], wordTimes: [22.8, 22.92, 23.04, 23.3, 23.54, 23.7, 23.88, 24.04, 24.32, 24.5] },
  { id: 'flower', start: 24.8, end: 26.5, layout: 'flower', text: 'Got a flower for you', wordTimes: [24.8, 25.06, 25.32, 26.02, 26.34] },
  { id: 'lies', start: 26.5, end: 28.2, layout: 'swap', text: "it's filled with", struck: 'lies', replacement: 'sushi', wordTimes: [26.5, 26.68, 27.0] },
]
const lyricsEnd = 28.2

const renderLyricText = (text, emphasis = [], visibleWords = Infinity) => {
  const words = text.split(' ')
  const visibleText = words.slice(0, visibleWords).join(' ')
  if (!emphasis.length) return visibleText
  const pattern = new RegExp(`(${emphasis.map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return visibleText.split(pattern).filter(Boolean).map((part, index) =>
    emphasis.some((phrase) => phrase.toLowerCase() === part.toLowerCase())
      ? <em className="lyric-emphasis" key={`${part}-${index}`}>{part}</em>
      : <span key={`${part}-${index}`}>{part}</span>,
  )
}

const getVisibleWordCount = (line, time) => {
  if (!line.wordTimes) return Infinity
  const count = line.wordTimes.filter((onset) => time >= onset).length
  return Math.max(1, count)
}

const createBeams = () => Array.from({ length: 28 }, (_, index) => ({
  color: beamColors[index % beamColors.length],
  delay: `${(index * 0.11) % 1.7}s`,
  left: `${(index / 27) * 100 + (index % 3 - 1) * 0.7}%`,
  width: `${0.5 + (index % 4) * 0.55}%`,
}))

function App() {
  const canvasHost = useRef(null)
  const audioLoopRef = useRef(null)
  const frameModelRef = useRef(null)
  const [isLoading, setIsLoading] = useState(true)
  const [introState, setIntroState] = useState('locked')
  const [beamData] = useState(createBeams)
  const [activeLyric, setActiveLyric] = useState(null)
  const [lyricTime, setLyricTime] = useState(0)
  const [bassLevel, setBassLevel] = useState(0)
  const [modelReady, setModelReady] = useState(false)

  useEffect(() => {
    const loop = {
      context: null,
      source: null,
      gain: null,
      analyser: null,
      bassData: null,
      bassAverage: 0,
      bounceBuffer: null,
      outroBuffer: null,
      afterBuffer: null,
      afterSource: null,
      startedAt: 0,
      outroStartedAt: null,
      outroEnded: false,
      isRunning: false,
    }
    const volume = 0.55

    const stop = () => {
      loop.source?.stop()
      loop.source?.disconnect()
      loop.afterSource?.stop()
      loop.afterSource?.disconnect()
      loop.gain?.disconnect()
      loop.analyser?.disconnect()
      loop.context?.close()
      loop.context = null
      loop.source = null
      loop.afterSource = null
      loop.gain = null
      loop.analyser = null
      loop.bassData = null
      loop.bassAverage = 0
      loop.startedAt = 0
      loop.outroStartedAt = null
      loop.outroEnded = false
      loop.isRunning = false
    }

    const start = async () => {
      if (loop.isRunning) return
      const context = new AudioContext()
      await context.resume()
      const [bounceResponse, outroResponse, afterResponse] = await Promise.all([
        fetch(bounceSound),
        fetch(bounceOutroSound),
        fetch(bounceAfterSound),
      ])
      const [bounceData, outroData, afterData] = await Promise.all([
        bounceResponse.arrayBuffer(),
        outroResponse.arrayBuffer(),
        afterResponse.arrayBuffer(),
      ])
      const [bounceBuffer, outroBuffer, afterBuffer] = await Promise.all([
        context.decodeAudioData(bounceData),
        context.decodeAudioData(outroData),
        context.decodeAudioData(afterData),
      ])
      const source = context.createBufferSource()
      const gain = context.createGain()
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.55

      source.buffer = bounceBuffer
      source.loop = true
      source.loopStart = 0
      source.loopEnd = bounceBuffer.duration
      gain.gain.value = volume
      source.connect(gain)
      gain.connect(analyser)
      analyser.connect(context.destination)
      source.start()
      loop.context = context
      loop.source = source
      loop.gain = gain
      loop.analyser = analyser
      loop.bassData = new Uint8Array(analyser.frequencyBinCount)
      loop.bounceBuffer = bounceBuffer
      loop.outroBuffer = outroBuffer
      loop.afterBuffer = afterBuffer
      loop.startedAt = context.currentTime
      loop.isRunning = true
    }

    const finishAudioSequence = () => new Promise((resolve) => {
      if (!loop.isRunning || !loop.context || !loop.source || !loop.bounceBuffer || !loop.outroBuffer || !loop.afterBuffer) {
        resolve()
        return
      }

      const elapsed = loop.context.currentTime - loop.startedAt
      const remaining = loop.bounceBuffer.duration - (elapsed % loop.bounceBuffer.duration)
      const outroStart = loop.context.currentTime + remaining
      const loopSource = loop.source
      const outroSource = loop.context.createBufferSource()
      outroSource.buffer = loop.outroBuffer
      outroSource.connect(loop.gain)
      loopSource.onended = resolve
      outroSource.onended = () => {
        outroSource.disconnect()
        loop.outroEnded = true
      }
      const afterSource = loop.context.createBufferSource()
      afterSource.buffer = loop.afterBuffer
      afterSource.loop = true
      afterSource.loopStart = 0
      afterSource.loopEnd = loop.afterBuffer.duration
      afterSource.connect(loop.gain)
      loopSource.stop(outroStart)
      outroSource.start(outroStart)
      afterSource.start(outroStart + loop.outroBuffer.duration + 2)
      loop.source = outroSource
      loop.afterSource = afterSource
      loop.outroStartedAt = outroStart
    })

    const getOutroTime = () => {
      if (loop.outroEnded) return Infinity
      if (!loop.context || loop.outroStartedAt === null) return null
      return loop.context.currentTime - loop.outroStartedAt
    }

    const getBassLevel = () => {
      if (!loop.analyser || !loop.bassData) return 0
      loop.analyser.getByteFrequencyData(loop.bassData)
      const binHz = loop.context.sampleRate / loop.analyser.fftSize
      const lastBassBin = Math.max(1, Math.round(160 / binHz))
      let sum = 0
      for (let index = 0; index < lastBassBin; index += 1) sum += loop.bassData[index]
      const raw = Math.min(sum / lastBassBin / 255, 1)
      loop.bassAverage = loop.bassAverage ? loop.bassAverage * 0.94 + raw * 0.06 : raw
      const hit = Math.max(0, (raw - loop.bassAverage - 0.012) / 0.06)
      return Math.min(hit, 1)
    }

    audioLoopRef.current = { start, stop, finishAudioSequence, getOutroTime, getBassLevel }

    return () => {
      stop()
      audioLoopRef.current = null
    }
  }, [])

  useEffect(() => {
    if (introState !== 'playing') return undefined
    const timer = window.setTimeout(() => setIntroState('lyrics'), 5600)
    return () => window.clearTimeout(timer)
  }, [introState])

  useEffect(() => {
    if (introState !== 'lyrics') return undefined
    let frameId = null
    const tick = () => {
      const time = audioLoopRef.current?.getOutroTime() ?? 0
      if (time === Infinity) {
        frameModelRef.current?.()
        setIntroState('complete')
        return
      }
      const bass = audioLoopRef.current?.getBassLevel() ?? 0
      setLyricTime((previous) => (Math.abs(previous - time) >= 0.05 ? time : previous))
      setBassLevel((previous) => (Math.abs(previous - bass) >= 0.015 ? bass : previous))
      setActiveLyric((previous) => {
        const next = lyricLines.find((line) => time >= line.start && time <= line.end) ?? null
        return next?.id === previous?.id ? previous : next
      })
      if (time >= lyricsEnd) {
        frameModelRef.current?.()
        setIntroState('complete')
        return
      }
      frameId = window.requestAnimationFrame(tick)
    }
    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [introState])

  useEffect(() => {
    const host = canvasHost.current
    const scene = new Scene()
    const camera = new PerspectiveCamera(38, 1, 0.01, 1000)
    const renderer = new WebGLRenderer({ antialias: true, alpha: true })
    const pixelRatioCap = window.matchMedia('(max-width: 768px)').matches ? 1.25 : 2
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap))
    renderer.outputColorSpace = 'srgb'
    renderer.setClearAlpha(0)
    host.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.enablePan = false
    controls.autoRotate = false

    scene.add(new HemisphereLight('#bfd7ff', '#1a1026', 2.6))
    const keyLight = new DirectionalLight('#ffffff', 3.5)
    keyLight.position.set(4, 6, 7)
    scene.add(keyLight)
    const blueBackLight = new PointLight('#36c5ff', 52, 0, 1.5)
    const roseBackLight = new PointLight('#ff3f8e', 40, 0, 1.5)
    scene.add(blueBackLight, roseBackLight)
    let lightOrbit = null

    const modelGroup = new Group()
    scene.add(modelGroup)
    const modelLoader = new GLTFLoader()
    modelLoader.setMeshoptDecoder(MeshoptDecoder)
    modelLoader.load(
      modelUrl,
      ({ scene: object }) => {
        object.rotation.y = 0
        object.updateMatrixWorld(true)
        object.traverse((child) => {
          if (!child.isMesh) return
          const materials = Array.isArray(child.material) ? child.material : [child.material]
          materials.forEach((material) => {
            if (!material.isMeshStandardMaterial) return
            material.metalness = 0.05
            material.roughness = 0.32
            material.needsUpdate = true
          })
        })
        modelGroup.add(object)
        const bounds = new Box3().setFromObject(object)
        const size = bounds.getSize(new Vector3())
        const center = bounds.getCenter(new Vector3())
        const largestDimension = Math.max(size.x, size.y, size.z)
        lightOrbit = {
          center: center.clone(),
          radius: largestDimension * 1.5,
          height: largestDimension * 0.45,
          verticalOffset: -largestDimension * 0.22,
        }
        controls.minDistance = largestDimension * 0.8
        controls.maxDistance = largestDimension * 6

        const frameModel = () => {
          const isPortrait = camera.aspect < 1
          const portraitDistance = (isPortrait ? 1.7 : 1.6) / Math.max(camera.aspect, 0.1)
          const distance = largestDimension * (isPortrait ? portraitDistance : Math.max(1.9, portraitDistance))
          const cameraElevation = isPortrait ? 0.62 : 0.48
          const cameraAzimuth = (-10 * Math.PI) / 180
          const orbitTarget = center.clone()
          if (isPortrait) orbitTarget.y += largestDimension * 0.08
          camera.near = Math.max(distance / 150, 0.01)
          camera.far = distance * 100
          camera.position.set(
            center.x + Math.sin(cameraAzimuth) * distance,
            center.y + distance * cameraElevation,
            center.z + Math.cos(cameraAzimuth) * distance,
          )
          controls.target.copy(orbitTarget)
          camera.updateProjectionMatrix()
          controls.update()
        }
        frameModelRef.current = frameModel
        frameModel()
        renderer.compile(scene, camera)
        renderer.render(scene, camera)
        setIsLoading(false)
        setModelReady(true)
      },
      undefined,
      () => setIsLoading(false),
    )

    const resize = () => {
      const { width, height } = host.getBoundingClientRect()
      if (!width || !height) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
      frameModelRef.current?.()
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)
    resize()
    renderer.setAnimationLoop((time) => {
      if (lightOrbit) {
        const angle = time * 0.0007
        blueBackLight.position.set(
          lightOrbit.center.x + Math.cos(angle) * lightOrbit.radius,
          lightOrbit.center.y + lightOrbit.verticalOffset + Math.sin(angle * 0.7) * lightOrbit.height,
          lightOrbit.center.z + Math.sin(angle) * lightOrbit.radius,
        )
        roseBackLight.position.set(
          lightOrbit.center.x + Math.cos(angle + Math.PI) * lightOrbit.radius,
          lightOrbit.center.y + lightOrbit.verticalOffset + Math.sin(angle * 0.7 + Math.PI / 2) * lightOrbit.height,
          lightOrbit.center.z + Math.sin(angle + Math.PI) * lightOrbit.radius,
        )
      }
      controls.update()
      renderer.render(scene, camera)
    })

    return () => {
      resizeObserver.disconnect()
      renderer.setAnimationLoop(null)
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      frameModelRef.current = null
    }
  }, [])

  const enableAudio = async () => {
    await audioLoopRef.current?.start().catch(() => undefined)
    setIntroState('idle')
  }

  const startExperience = async () => {
    setIntroState('waiting')
    await audioLoopRef.current?.finishAudioSequence()
    setIntroState('playing')
  }

  const showBouquetDuringLyrics = introState === 'lyrics' && lyricTime >= 24.8
  const fadeBouquetDuringLyrics = introState === 'lyrics' && lyricTime >= 26.5
  const bassStyle = { '--bass': bassLevel.toFixed(3) }

  return (
    <main
      className={`hero-page intro-${introState}${showBouquetDuringLyrics ? ' bouquet-rising' : ''}${fadeBouquetDuringLyrics ? ' bouquet-fading' : ''}${modelReady ? ' model-ready' : ''}`}
      aria-busy={isLoading}
      style={bassStyle}
    >
      <Fireworks active={introState === 'complete'} />
      <div className="canvas-host" ref={canvasHost} aria-label="Modelo 3D de Sushi Bouquet" />
      <p className="touch-hint">
        <img src={moveTouchIcon} alt="" aria-hidden="true" />
        Tocar Flores para mover
      </p>
      {isLoading && introState === 'complete' && <div className="loading-indicator" aria-label="Cargando modelo" />}
      {introState !== 'complete' && (
        <div className="intro-screen" aria-hidden={introState === 'playing' || introState === 'lyrics'}>
          {introState === 'locked' && (
            <button type="button" className="start-button" onClick={enableAudio}>
              Enter
            </button>
          )}
          {introState === 'idle' && (
            <button
              type="button"
              className="start-button"
              disabled={isLoading}
              onClick={startExperience}
            >
              Tap to start
            </button>
          )}
          {introState === 'playing' && (
            <div className="beam-burst">
              {beamData.map((beam, index) => (
                <span
                  className={index % 2 ? 'beam left-moving-beam' : 'beam right-moving-beam'}
                  key={`${beam.color}-${index}`}
                  style={{ '--beam-color': beam.color, '--beam-delay': beam.delay, left: beam.left, width: beam.width }}
                />
              ))}
            </div>
          )}
          {introState === 'lyrics' && (
            <div className="kinetic-lyrics" aria-live="polite">
              {activeLyric?.overlay && (
                <span className="lyric-overlay" key={`${activeLyric.id}-overlay`}>{activeLyric.overlay}</span>
              )}
              {activeLyric && (
                <p className={`lyric-line layout-${activeLyric.layout}`} key={activeLyric.id}>
                  {renderLyricText(activeLyric.text, activeLyric.emphasis, getVisibleWordCount(activeLyric, lyricTime))}
                  {activeLyric.struck && (
                    <>
                      {' '}
                      <span className="lyric-struck">{activeLyric.struck}</span>
                      <span className="lyric-replacement">{activeLyric.replacement}</span>
                    </>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  )
}

export default App
