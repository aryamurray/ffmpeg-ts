import type { Readable, Writable } from "node:stream";
import {
  type MediaGraph,
  type MediaInput,
  type VideoStream,
  type AudioStream,
  type OutputConfig,
  type VideoCodecConfig,
  type AudioCodecConfig,
  createMediaGraph,
  generateInputId,
} from "../ast/types.js";
import type { VideoFilter } from "../ast/video-filters.js";
import type { AudioFilter } from "../ast/audio-filters.js";
import { addVideoFilter, addAudioFilter } from "../ast/graph.js";
import { assertValid } from "../ast/validation.js";
import { compile } from "../compiler/index.js";
import { runFFmpeg } from "../executor/ffmpeg-runner.js";
import type {
  InputSource,
  OutputDestination,
  VideoCodec,
  AudioCodec,
  ContainerFormat,
  Preset,
  H264Profile,
  PixelFormat,
  ScaleAlgorithm,
  Progress,
  OutputOptions,
  ResizeOptions,
  CropOptions,
  TrimOptions,
  FadeOptions,
  OverlayOptions,
  Expr,
} from "../utils/types.js";

/**
 * Callback for progress updates
 */
type ProgressCallback = (progress: Progress) => void;

/**
 * VideoStreamBuilder for configuring video stream with sub-builder pattern
 */
export class VideoStreamBuilder {
  constructor(private chain: MediaChain) {}

  /** Scale/resize the video */
  scale(width: number, height?: number, algorithm?: ScaleAlgorithm): this {
    this.chain.addVideoFilterInternal({
      kind: "scale",
      width,
      height: height ?? -1,
      algorithm,
    });
    return this;
  }

  /** Crop the video */
  crop(options: CropOptions): this {
    this.chain.addVideoFilterInternal({
      kind: "crop",
      width: options.width,
      height: options.height,
      x: options.x,
      y: options.y,
    });
    return this;
  }

  /** Set frame rate */
  fps(value: number): this {
    this.chain.addVideoFilterInternal({ kind: "fps", value });
    return this;
  }

  /** Trim video by time */
  trim(options: TrimOptions): this {
    this.chain.addVideoFilterInternal({
      kind: "trim",
      start: options.start,
      end: options.end,
      duration: options.duration,
    });
    return this;
  }

  /** Add fade in/out effect */
  fade(options: FadeOptions): this {
    this.chain.addVideoFilterInternal({
      kind: "fade",
      type: options.type,
      startTime: options.start,
      duration: options.duration,
      color: options.color,
    });
    return this;
  }

  /** Rotate video by angle (in degrees) */
  rotate(degrees: number): this {
    // Convert degrees to radians for FFmpeg
    const radians = (degrees * Math.PI) / 180;
    this.chain.addVideoFilterInternal({
      kind: "rotate",
      angle: radians,
    });
    return this;
  }

  /** Flip video horizontally or vertically */
  flip(direction: "horizontal" | "vertical"): this {
    this.chain.addVideoFilterInternal({ kind: "flip", direction });
    return this;
  }

  /** Transpose (rotate 90/180/270 degrees) */
  transpose(direction: 0 | 1 | 2 | 3): this {
    this.chain.addVideoFilterInternal({ kind: "transpose", direction });
    return this;
  }

  /** Add padding around video */
  pad(width: Expr, height: Expr, x?: Expr, y?: Expr, color?: string): this {
    this.chain.addVideoFilterInternal({
      kind: "pad",
      width,
      height,
      x,
      y,
      color,
    });
    return this;
  }

  /** Convert pixel format */
  format(pixelFormats: string | string[]): this {
    this.chain.addVideoFilterInternal({
      kind: "format",
      pixelFormats: Array.isArray(pixelFormats) ? pixelFormats : [pixelFormats],
    });
    return this;
  }
}

/**
 * AudioStreamBuilder for configuring audio stream with sub-builder pattern
 */
export class AudioStreamBuilder {
  constructor(private chain: MediaChain) {}

  /** Adjust volume */
  volume(value: number | string): this {
    this.chain.addAudioFilterInternal({ kind: "volume", value });
    return this;
  }

