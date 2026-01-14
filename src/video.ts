import type { Readable } from "node:stream";
import { MediaChain } from "./core/media-chain.js";

/**
 * Create a new video processing chain
 *
 * @example
 * ```ts
 * await video("input.mp4")
 *   .resize({ width: 1280 })
 *   .fps(30)
 *   .codec("h264")
 *   .save("output.mp4");
 * ```
 */
export function video(input: string | Readable): MediaChain {
  return new MediaChain().input(input);
}
