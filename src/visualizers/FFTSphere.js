import * as THREE from 'three'

/**
 * FFTSphere - A sphere whose vertices are displaced by audio frequency data.
 * Each vertex moves outward along its normal based on the corresponding
 * frequency bin, with additional perlin-like noise driven by mid frequencies.
 */
export class FFTSphere {
  /**
   * @param {THREE.Scene} scene - The Three.js scene to add the sphere to
   * @param {AudioEngine} audioEngine - The audio engine instance
   */
  constructor(scene, audioEngine) {
    this.scene = scene
    this.audioEngine = audioEngine

    // Create sphere geometry
    const geometry = new THREE.SphereGeometry(1.5, 64, 64)
    this.geometry = geometry

    // Store original vertex positions in a Float32Array (positionClone)
    const positionAttribute = geometry.attributes.position
    this.positionClone = new Float32Array(positionAttribute.array)

    // Create material: black wireframe with blue emissive
    this.material = new THREE.MeshStandardMaterial({
      color: 0x000000,
      wireframe: true,
      emissive: new THREE.Color(0x4444ff),
      emissiveIntensity: 0.3,
    })

    // Create mesh and position at origin
    this.mesh = new THREE.Mesh(geometry, this.material)
    this.mesh.position.set(0, 0, 0)
    this.scene.add(this.mesh)

    // Frame counter for performance optimization
    this.frame = 0
  }

  /**
   * Update vertex positions and visual properties based on audio data.
   * @param {Uint8Array} frequencyData - Frequency bin values (0-255)
   * @param {Uint8Array} waveformData - Waveform data (0-255)
   * @param {AudioEngine} audioEngine - The audio engine instance
   * @param {number} elapsedTime - Total elapsed time in seconds
   */
  update(frequencyData, waveformData, audioEngine, elapsedTime) {
    this.frame++

    // Pulse emissive intensity based on smoothed bass (runs every frame)
    this.material.emissiveIntensity = 0.2 + audioEngine.smoothedBass * 1.5

    // Scale the entire mesh based on smoothed bass (runs every frame)
    this.mesh.scale.setScalar(1 + audioEngine.smoothedBass * 0.15)

    // Only run vertex displacement every other frame for performance
    if (this.frame % 2 === 0) {
      const positionAttribute = this.geometry.attributes.position
      const position = positionAttribute.array
      const vertexCount = positionAttribute.count
      const freqLength = frequencyData.length

      for (let i = 0; i < vertexCount; i++) {
        const ix = i * 3
        const iy = i * 3 + 1
        const iz = i * 3 + 2

        // Get original vertex position (from positionClone)
        const origX = this.positionClone[ix]
        const origY = this.positionClone[iy]
        const origZ = this.positionClone[iz]

        // Map vertex index to a frequency bin
        const binIndex = Math.min(
          Math.floor((i / vertexCount) * freqLength),
          freqLength - 1,
        )
        const binValue = frequencyData[binIndex] !== undefined ? frequencyData[binIndex] : 0
        const normalizedBin = binValue / 255

        // Compute vertex normal (for a sphere at origin, normal = normalized position)
        const len = Math.sqrt(origX * origX + origY * origY + origZ * origZ)
        const nx = len > 0 ? origX / len : 0
        const ny = len > 0 ? origY / len : 0
        const nz = len > 0 ? origZ / len : 0

        // Frequency-based displacement along normal
        const displacement = normalizedBin * audioEngine.smoothedBass * 1.5

        // Perlin-like pseudo-noise displacement
        const noise =
          Math.sin(origX * 2.3 + elapsedTime) *
          Math.cos(origY * 1.7 - elapsedTime * 0.7) *
          Math.sin(origZ * 3.1 + elapsedTime * 0.5)
        const noiseDisplacement = noise * audioEngine.smoothedMid * 0.3

        // Apply both displacements along the normal
        const totalDisplacement = displacement + noiseDisplacement
        position[ix] = origX + nx * totalDisplacement
        position[iy] = origY + ny * totalDisplacement
        position[iz] = origZ + nz * totalDisplacement
      }

      // Mark position as needing update
      positionAttribute.needsUpdate = true
    }
  }

  /**
   * Dispose of geometry and material.
   */
  dispose() {
    if (this.geometry) {
      this.geometry.dispose()
    }
    if (this.material) {
      this.material.dispose()
    }
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh)
    }
  }
}
