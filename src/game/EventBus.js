// Vue ⇄ Phaser bridge. Events:
//   'start-game'    Vue → Phaser: begin a session
//   'pause-game'    Vue → Phaser: pause scenes
//   'resume-game'   Vue → Phaser: resume scenes
//   'quit-to-menu'  Vue → Phaser: stop game, show intro field
//   'ship-changed'  Vue → Phaser: swap ship cosmetics (id)
//   'boost-fired'   Phaser → Phaser(UI): { readyAt } for the cooldown arc
import Phaser from 'phaser'

export const EventBus = new Phaser.Events.EventEmitter()
