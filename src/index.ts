// Main entry points
export { video } from "./video.js";
export { audio, audioOnly } from "./audio.js";
export { probe } from "./probe.js";
export type { ProbeResult, FormatInfo, VideoInfo, AudioInfo, StreamInfo } from "./probe.js";

// Configuration
export {
  setBinary,
  setFFprobeBinary,
  getBinaryPath,
  getFFprobeBinaryPath,
  getVersion,
} from "./config.js";

// Core classes (for advanced usage)
export { MediaChain, VideoStreamBuilder, AudioStreamBuilder } from "./core/media-chain.js";

// Types
export type {
  InputSource,
  OutputDestination,
  Expr,
  VideoCodec,
  AudioCodec,
  ContainerFormat,
  ScaleAlgorithm,
  Preset,
  H264Profile,
  PixelFormat,
  Progress,
  OutputOptions,
  ResizeOptions,
  CropOptions,
  TrimOptions,
  FadeOptions,
  OverlayOptions,
} from "./utils/types.js";

// AST types (for advanced usage)
export type {
  MediaGraph,
  MediaInput,
  VideoStream,
  AudioStream,
  OutputConfig,
  VideoCodecConfig,
  AudioCodecConfig,
  InputOptions,
  GlobalOptions,
} from "./ast/types.js";

export type { VideoFilter } from "./ast/video-filters.js";
export type { AudioFilter } from "./ast/audio-filters.js";

// Errors
export {
  FFmpegTsError,
  FFmpegNotFoundError,
  FFprobeNotFoundError,
  FFmpegVersionError,
  ValidationError,
  CompilationError,
  ExecutionError,
  InputNotFoundError,
  OutputNotWritableError,
  CodecNotFoundError,
  AbortError,
  IncompatibleFilterError,
  ContainerFormatError,
} from "./errors/index.js";
