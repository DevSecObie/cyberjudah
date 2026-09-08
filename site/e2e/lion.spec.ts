import { test, expect } from "@playwright/test";

test("lion follows one continuous scroll timeline without autoplay", async ({ page }) => {
  await page.goto("/");
  const film = page.locator(".lion-film");
  await expect(film).toBeAttached();
  await expect.poll(() => film.evaluate(element => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
  await expect.poll(() => page.locator(".lion-journey").evaluate(section => section.clientHeight / window.innerHeight)).toBeGreaterThan(2);
  for (const progress of [0.2, 0.6, 0.3]) {
    await page.locator(".lion-journey").evaluate((section, fraction) => {
      window.scrollTo(0, section.getBoundingClientRect().top + window.scrollY + (section.clientHeight - window.innerHeight) * fraction);
    }, progress);
    await expect.poll(() => film.evaluate((element, fraction) => {
      const video = element as HTMLVideoElement;
      return Math.abs(video.currentTime - (video.duration - 0.04) * fraction);
    }, progress)).toBeLessThan(0.15);
    expect(await film.evaluate(element => (element as HTMLVideoElement).paused)).toBe(true);
  }
  await expect(page.locator("video")).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => film.evaluate(element => (element as HTMLVideoElement).currentTime)).toBe(0);
});
