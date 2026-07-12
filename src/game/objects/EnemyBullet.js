import Bullet from './Bullet'

export default class EnemyBullet extends Bullet {
  constructor(scene) {
    super(scene)
    this.setTexture('ebullet')
  }
}
