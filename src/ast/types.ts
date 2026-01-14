import type { Readable, Writable } from "node:stream";
import type { VideoFilter } from "./video-filters.js";
import type { AudioFilter } from "./audio-filters.js";
import type {
  VideoCodec,
  AudioCodec,
  ContainerFormat,
  Preset,
  H264Profile,
  PixelFormat,
} from "../utils/types.js";

/**
 * Complete media processing graph
 */
export interface MediaGraph {
  /** Input sources */
  inputs: MediaInput[];
  /** Video stream processing chains */
  videoStreams: VideoStream[];
  /** Audio stream processing chains */
  audioStreams: AudioStream[];
  /** Output configuration */
  output: OutputConfig;
  /** Global options */
  options: GlobalOptions;
}

/**
 * An input source in the graph
 */
export interface MediaInput {
  /** Unique identifier for this input (used in stream refs) */
  id: string;
  /** File path, URL, or stream */
  source: string | Readable;
  /** Input-specific options */
  options?: InputOptions;
}

/**
 * Options for input sources
 */
export interface InputOptions {
  /** Force input format (useful for streams) */
  format?: string;
  /** Seek to position before decoding (fast seek) */
  seekTo?: number;
  /** Loop input N times (-1 = infinite) */
  loop?: number;
  /** Input frame rate (for raw/image inputs) */
  frameRate?: number;
  /** Input duration limit */
  duration?: number;
}

/**
 * Video stream processing chain
 */
export interface VideoStream {
  /** Reference to input (by id) */
  inputRef: string;
  /** Stream index within input (default: first video stream) */
  streamIndex?: number;
  /** Ordered list of filters to apply */
  filters: VideoFilter[];
  /** Whether this stream is disabled */
  disabled?: boolean;
}

/**
 * Audio stream processing chain
 */
export interface AudioStream {
  /** Reference to input (by id) */
  inputRef: string;
  /** Stream index within input (default: first audio stream) */
  streamIndex?: number;
  /** Ordered list of filters to apply */
  filters: AudioFilter[];
  /** Whether this stream is disabled */
  disabled?: boolean;
}

/**
 * Output configuration
 */
export interface OutputConfig {
  /** Output path or stream */
  destination: string | Writable;
  /** Container format (inferred from extension if not specified) */
  format?: ContainerFormat;
  /** Video codec configuration */
  video?: VideoCodecConfig;
  /** Audio codec configuration */
  audio?: AudioCodecConfig;
  /** Metadata key-value pairs */
  metadata?: Record<string, string>;
  /** Additional output flags */
  flags?: OutputFlags;
}

/**
 * Video codec configuration
 */
export interface VideoCodecConfig {
  /** Video codec */
  codec: VideoCodec;
  /** Target bitrate (e.g., "4M", "4000k") */
  bitrate?: string;
  /** Maximum bitrate for VBR */
  maxBitrate?: string;
  /** Buffer size for rate control */
  bufferSize?: string;
  /** Constant Rate Factor (quality-based encoding) */
  crf?: number;
  /** Encoding preset */
  preset?: Preset;
  /** Codec profile */
  profile?: H264Profile;
  /** Pixel format */
  pixelFormat?: PixelFormat;
  /** Two-pass encoding pass (1 or 2) */
  pass?: 1 | 2;
  /** Additional codec-specific options */
  options?: Record<string, string | number | boolean>;
}

/**
 * Audio codec configuration
 */
export interface AudioCodecConfig {
  /** Audio codec */
  codec: AudioCodec;
  /** Target bitrate (e.g., "192k", "320k") */
  bitrate?: string;
  /** Sample rate in Hz */
  sampleRate?: number;
  /** Number of audio channels */
  channels?: number;
  /** Additional codec-specific options */
  options?: Record<string, string | number | boolean>;
}

/**
 * Output flags and options
 */
export interface OutputFlags {
  /** For MP4: enable streaming (moov at start) */
  fastStart?: boolean;
  /** Shortest: end when shortest input ends */
  shortest?: boolean;
  /** Map all streams from inputs */
  mapAll?: boolean;
}

/**
 * Global processing options
 */
export interface GlobalOptions {
  /** Number of threads (0 = auto) */
  threads?: number;
  /** Overwrite output without asking */
  overwrite?: boolean;
  /** Log level for FFmpeg */
  logLevel?: "quiet" | "panic" | "fatal" | "error" | "warning" | "info" | "verbose" | "debug";
  /** Hardware acceleration method */
  hwAccel?: "auto" | "cuda" | "vaapi" | "videotoolbox" | "qsv" | "d3d11va" | "dxva2";
}

/**
 * Create a default empty media graph
 */
export function createMediaGraph(): MediaGraph {
  return {
    inputs: [],
    videoStreams: [],
    audioStreams: [],
    output: {
      destination: "",
    },
    options: {
      overwrite: true,
    },
  };
}

/**
 * Generate unique input ID
 */
let inputCounter = 0;
export function generateInputId(): string {
  return `input_${inputCounter++}`;
}

/**
 * Reset input counter (for testing)
 */
export function resetInputCounter(): void {
  inputCounter = 0;
}
