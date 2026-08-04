import './style.css'
import { AudioEngine } from './audio.js'
import { SceneManager } from './scene.js'
import { BarRing } from './visualizers/BarRing.js'
import { FFTSphere } from './visualizers/FFTSphere.js'

// Create the audio engine instance
const engine = new AudioEngine()

// Create the scene manager and initialize post-processing
const sceneManager = new SceneManager()
sceneManager.initPostProcessing()

// Create the bar ring visualizer (bars react to audio frequency data)
const barRing = new BarRing(sceneManager.scene, engine)

// Create the FFT-reactive sphere
const fftSphere = new FFTSphere(sceneManager.scene, engine)


const startOverlay = document.getElementById('start-overlay')
startOverlay.addEventListener('click', async () => {
  await engine.init()
  startOverlay.classList.add('hidden')
  sceneManager.animate((deltaTime, elapsedTime) => {
    engine.update()
    sceneManager.camera.position.set(0, 0, 5)
    sceneManager.camera.lookAt(0, 0, 0)
    barRing.update(engine.frequencyData, elapsedTime)
    fftSphere.update(engine.frequencyData, engine.getWaveformData(), engine, elapsedTime)
  })
})
