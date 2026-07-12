import Phaser from 'phaser'

// Generates the few shared textures and waits for the mono font so Phaser
// text never renders with a fallback face.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  create() {
    this.makeTextures()
    const fontReady = document.fonts
      ? Promise.all([
          document.fonts.load('16px "Space Mono"'),
          document.fonts.load('700 16px "Space Mono"'),
        ]).catch(() => {})
      : Promise.resolve()
    fontReady.then(() => this.scene.start('Intro'))
  }

  makeTextures() {
    // bullet: soft glow dot
    let g = this.make.graphics({ add: false })
    g.fillStyle(0xeaf6ff, 0.22)
    g.fillCircle(5, 5, 5)
    g.fillStyle(0xffffff, 1)
    g.fillCircle(5, 5, 2)
    g.generateTexture('bullet', 10, 10)
    g.destroy()

    // ebullet: enemy shot (red glow dot)
    g = this.make.graphics({ add: false })
    g.fillStyle(0xff6a6a, 0.25)
    g.fillCircle(5, 5, 5)
    g.fillStyle(0xffb0a8, 1)
    g.fillCircle(5, 5, 2)
    g.generateTexture('ebullet', 10, 10)
    g.destroy()

    // pickup: resource diamond (tinted per type at runtime)
    g = this.make.graphics({ add: false })
    g.fillStyle(0xffffff, 0.2)
    g.fillCircle(7, 7, 7)
    g.lineStyle(1.6, 0xffffff, 1)
    g.strokePoints(
      [{ x: 7, y: 1.5 }, { x: 12.5, y: 7 }, { x: 7, y: 12.5 }, { x: 1.5, y: 7 }],
      true,
      true
    )
    g.generateTexture('pickup', 14, 14)
    g.destroy()

    // dot: debris/thrust particle
    g = this.make.graphics({ add: false })
    g.fillStyle(0xffffff, 1)
    g.fillCircle(3, 3, 2)
    g.generateTexture('dot', 6, 6)
    g.destroy()

  }
}
