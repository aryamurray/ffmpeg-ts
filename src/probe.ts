import type { Readable } from "node:stream";
import {
  probe as runProbe,
  type ProbeResult,
  type FormatInfo,
  type VideoInfo,
  type AudioInfo,
  type StreamInfo,
} from "./executor/ffprobe-runner.js";

export type { ProbeResult, FormatInfo, VideoInfo, AudioInfo, StreamInfo };

/**
 * Probe a media file to get information about its contents
 *
 * @example
 * ```ts
 * const info = await probe("video.mp4");
 * console.log(info.format.duration); // Duration in seconds
 * console.log(info.video?.width);    // Video width
 * console.log(info.audio?.codec);    // Audio codec
 * ```
 */
export async function probe(input: string | Readable): Promise<ProbeResult> {
  return runProbe(input);
}
