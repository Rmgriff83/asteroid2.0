// THE MONEY MEMBRANE SEAM (handoff principle 5). Every credits mutation in
// the codebase goes through this interface. Today it is local-only; when the
// backend lands, balance/credit/debit become server-authoritative calls and
// nothing else in the game changes. `reason` strings become audit events.
import { playerStore } from '../stores/playerStore'

export const currencyService = {
  balance() {
    return playerStore.credits
  },

  credit(amount, reason = '') {
    if (amount <= 0) return
    playerStore.credits += Math.round(amount)
    playerStore.save()
    if (import.meta.env.DEV && reason) console.debug(`[credits] +${amount} ${reason}`)
  },

  debit(amount, reason = '') {
    amount = Math.round(amount)
    if (amount <= 0 || playerStore.credits < amount) return false
    playerStore.credits -= amount
    playerStore.save()
    if (import.meta.env.DEV && reason) console.debug(`[credits] -${amount} ${reason}`)
    return true
  },
}