  /** Normalize audio levels */
  normalize(type: "loudnorm" | "dynaudnorm" = "loudnorm"): this {
    this.chain.addAudioFilterInternal({ kind: "normalize", type });
    return this;
  }

  /** Add audio fade */
  fade(options: FadeOptions): this {
    this.chain.addAudioFilterInternal({
      kind: "afade",
      type: options.type,
      startTime: options.start,
      duration: options.duration,
    });
    return this;
  }

  /** Trim audio by time */
  trim(options: TrimOptions): this {
    this.chain.addAudioFilterInternal({
      kind: "atrim",
      start: options.start,
      end: options.end,
      duration: options.duration,
    });
    return this;
  }

  /** Resample audio */
  sampleRate(rate: number): this {
    this.chain.addAudioFilterInternal({ kind: "aresample", sampleRate: rate });
    return this;
  }

  /** Set bitrate (applied at codec level) */
  bitrate(value: string): this {
    this.chain.audioBitrate(value);
    return this;
  }

  /** Apply high-pass filter */
  highpass(frequency: number): this {
    this.chain.addAudioFilterInternal({ kind: "highpass", frequency });
    return this;
  }

  /** Apply low-pass filter */
  lowpass(frequency: number): this {
    this.chain.addAudioFilterInternal({ kind: "lowpass", frequency });
    return this;
  }
}

/**
 * Main fluent builder for media processing
 */
export class MediaChain {
  private graph: MediaGraph;
  private primaryInputId: string | null = null;
  private progressCallback: ProgressCallback | null = null;
  private inputDuration: number | null = null;

  constructor() {
    this.graph = createMediaGraph();
  }

  // === Input Methods ===

  /**
   * Add an input source
   */
  input(source: InputSource, options?: { format?: string; seekTo?: number }): this {
    const id = generateInputId();
    const input: MediaInput = {
      id,
      source,
      options,
    };
    this.graph.inputs.push(input);

    // First input becomes primary
    if (!this.primaryInputId) {
      this.primaryInputId = id;

      // Create default video and audio streams for primary input
      this.graph.videoStreams.push({
        inputRef: id,
        filters: [],
      });
      this.graph.audioStreams.push({
        inputRef: id,
        filters: [],
      });
    }

    return this;
  }

  /**
   * Set input format (useful for streams)
   */
  inputFormat(format: string): this {
    const input = this.graph.inputs[this.graph.inputs.length - 1];
    if (input) {
      input.options = { ...input.options, format };
    }
    return this;
  }

  // === Simple Video Methods (apply to primary stream) ===

  /**
   * Resize video
   */
  resize(options: ResizeOptions): this {
    this.addVideoFilterInternal({
      kind: "scale",
      width: options.width ?? -1,
      height: options.height ?? -1,
      algorithm: options.algorithm,
      forceOriginalAspectRatio: options.force ? "disable" : undefined,
    });
    return this;
  }

  /**
   * Scale video to specific dimensions
   */
  scale(width: number, height?: number): this {
    this.addVideoFilterInternal({
      kind: "scale",
      width,
      height: height ?? -1,
    });
    return this;
  }

  /**
   * Crop video
   */
  crop(options: CropOptions): this {
    this.addVideoFilterInternal({
      kind: "crop",
      width: options.width,
      height: options.height,
      x: options.x,
      y: options.y,
    });
    return this;
  }

  /**
   * Set frame rate
   */
  fps(value: number): this {
    this.addVideoFilterInternal({ kind: "fps", value });
    return this;
  }

  /**
   * Rotate video by degrees
   */
  rotate(degrees: number): this {
    const radians = (degrees * Math.PI) / 180;
    this.addVideoFilterInternal({ kind: "rotate", angle: radians });
    return this;
  }

  /**
   * Flip video
   */
  flip(direction: "horizontal" | "vertical"): this {
    this.addVideoFilterInternal({ kind: "flip", direction });
    return this;
  }

