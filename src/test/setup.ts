import "@testing-library/jest-dom/vitest";

/**
 * jsdom has no layout engine and no Pointer Events, which Radix primitives
 * (the shadcn Select, Dialog and friends) call into when they open. Without
 * these, a component test fails inside Radix rather than on its own
 * assertion. Each is a no-op stand-in — nothing here is under test.
 *
 * Guarded on `Element` because the Edge Function tests run under the `node`
 * environment, where there is no DOM at all.
 */
if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
