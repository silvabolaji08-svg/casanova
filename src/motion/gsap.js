import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Flip } from 'gsap/Flip'

/* Plugins must be registered once before use. Doing it here means importing
   this module is the only setup any component needs. */
gsap.registerPlugin(ScrollTrigger, Flip)

export { gsap, ScrollTrigger, Flip }

/**
 * Has this visitor asked for less motion?
 *
 * Read at call time rather than cached, because the OS setting can change
 * while the page is open.
 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Runs GSAP work inside a scoped context, and returns a cleanup function.
 *
 * Two things this solves:
 *
 * 1. gsap.context() records every tween and ScrollTrigger created inside
 *    `setup`, so one revert() undoes all of them. Without it, a component
 *    that unmounts leaves ScrollTriggers attached to dead DOM nodes, and
 *    they keep firing on scroll.
 *
 * 2. For someone who has asked for reduced motion, `setup` never runs at
 *    all. Not "runs and is skipped" — no tween is created, so there is
 *    nothing to play. That is the honest interpretation of the request.
 *
 * Usage:
 *   useEffect(() => motionContext(ref.current, (q) => {
 *     gsap.from(q('.card'), { y: 20, opacity: 0, stagger: 0.06 })
 *   }), [])
 */
export function motionContext(scope, setup) {
  if (!scope || prefersReducedMotion()) return undefined

  const ctx = gsap.context((self) => {
    /* self.selector is scoped to `scope`, so '.card' can never accidentally
       match cards belonging to another component. */
    setup(self.selector, self)
  }, scope)

  return () => ctx.revert()
}

/**
 * Fades and lifts a set of elements into view as they are scrolled to.
 *
 * The single most reused effect on the site, so it lives here rather than
 * being retyped in eight components.
 */
export function revealOnScroll(q, selector, options = {}) {
  const targets = q(selector)
  if (!targets.length) return

  gsap.from(targets, {
    y: options.y ?? 24,
    opacity: 0,
    duration: options.duration ?? 0.7,
    ease: 'power2.out',
    stagger: options.stagger ?? 0.07,
    scrollTrigger: {
      trigger: options.trigger ?? targets[0],
      /* Fires when the element's top reaches 85% down the viewport — just
         before it is fully visible, so the motion is already underway when
         the reader gets there. */
      start: options.start ?? 'top 85%',
      once: true,
    },
  })
}