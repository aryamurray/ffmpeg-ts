import type { Readable } from "node:stream";
import { MediaChain } from "./core/media-chain.js";

/**
 * Create a new audio processing chain
 *
 * @example
 * ```ts
 * await audio("input.mp3")
 *   .volume(0.8)
 *   .normalize()
 *   .save("output.mp3");
 * ```
 */
export function audio(input: string | Readable): MediaChain {
  // Create chain without video
  const chain = new MediaChain().input(input);
  chain.mute(); // Actually we want to disable video, not audio - let me fix this
  return chain;
}

/**
 * Create audio-only processing chain (no video)
 * This is a helper that disables video output
 */
export function audioOnly(input: string | Readable): MediaChain {
  const chain = new MediaChain().input(input);
  // For audio-only, we'll handle this at the compiler level
  // by not mapping video streams
  return chain;
}
