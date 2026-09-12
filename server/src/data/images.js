/**
 * Photography, mapped onto listings at seed time.
 *
 * Nine Unsplash photographs cover twenty-four properties, chosen by
 * property type with per-property overrides. Keeping this separate from
 * listings.js means swapping in better photos later is one edit here
 * rather than twenty-four edits there.
 *
 * All photos are from Unsplash's free tier — images.unsplash.com. The paid
 * tier lives on plus.unsplash.com and will not load for visitors.
 */

const IMG = {
  terrace: 'photo-1618660920685-4505debb785a',
  georgian: 'photo-1611510631469-6df4a3e6edc8',
  living: 'photo-1629042306558-7d1e15cc02fa',
  loft: 'photo-1783990349147-906f62b882c1',
  kitchen: 'photo-1759691337957-ebc9ed54dc44',
  studio: 'photo-1722942116102-0226bc5f5962',
  bungalow: 'photo-1664016526102-8d79b2cb92cb',
  land: 'photo-1697627903173-e22b6e04734d',
  hero: 'photo-1524136861124-5e9a7b7f6145',
}

/**
 * Builds an Unsplash CDN URL.
 *
 * The parameters do real work:
 *   w=1200        one width for every photo, so nothing is scaled up
 *   q=75          visually indistinguishable from 100, roughly half the bytes
 *   auto=format   serves WebP or AVIF to browsers that accept them
 *   fit=crop      crop to the requested box rather than squashing
 *   crop=<anchor> WHERE to crop from — which is how one photograph yields
 *                 several visibly different frames
 *
 * The ixid/ixlib parameters from a copied URL are Unsplash's analytics
 * tags. They are dropped: not needed, and they make the URLs unreadable.
 */
function photo(id, crop = 'entropy', width = 1200) {
  return `https://images.unsplash.com/${id}?w=${width}&q=75&auto=format&fit=crop&crop=${crop}`
}

export const heroImage = photo(IMG.hero, 'entropy', 2000)

/* Cycled so two adjacent cards from the same base photo look different. */
const CROPS = ['entropy', 'top', 'center', 'bottom', 'edges', 'left', 'right']

/**
 * Specific properties that deserve a specific photograph, matched on the
 * title. Checked before the property-type fallback.
 */
const OVERRIDES = [
  [/warehouse loft/i, [IMG.loft, IMG.living]],
  [/wharf conversion/i, [IMG.loft, IMG.kitchen]],
  [/converted chapel/i, [IMG.loft, IMG.living]],
  [/studio apartment/i, [IMG.studio, IMG.living]],
  [/building plot/i, [IMG.land]],
  [/bungalow/i, [IMG.bungalow, IMG.living]],
  [/mews house/i, [IMG.georgian, IMG.kitchen]],
  [/new-build/i, [IMG.kitchen, IMG.living]],
  [/tower apartment/i, [IMG.kitchen, IMG.living]],
  [/georgian cottage/i, [IMG.georgian, IMG.living]],
  [/pied/i, [IMG.living, IMG.kitchen]],
]

/* Fallback by property type. Houses get an exterior first, flats an
   interior — which is how estate agents actually lead. */
const BY_TYPE = {
  house: [IMG.terrace, IMG.living],
  flat: [IMG.living, IMG.kitchen],
  bungalow: [IMG.bungalow, IMG.living],
  studio: [IMG.studio, IMG.living],
  land: [IMG.land],
}

/**
 * @param listing  a raw listing from listings.js
 * @param index    its position in the array, used to vary the crop
 */
export function imagesFor(listing, index = 0) {
  const match = OVERRIDES.find(([pattern]) => pattern.test(listing.title))
  const ids = match ? match[1] : (BY_TYPE[listing.propertyType] ?? BY_TYPE.flat)

  /**
   * A period property gets the Georgian exterior rather than the modern
   * terrace — a 1798 Marylebone flat photographed as a new build looks
   * wrong in a way people notice without being able to say why.
   */
  const isPeriod = listing.yearBuilt && listing.yearBuilt < 1930
  const resolved =
    !match && listing.propertyType === 'house' && isPeriod
      ? [IMG.georgian, ids[1]]
      : ids

  return resolved.map((id, i) => photo(id, CROPS[(index + i * 3) % CROPS.length]))
}