  /**
   * Trim video by time
   */
  trim(options: TrimOptions): this {
    this.addVideoFilterInternal({
      kind: "trim",
      start: options.start,
      end: options.end,
      duration: options.duration,
    });
    // Also trim audio to match
    this.addAudioFilterInternal({
      kind: "atrim",
      start: options.start,
      end: options.end,
      duration: options.duration,
    });
    return this;
  }

  /**
   * Add fade effect
   */
  fade(options: FadeOptions): this {
    this.addVideoFilterInternal({
      kind: "fade",
      type: options.type,
      startTime: options.start,
      duration: options.duration,
      color: options.color,
    });
    return this;
  }

  // === Sub-builder Methods ===

  /**
   * Configure video stream using sub-builder
   */
  video(fn: (v: VideoStreamBuilder) => void): this {
    fn(new VideoStreamBuilder(this));
    return this;
  }

  /**
   * Configure audio stream using sub-builder
   */
  audio(fn: (a: AudioStreamBuilder) => void): this {
    fn(new AudioStreamBuilder(this));
    return this;
  }

  // === Simple Audio Methods ===

  /**
   * Mute audio (remove audio stream)
   */
  mute(): this {
    for (const stream of this.graph.audioStreams) {
      stream.disabled = true;
    }
    return this;
  }

  /**
   * Adjust volume
   */
  volume(value: number | string): this {
    this.addAudioFilterInternal({ kind: "volume", value });
    return this;
  }

  /**
   * Normalize audio
   */
  normalize(type: "loudnorm" | "dynaudnorm" = "loudnorm"): this {
    this.addAudioFilterInternal({ kind: "normalize", type });
    return this;
  }

  // === Multi-input Methods ===

  /**
   * Overlay another video on top
   */
  overlay(source: MediaChain | string, options: OverlayOptions = {}): this {
    // Add the overlay source as an input
    const overlaySource = typeof source === "string" ? source : source.graph.inputs[0]?.source;
    if (!overlaySource) {
      throw new Error("Overlay source is required");
    }

    const overlayId = generateInputId();
    this.graph.inputs.push({
      id: overlayId,
      source: overlaySource as string | Readable,
    });

    // Add overlay filter
    this.addVideoFilterInternal({
      kind: "overlay",
      inputRef: overlayId,
      x: options.x ?? 0,
      y: options.y ?? 0,
      enableAlpha: options.alpha,
    });

    return this;
  }

  // === Output Configuration ===

  /**
   * Set video codec
   */
  codec(codec: VideoCodec): this {
    this.ensureVideoCodecConfig();
    this.graph.output.video!.codec = codec;
    return this;
  }

  /**
   * Set audio codec
   */
  audioCodec(codec: AudioCodec): this {
    this.ensureAudioCodecConfig();
    this.graph.output.audio!.codec = codec;
    return this;
  }

  /**
   * Set video bitrate
   */
  bitrate(value: string): this {
    this.ensureVideoCodecConfig();
    this.graph.output.video!.bitrate = value;
    return this;
  }

  /**
   * Set audio bitrate
   */
  audioBitrate(value: string): this {
    this.ensureAudioCodecConfig();
    this.graph.output.audio!.bitrate = value;
    return this;
  }

  /**
   * Set CRF (Constant Rate Factor) for quality-based encoding
   */
  crf(value: number): this {
    this.ensureVideoCodecConfig();
    this.graph.output.video!.crf = value;
    return this;
  }

  /**
   * Set encoding preset
   */
  preset(value: Preset): this {
    this.ensureVideoCodecConfig();
    this.graph.output.video!.preset = value;
    return this;
  }

  /**
   * Set codec profile
   */
  profile(value: H264Profile): this {
    this.ensureVideoCodecConfig();
    this.graph.output.video!.profile = value;
    return this;
  }

  /**
   * Set pixel format
   */
  pixelFormat(value: PixelFormat): this {
    this.ensureVideoCodecConfig();
    this.graph.output.video!.pixelFormat = value;
    return this;
  }

  /**
   * Set container format
   */
  container(format: ContainerFormat): this {
    this.graph.output.format = format;
    return this;
  }

  /**
   * Alias for container()
   */
  format(format: ContainerFormat): this {
    return this.container(format);
  }

