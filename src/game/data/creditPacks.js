// IAP credit-pack catalog — PLACEHOLDER until real store billing lands.
// priceLabel is display-only; when StoreKit/Play Billing is wired up these
// ids become the product ids and the label comes from the store response.
export const CREDIT_PACKS = [
  { id: 'pack-scout', name: 'SCOUT CACHE', credits: 500, priceLabel: '$0.99' },
  { id: 'pack-courier', name: 'COURIER CRATE', credits: 1500, priceLabel: '$2.99' },
  { id: 'pack-cruiser', name: 'CRUISER VAULT', credits: 4000, priceLabel: '$6.99' },
  { id: 'pack-fleet', name: 'FLEET RESERVE', credits: 12000, priceLabel: '$14.99' },
]
