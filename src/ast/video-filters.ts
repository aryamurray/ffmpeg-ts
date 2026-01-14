import type { Expr, ScaleAlgorithm } from "../utils/types.js";

/**
 * Union type of all supported video filters
 */
export type VideoFilter =
  | ScaleFilter
  | CropFilter
  | FpsFilter
  | TrimFilter
  | FadeFilter
  | RotateFilter
  | FlipFilter
  | TransposeFilter
  | OverlayFilter
  | PadFilter
  | SetSarFilter
  | SetDarFilter
  | FormatFilter;

/**
 * Scale (resize) filter
 */
export interface ScaleFilter {
  kind: "scale";
  /** Target width (-1 for auto based on height) */
  width?: number;
  /** Target height (-1 for auto based on width) */
  height?: number;
  /** Scaling algorithm */
  algorithm?: ScaleAlgorithm;
  /** Force exact dimensions (disable aspect ratio preservation) */
  forceOriginalAspectRatio?: "disable" | "decrease" | "increase";
}

/**
 * Crop filter
 */
export interface CropFilter {
  kind: "crop";
  /** Crop width */
  width: Expr;
  /** Crop height */
  height: Expr;
  /** X position (default: centered) */
  x?: Expr;
  /** Y position (default: centered) */
  y?: Expr;
}

/**
 * FPS (frame rate) filter
 */
export interface FpsFilter {
  kind: "fps";
  /** Target frame rate */
  value: number;
  /** Rounding method */
  round?: "zero" | "inf" | "down" | "up" | "near";
}

/**
 * Trim filter (cut by time)
 */
export interface TrimFilter {
  kind: "trim";
  /** Start time in seconds */
  start?: number;
  /** End time in seconds */
  end?: number;
  /** Duration in seconds */
  duration?: number;
}

/**
 * Fade filter (fade in/out)
 */
export interface FadeFilter {
  kind: "fade";
  /** Fade type */
  type: "in" | "out";
  /** Start time in seconds */
  startTime: number;
  /** Duration of fade in seconds */
  duration: number;
  /** Color to fade to/from (default: black) */
  color?: string;
}

/**
 * Rotate filter
 */
export interface RotateFilter {
  kind: "rotate";
  /** Rotation angle in radians, or expression */
  angle: Expr;
  /** Output width expression */
  outputWidth?: Expr;
  /** Output height expression */
  outputHeight?: Expr;
  /** Fill color for corners */
  fillColor?: string;
}

/**
 * Flip filter (horizontal or vertical)
 */
export interface FlipFilter {
  kind: "flip";
  /** Flip direction */
  direction: "horizontal" | "vertical";
}

/**
 * Transpose filter (rotate 90/180/270)
 */
export interface TransposeFilter {
  kind: "transpose";
  /** 
   * Transpose direction:
   * 0 = 90CounterClockwise + Vertical Flip
   * 1 = 90Clockwise
   * 2 = 90CounterClockwise
   * 3 = 90Clockwise + Vertical Flip
   */
  direction: 0 | 1 | 2 | 3;
}

/**
 * Overlay filter (composite two videos)
 */
export interface OverlayFilter {
  kind: "overlay";
  /** Input reference for the overlay source */
  inputRef: string;
  /** X position expression */
  x: Expr;
  /** Y position expression */
  y: Expr;
  /** Enable transparency */
  enableAlpha?: boolean;
  /** Shortest: end when overlay ends */
  shortest?: boolean;
}

/**
 * Pad filter (add padding/borders)
 */
export interface PadFilter {
  kind: "pad";
  /** Output width */
  width: Expr;
  /** Output height */
  height: Expr;
  /** X position of video in padded area */
  x?: Expr;
  /** Y position of video in padded area */
  y?: Expr;
  /** Padding color */
  color?: string;
}

/**
 * Set Sample Aspect Ratio
 */
export interface SetSarFilter {
  kind: "setsar";
  /** SAR as ratio string (e.g., "1:1") or number */
  sar: string | number;
}

/**
 * Set Display Aspect Ratio
 */
export interface SetDarFilter {
  kind: "setdar";
  /** DAR as ratio string (e.g., "16:9") or number */
  dar: string | number;
}

/**
 * Format filter (pixel format conversion)
 */
export interface FormatFilter {
  kind: "format";
  /** Target pixel formats */
  pixelFormats: string[];
}

/**
 * Helper to create a scale filter
 */
export function scale(width?: number, height?: number, algorithm?: ScaleAlgorithm): ScaleFilter {
  return { kind: "scale", width, height, algorithm };
}

/**
 * Helper to create a crop filter
 */
export function crop(width: Expr, height: Expr, x?: Expr, y?: Expr): CropFilter {
  return { kind: "crop", width, height, x, y };
}

/**
 * Helper to create an fps filter
 */
export function fps(value: number): FpsFilter {
  return { kind: "fps", value };
}

/**
 * Helper to create a trim filter
 */
export function trim(options: { start?: number; end?: number; duration?: number }): TrimFilter {
  return { kind: "trim", ...options };
}

/**
 * Helper to create a fade filter
 */
export function fade(type: "in" | "out", startTime: number, duration: number, color?: string): FadeFilter {
  return { kind: "fade", type, startTime, duration, color };
}
