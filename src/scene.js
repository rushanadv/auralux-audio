import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

/**
 * SceneManager - Manages the Three.js scene, camera, renderer, lights,
 * fog, post-processing, and animation loop.
 */
export class SceneManager {
  constructor() {
    // --- Renderer ---
    const canvas = document.getElementById('visualizer-canvas')
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    // --- Camera ---
    const aspect = window.innerWidth / window.innerHeight
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)
    this.camera.position.set(0, 0, 5)

    // --- Scene with fog ---
    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(0x000000, 0.035)

    // --- Lights ---
    const ambientLight = new THREE.AmbientLight(0x111111)
    this.scene.add(ambientLight)

    const pointLight = new THREE.PointLight(0xffffff, 1, 100)
    pointLight.position.set(0, 10, 10)
    this.scene.add(pointLight)

    // --- Clock for timing ---
    this.clock = new THREE.Clock()

    // --- Post-processing state ---
    this.composer = null
    this.renderPass = null
    this.bloomPass = null

    // --- Resize handling ---
    window.addEventListener('resize', () => this.onResize())

    // Set initial sizes
    this.onResize()
  }

  /**
   * Set up post-processing with EffectComposer.
   * - RenderPass for scene rendering
   * - UnrealBloomPass with configurable bloom
   */
  initPostProcessing() {
    this.composer = new EffectComposer(this.renderer)

    this.renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(this.renderPass)

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5, // strength
      0.4, // radius
      0.1, // threshold
    )
    this.composer.addPass(this.bloomPass)
  }

  /**
   * Update bloom pass parameters to make bloom "breathe" with the music.
   * Called per-frame with the audio engine's smoothed energy levels.
   * @param {AudioEngine} audioEngine - The audio engine instance
   */
  updateBloom(audioEngine) {
    if (this.bloomPass) {
      this.bloomPass.strength = 1.0 + audioEngine.smoothedBass * 2.5
      this.bloomPass.radius = 0.3 + audioEngine.smoothedTreble * 0.5
    }
  }

  /**
   * Handle window resize: update camera aspect, renderer size, and composer size.
   */
  onResize() {
    const width = window.innerWidth
    const height = window.innerHeight

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()

    this.renderer.setSize(width, height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    if (this.composer) {
      this.composer.setSize(width, height)
    }
  }

  /**
   * Run the animation loop using requestAnimationFrame.
   * Calls the provided callback with (deltaTime, elapsedTime) each frame.
   * Uses THREE.Clock for timing.
   * @param {Function} callback - Called each frame with (deltaTime, elapsedTime)
   */
  animate(callback) {
    const tick = () => {
      const deltaTime = this.clock.getDelta()
      const elapsedTime = this.clock.elapsedTime

      callback(deltaTime, elapsedTime)

      if (this.composer) {
        this.composer.render()
      } else {
        this.renderer.render(this.scene, this.camera)
      }

      requestAnimationFrame(tick)
    }
    tick()
  }

  /**
   * Clean up resources.
   */
  dispose() {
    if (this.composer) {
      this.composer.dispose()
    }
    if (this.renderPass) {
      this.renderPass.dispose()
    }
    if (this.bloomPass) {
      this.bloomPass.dispose()
    }
    this.renderer.dispose()
  }
}