  /**
   * Set output metadata
   */
  metadata(key: string, value: string): this {
    if (!this.graph.output.metadata) {
      this.graph.output.metadata = {};
    }
    this.graph.output.metadata[key] = value;
    return this;
  }

  /**
   * Enable fast start for MP4 (moov atom at beginning)
   */
  fastStart(): this {
    if (!this.graph.output.flags) {
      this.graph.output.flags = {};
    }
    this.graph.output.flags.fastStart = true;
    return this;
  }

  // === Progress & Control ===

  /**
   * Set progress callback
   */
  onProgress(callback: ProgressCallback): this {
    this.progressCallback = callback;
    return this;
  }

  /**
   * Set known input duration (for accurate progress percentage)
   */
  duration(seconds: number): this {
    this.inputDuration = seconds;
    return this;
  }

  // === Execution ===

  /**
   * Save to file
   */
  async save(path: string, options?: OutputOptions): Promise<void> {
    this.graph.output.destination = path;
    await this.execute(options);
  }

  /**
   * Pipe to writable stream
   */
  async pipe(stream: Writable, options?: OutputOptions): Promise<void> {
    this.graph.output.destination = stream;

    // Require format for stream output
    if (!this.graph.output.format) {
      throw new Error(
        "Container format must be specified for stream output. Use .format() or .container() before .pipe()"
      );
    }

    await this.execute(options);
  }

  /**
   * Get output as Buffer
   */
  async toBuffer(options?: OutputOptions): Promise<Buffer> {
    const { PassThrough } = await import("node:stream");
    const chunks: Buffer[] = [];
    const passThrough = new PassThrough();

    passThrough.on("data", (chunk: Buffer) => chunks.push(chunk));

    // Require format for buffer output
    if (!this.graph.output.format) {
      throw new Error(
        "Container format must be specified for buffer output. Use .format() or .container() before .toBuffer()"
      );
    }

    this.graph.output.destination = passThrough;
    await this.execute(options);

    return Buffer.concat(chunks);
  }

  // === Debugging ===

  /**
   * Get the compiled FFmpeg arguments (for debugging)
   */
  toArgs(): string[] {
    assertValid(this.graph);
    return compile(this.graph).args;
  }

  /**
   * Get the internal graph representation (for debugging)
   */
  toGraph(): MediaGraph {
    return this.graph;
  }

  // === Internal Methods ===

  /** @internal */
  addVideoFilterInternal(filter: VideoFilter): void {
    if (this.graph.videoStreams.length === 0) {
      // Create a video stream if none exists
      if (this.primaryInputId) {
        this.graph.videoStreams.push({
          inputRef: this.primaryInputId,
          filters: [],
        });
      } else {
        throw new Error("Cannot add video filter: no input specified");
      }
    }
    addVideoFilter(this.graph, filter);
  }

  /** @internal */
  addAudioFilterInternal(filter: AudioFilter): void {
    if (this.graph.audioStreams.length === 0) {
      // Create an audio stream if none exists
      if (this.primaryInputId) {
        this.graph.audioStreams.push({
          inputRef: this.primaryInputId,
          filters: [],
        });
      } else {
        throw new Error("Cannot add audio filter: no input specified");
      }
    }
    addAudioFilter(this.graph, filter);
  }

  private ensureVideoCodecConfig(): void {
    if (!this.graph.output.video) {
      this.graph.output.video = { codec: "h264" };
    }
  }

  private ensureAudioCodecConfig(): void {
    if (!this.graph.output.audio) {
      this.graph.output.audio = { codec: "aac" };
    }
  }

  private async execute(options?: OutputOptions): Promise<void> {
    assertValid(this.graph);

    const compiled = compile(this.graph);

    await runFFmpeg({
      args: compiled.args,
      signal: options?.signal,
      onProgress: this.progressCallback ?? undefined,
      duration: this.inputDuration ?? undefined,
      stdin:
        typeof this.graph.inputs[0]?.source !== "string"
          ? (this.graph.inputs[0]?.source as Readable)
          : undefined,
      stdout:
        typeof this.graph.output.destination !== "string"
          ? (this.graph.output.destination as Writable)
          : undefined,
    });
  }
}
