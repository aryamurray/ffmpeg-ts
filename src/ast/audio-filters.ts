/**
 * Union type of all supported audio filters
 */
export type AudioFilter =
  | VolumeFilter
  | NormalizeFilter
  | AudioFadeFilter
  | AudioTrimFilter
  | ResampleFilter
  | ChannelMapFilter
  | ChannelMixFilter
  | AudioDelayFilter
  | HighpassFilter
  | LowpassFilter
  | EqFilter;

/**
 * Volume adjustment filter
 */
export interface VolumeFilter {
  kind: "volume";
  /** 
   * Volume level:
   * - Number: multiplier (1.0 = original, 0.5 = half, 2.0 = double)
   * - String: can be dB value like "-3dB" or "6dB"
   */
  value: number | string;
  /** 
   * Precision for volume calculation:
   * - fixed: fast but may clip
   * - float: slower but handles overflow
   * - double: slowest, highest precision
   */
  precision?: "fixed" | "float" | "double";
}

/**
 * Audio normalization filter
 */
export interface NormalizeFilter {
  kind: "normalize";
  /** 
   * Normalization type:
   * - loudnorm: EBU R128 loudness normalization
   * - dynaudnorm: dynamic audio normalization
   */
  type: "loudnorm" | "dynaudnorm";
  /** Target integrated loudness (LUFS) for loudnorm (default: -24) */
  targetLoudness?: number;
  /** Target loudness range (LU) for loudnorm */
  loudnessRange?: number;
  /** Target true peak (dBTP) for loudnorm (default: -2) */
  truePeak?: number;
  /** Frame length in ms for dynaudnorm (default: 500) */
  frameLength?: number;
  /** Gaussian filter window size for dynaudnorm */
  gaussSize?: number;
}

/**
 * Audio fade filter
 */
export interface AudioFadeFilter {
  kind: "afade";
  /** Fade type */
  type: "in" | "out";
  /** Start time in seconds */
  startTime: number;
  /** Duration of fade in seconds */
  duration: number;
  /** Fade curve type */
  curve?: AudioFadeCurve;
}

export type AudioFadeCurve =
  | "tri"      // triangular (linear)
  | "qsin"    // quarter sine
  | "hsin"    // half sine
  | "esin"    // exponential sine
  | "log"     // logarithmic
  | "ipar"    // inverted parabola
  | "qua"     // quadratic
  | "cub"     // cubic
  | "squ"     // square root
  | "cbr"     // cubic root
  | "par"     // parabola
  | "exp"     // exponential
  | "iqsin"   // inverted quarter sine
  | "ihsin"   // inverted half sine
  | "dese"    // double exponential seat
  | "desi"    // double exponential sigmoid
  | "losi"    // logistic sigmoid
  | "sinc"    // sine cardinal
  | "isinc";  // inverted sine cardinal

/**
 * Audio trim filter
 */
export interface AudioTrimFilter {
  kind: "atrim";
  /** Start time in seconds */
  start?: number;
  /** End time in seconds */
  end?: number;
  /** Duration in seconds */
  duration?: number;
}

/**
 * Audio resample filter
 */
export interface ResampleFilter {
  kind: "aresample";
  /** Target sample rate in Hz */
  sampleRate: number;
}

/**
 * Channel mapping filter
 */
export interface ChannelMapFilter {
  kind: "channelmap";
  /** Channel mapping string (e.g., "0|1" to swap channels) */
  map: string;
  /** Output channel layout */
  channelLayout?: string;
}

/**
 * Channel mix filter (e.g., stereo to mono)
 */
export interface ChannelMixFilter {
  kind: "channelmix";
  /** Target channel layout */
  layout: "mono" | "stereo" | "5.1" | "7.1";
}

/**
 * Audio delay filter
 */
export interface AudioDelayFilter {
  kind: "adelay";
  /** Delays per channel in milliseconds (e.g., "1000|1000") */
  delays: string;
}

/**
 * High-pass filter
 */
export interface HighpassFilter {
  kind: "highpass";
  /** Cutoff frequency in Hz */
  frequency: number;
  /** Filter poles (1 or 2) */
  poles?: 1 | 2;
  /** Width type and value */
  width?: number;
  widthType?: "h" | "q" | "o" | "s";
}

/**
 * Low-pass filter
 */
export interface LowpassFilter {
  kind: "lowpass";
  /** Cutoff frequency in Hz */
  frequency: number;
  /** Filter poles (1 or 2) */
  poles?: 1 | 2;
  /** Width value */
  width?: number;
  widthType?: "h" | "q" | "o" | "s";
}

/**
 * Equalizer filter
 */
export interface EqFilter {
  kind: "equalizer";
  /** Center frequency in Hz */
  frequency: number;
  /** Bandwidth in Hz */
  width: number;
  widthType?: "h" | "q" | "o" | "s";
  /** Gain in dB */
  gain: number;
}

/**
 * Helper to create a volume filter
 */
export function volume(value: number | string): VolumeFilter {
  return { kind: "volume", value };
}

/**
 * Helper to create a normalize filter
 */
export function normalize(type: "loudnorm" | "dynaudnorm" = "loudnorm"): NormalizeFilter {
  return { kind: "normalize", type };
}

/**
 * Helper to create an audio fade filter
 */
export function afade(type: "in" | "out", startTime: number, duration: number): AudioFadeFilter {
  return { kind: "afade", type, startTime, duration };
}

/**
 * Helper to create an audio trim filter
 */
export function atrim(options: { start?: number; end?: number; duration?: number }): AudioTrimFilter {
  return { kind: "atrim", ...options };
}
