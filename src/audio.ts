import type { Readable } from "node:stream";
import { MediaChain } from "./core/media-chain.js";

/**
 * Create a new audio processing chain
 * This is an alias for video() - it creates a standard media chain
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
  return new MediaChain().input(input);
}

/**
 * Create audio-only processing chain (no video)
 * This is a helper that disables video output
 */
export function audioOnly(input: string | Readable): MediaChain {
  const chain = new MediaChain().input(input);
  // Disable video streams for audio-only output
  for (const stream of chain.toGraph().videoStreams) {
    stream.disabled = true;
  }
  return chain;
}
