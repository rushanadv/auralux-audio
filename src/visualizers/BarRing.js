import * as THREE from 'three'

/**
 * BarRing - A circular ring of 128 thin bars that react to audio frequency data.
 * Each bar is colored by frequency band (blue/purple for bass, magenta for mid,
 * cyan for treble) and scales in height based on its corresponding FFT bin.
 */
export class BarRing {
  /**
   * @param {THREE.Scene} scene - The Three.js scene to add the ring to
   * @param {AudioEngine} audioEngine - The audio engine instance (for reference)
   */
  constructor(scene, audioEngine) {
    this.scene = scene
    this.audioEngine = audioEngine

    // The group that holds all bars; the whole ring can rotate
    this.group = new THREE.Group()
    this.bars = []

    this.radius = 2.5
    this.barCount = 128

    this._createBars()
    this.scene.add(this.group)
  }

  /**
   * Create the 128 bars arranged in a circle, each colored by frequency band.
   * @private
   */
  _createBars() {
    const geometry = new THREE.BoxGeometry(0.04, 1, 0.04)
    // Move geometry origin to the bottom so bars grow outward from the circle edge
    geometry.translate(0, 0.5, 0)

    for (let i = 0; i < this.barCount; i++) {
      const angle = (i / this.barCount) * Math.PI * 2
      const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))

      // Choose emissive color based on frequency bin index
      let hue
      if (i <= 32) {
        hue = 220 / 360 // blue/purple
      } else if (i <= 80) {
        hue = 280 / 360 // magenta
      } else {
        hue = 180 / 360 // cyan
      }

      const emissiveColor = new THREE.Color().setHSL(hue, 1, 0.6)

      const material = new THREE.MeshStandardMaterial({
        color: 0x111111,
        emissive: emissiveColor,
        emissiveIntensity: 0.5,
        metalness: 0.8,
        roughness: 0.2,
      })

      const bar = new THREE.Mesh(geometry, material)

      // Position on the circle
      bar.position.copy(direction).multiplyScalar(this.radius)

      // Rotate bar to point outward from center
      bar.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction,
      )

      // Store reference to base emissive color for updates
      bar.userData.emissiveColor = emissiveColor.clone()
      bar.userData.binIndex = i

      this.bars.push(bar)
      this.group.add(bar)
    }
  }

  /**
   * Update bar scales and emissive intensities based on frequency data.
   * @param {Uint8Array} frequencyData - Array of frequency bin values (0-255)
   * @param {number} elapsedTime - Total elapsed time in seconds
   */
  update(frequencyData, elapsedTime) {
    for (let i = 0; i < this.bars.length; i++) {
      const bar = this.bars[i]

      // Read frequency bin value and normalize to 0-1
      const binValue = frequencyData[i] !== undefined ? frequencyData[i] : 0
      const normalizedValue = binValue / 255

      // Scale bar height: 1 + normalizedValue * 5 (grows outward)
      bar.scale.set(1, 1 + normalizedValue * 5, 1)

      // Shift emissive intensity: bright when loud, dim when quiet
      bar.material.emissiveIntensity = 0.3 + normalizedValue * 0.7
    }

    // Rotate the entire ring slowly
    this.group.rotation.y += 0.003

    // Tilt wobble
    this.group.rotation.x = Math.sin(elapsedTime * 0.2) * 0.3
  }

  /**
   * Dispose of geometry and materials.
   */
  dispose() {
    this.bars.forEach((bar) => {
      bar.geometry.dispose()
      bar.material.dispose()
    })
    this.bars = []

    if (this.group.parent) {
      this.group.parent.remove(this.group)
    }
  }
}
