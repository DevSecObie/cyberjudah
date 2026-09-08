import { useEffect } from "react";

/**
 * Cinema-tier motion: Lenis smooth scroll bridged into GSAP's ticker, plus transform-only
 * entrance motion for elements marked data-reveal. Everything is client-only (loaded in an
 * effect) and switches itself off under prefers-reduced-motion. The scroll-scrub engine owns
 * media time on its own; this never touches the film.
 */
export function Motion() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cleanup = () => {};
    let alive = true;
    (async () => {
      const [{ default: Lenis }, gsapMod, stMod] = await Promise.all([
        import("lenis"),
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (!alive) return;
      const gsap = gsapMod.gsap ?? gsapMod.default;
      const ScrollTrigger = stMod.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({ autoRaf: false, lerp: 0.12 });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      const tweens = gsap.utils.toArray<HTMLElement>("[data-reveal]").map((el) =>
        gsap.from(el, {
          y: 28,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
        }),
      );
      cleanup = () => {
        tweens.forEach((t) => t.scrollTrigger?.kill());
        tweens.forEach((t) => t.kill());
        gsap.ticker.remove(tick);
        lenis.destroy();
      };
    })();
    return () => {
      alive = false;
      cleanup();
    };
  }, []);
  return null;
}
