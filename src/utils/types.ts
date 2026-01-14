import type { Readable, Writable } from "node:stream";

/**
 * Input source - can be a file path, URL, or readable stream
 */
export type InputSource = string | Readable;

/**
 * Output destination - can be a file path or writable stream
 */
export type OutputDestination = string | Writable;

/**
 * FFmpeg expression - number or string expression like "W-w-10"
 */
export type Expr = number | string;

/**
 * Video codec options
 */
export type VideoCodec = "h264" | "h265" | "hevc" | "vp9" | "vp8" | "av1" | "copy" | "mpeg4" | "prores";

/**
 * Audio codec options
 */
export type AudioCodec = "aac" | "mp3" | "opus" | "vorbis" | "flac" | "ac3" | "copy" | "pcm_s16le";

/**
 * Container format options
 */
export type ContainerFormat =
  | "mp4"
  | "webm"
  | "mkv"
  | "mov"
  | "avi"
  | "flv"
  | "ts"
  | "m4a"
  | "mp3"
  | "ogg"
  | "wav"
  | "gif";

/**
 * Scale algorithm options
 */
export type ScaleAlgorithm =
  | "fast_bilinear"
  | "bilinear"
  | "bicubic"
  | "neighbor"
  | "area"
  | "bicublin"
  | "gauss"
  | "sinc"
  | "lanczos"
  | "spline";

/**
 * Preset options for encoding speed/quality tradeoff
 */
export type Preset =
  | "ultrafast"
  | "superfast"
  | "veryfast"
  | "faster"
  | "fast"
  | "medium"
  | "slow"
  | "slower"
  | "veryslow"
  | "placebo";

/**
 * H.264/H.265 profile options
 */
export type H264Profile = "baseline" | "main" | "high" | "high10" | "high422" | "high444";

/**
 * Pixel format
 */
export type PixelFormat = "yuv420p" | "yuv422p" | "yuv444p" | "rgb24" | "rgba" | "gray";

/**
 * Progress information emitted during encoding
 */
export interface Progress {
  /** Number of frames processed */
  frames: number;
  /** Current processing speed in frames per second */
  fps: number;
  /** Current bitrate */
  bitrate: string;
  /** Total size processed so far in bytes */
  size: number;
  /** Current time position in seconds */
  time: number;
  /** Processing speed multiplier (e.g., 1.5 = 1.5x realtime) */
  speed: number;
  /** Percentage complete (only if duration is known) */
  percent?: number;
}

/**
 * Options for save/pipe operations
 */
export interface OutputOptions {
  /** AbortSignal to cancel the operation */
  signal?: AbortSignal;
  /** Overwrite output file without asking (default: true) */
  overwrite?: boolean;
}

/**
 * Resize options
 */
export interface ResizeOptions {
  /** Target width in pixels. Use -1 to auto-calculate from aspect ratio */
  width?: number;
  /** Target height in pixels. Use -1 to auto-calculate from aspect ratio */
  height?: number;
  /** Scaling algorithm */
  algorithm?: ScaleAlgorithm;
  /** Force exact dimensions (may change aspect ratio) */
  force?: boolean;
}

/**
 * Crop options
 */
export interface CropOptions {
  /** Width of the crop area */
  width: Expr;
  /** Height of the crop area */
  height: Expr;
  /** X position of the crop area (default: centered) */
  x?: Expr;
  /** Y position of the crop area (default: centered) */
  y?: Expr;
}

/**
 * Trim options
 */
export interface TrimOptions {
  /** Start time in seconds */
  start?: number;
  /** End time in seconds */
  end?: number;
  /** Duration in seconds (alternative to end) */
  duration?: number;
}

/**
 * Fade options
 */
export interface FadeOptions {
  /** Type of fade */
  type: "in" | "out";
  /** Start time of the fade in seconds */
  start: number;
  /** Duration of the fade in seconds */
  duration: number;
  /** Color to fade to/from (default: black) */
  color?: string;
}

/**
 * Overlay options
 */
export interface OverlayOptions {
  /** X position of the overlay */
  x?: Expr;
  /** Y position of the overlay */
  y?: Expr;
  /** Enable transparency for the overlay */
  alpha?: boolean;
}
