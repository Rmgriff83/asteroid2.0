import Phaser from 'phaser'
import BootScene from './scenes/BootScene'
import IntroScene from './scenes/IntroScene'
import GameScene from './scenes/GameScene'
import UIScene from './scenes/UIScene'
import { EventBus } from './EventBus'
import { PANEL_W, PANEL_H } from './galaxy/constants'

export function createGame(parent) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#151b2c',
    scale: {
      // Fixed logical space (determinism requirement): every device sees the
      // same 1280×800 panel, letterboxed by FIT.
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: PANEL_W,
      height: PANEL_H,
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 } },
    },
    scene: [BootScene, IntroScene, GameScene, UIScene],
  })

  EventBus.on('start-game', () => {
    game.scene.stop('Intro')
    if (game.scene.isActive('Game') || game.scene.isPaused('Game')) {
      game.scene.stop('UI')
      game.scene.stop('Game')
    }
    game.scene.start('Game') // GameScene launches UI itself
  })

  EventBus.on('pause-game', () => {
    game.scene.pause('Game')
    game.scene.pause('UI')
  })

  EventBus.on('resume-game', () => {
    game.scene.resume('Game')
    game.scene.resume('UI')
  })

  EventBus.on('quit-to-menu', () => {
    game.scene.stop('UI')
    game.scene.stop('Game')
    game.scene.start('Intro')
  })

  return game
}
