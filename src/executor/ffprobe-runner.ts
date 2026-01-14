import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Readable } from "node:stream";
import { resolveFFprobe } from "./binary-resolver.js";
import { ExecutionError, InputNotFoundError } from "../errors/index.js";

const execFileAsync = promisify(execFile);

/**
 * Probe result with all media information
 */
export interface ProbeResult {
  /** Format/container information */
  format: FormatInfo;
  /** Video stream information (if present) */
  video?: VideoInfo;
  /** Audio stream information (if present) */
  audio?: AudioInfo;
  /** All streams (raw) */
  streams: StreamInfo[];
}

export interface FormatInfo {
  /** Input filename */
  filename: string;
  /** Duration in seconds */
  duration: number;
  /** File size in bytes */
  size: number;
  /** Overall bitrate in bits per second */
  bitrate: number;
  /** Format short name (e.g., "mov,mp4,m4a,3gp,3g2,mj2") */
  formatName: string;
  /** Format long name */
  formatLongName: string;
  /** Number of streams */
  streamCount: number;
  /** Start time in seconds */
  startTime: number;
  /** Format tags/metadata */
  tags?: Record<string, string>;
}

export interface VideoInfo {
  /** Codec short name (e.g., "h264") */
  codec: string;
  /** Codec long name */
  codecLongName: string;
  /** Video width in pixels */
  width: number;
  /** Video height in pixels */
  height: number;
  /** Display aspect ratio (e.g., "16:9") */
  displayAspectRatio?: string;
  /** Frame rate as number */
  fps: number;
  /** Frame rate as fraction string (e.g., "30000/1001") */
  fpsRatio: string;
  /** Bitrate in bits per second */
  bitrate?: number;
  /** Pixel format (e.g., "yuv420p") */
  pixelFormat: string;
  /** Color space */
  colorSpace?: string;
  /** Rotation in degrees (from metadata) */
  rotation?: number;
  /** Stream duration in seconds */
  duration?: number;
  /** Number of frames (if known) */
  frameCount?: number;
  /** Stream index */
  index: number;
}

export interface AudioInfo {
  /** Codec short name (e.g., "aac") */
  codec: string;
  /** Codec long name */
  codecLongName: string;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Number of channels */
  channels: number;
  /** Channel layout (e.g., "stereo") */
  channelLayout?: string;
  /** Bitrate in bits per second */
  bitrate?: number;
  /** Stream duration in seconds */
  duration?: number;
  /** Stream index */
  index: number;
}

export interface StreamInfo {
  /** Stream index */
  index: number;
  /** Codec type ("video", "audio", "subtitle", etc.) */
  codecType: string;
  /** Codec name */
  codec: string;
  /** All raw properties */
  [key: string]: unknown;
}

/**
 * Run ffprobe and parse the output
 */
export async function probe(input: string | Readable): Promise<ProbeResult> {
  const ffprobePath = await resolveFFprobe();

  // Build args
  const args = [
    "-v", "quiet",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
  ];

  let inputPath: string;

  if (typeof input === "string") {
    inputPath = input;
    args.push(input);
  } else {
    // Stream input - we need to use pipe
    inputPath = "pipe:0";
    args.push("-i", "pipe:0");
    throw new Error("Stream input for probe() is not yet implemented");
  }

  try {
    const { stdout } = await execFileAsync(ffprobePath, args, {
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    const data = JSON.parse(stdout) as {
      format?: Record<string, unknown>;
      streams?: Record<string, unknown>[];
    };

    return parseProbeOutput(data, inputPath);
  } catch (err) {
    if (err instanceof Error) {
      const message = err.message.toLowerCase();
      if (message.includes("no such file") || message.includes("does not exist")) {
        throw new InputNotFoundError(inputPath);
      }
    }
    throw new ExecutionError(
      `FFprobe failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Parse ffprobe JSON output into ProbeResult
 */
function parseProbeOutput(
  data: { format?: Record<string, unknown>; streams?: Record<string, unknown>[] },
  filename: string
): ProbeResult {
  const format = data.format ?? {};
  const streams = data.streams ?? [];

  // Parse format info
  const formatInfo: FormatInfo = {
    filename: (format.filename as string) ?? filename,
    duration: parseFloat(format.duration as string) || 0,
    size: parseInt(format.size as string, 10) || 0,
    bitrate: parseInt(format.bit_rate as string, 10) || 0,
    formatName: (format.format_name as string) ?? "",
    formatLongName: (format.format_long_name as string) ?? "",
    streamCount: parseInt(format.nb_streams as string, 10) || streams.length,
    startTime: parseFloat(format.start_time as string) || 0,
    tags: format.tags as Record<string, string> | undefined,
  };

  // Parse streams
  const parsedStreams: StreamInfo[] = streams.map((s, i) => ({
    index: (s.index as number) ?? i,
    codecType: (s.codec_type as string) ?? "unknown",
    codec: (s.codec_name as string) ?? "unknown",
    ...s,
  }));

  // Find first video stream
  const videoStream = streams.find((s) => s.codec_type === "video");
  let videoInfo: VideoInfo | undefined;

  if (videoStream) {
    const fpsStr = (videoStream.r_frame_rate as string) ?? "0/1";
    const [fpsNum, fpsDen] = fpsStr.split("/").map(Number);
    const fps = fpsDen && fpsDen > 0 ? (fpsNum ?? 0) / fpsDen : 0;

    // Get rotation from side data or display matrix
    let rotation: number | undefined;
    const sideDataList = videoStream.side_data_list as { rotation?: number }[] | undefined;
    if (sideDataList) {
      for (const sideData of sideDataList) {
        if (sideData.rotation !== undefined) {
          rotation = Math.abs(sideData.rotation);
          break;
        }
      }
    }
    // Also check tags
    const tags = videoStream.tags as Record<string, string> | undefined;
    if (!rotation && tags?.rotate) {
      rotation = parseInt(tags.rotate, 10);
    }

    videoInfo = {
      codec: (videoStream.codec_name as string) ?? "unknown",
      codecLongName: (videoStream.codec_long_name as string) ?? "",
      width: (videoStream.width as number) ?? 0,
      height: (videoStream.height as number) ?? 0,
      displayAspectRatio: videoStream.display_aspect_ratio as string | undefined,
      fps,
      fpsRatio: fpsStr,
      bitrate: videoStream.bit_rate ? parseInt(videoStream.bit_rate as string, 10) : undefined,
      pixelFormat: (videoStream.pix_fmt as string) ?? "unknown",
      colorSpace: videoStream.color_space as string | undefined,
      rotation,
      duration: videoStream.duration ? parseFloat(videoStream.duration as string) : undefined,
      frameCount: videoStream.nb_frames ? parseInt(videoStream.nb_frames as string, 10) : undefined,
      index: (videoStream.index as number) ?? 0,
    };
  }

  // Find first audio stream
  const audioStream = streams.find((s) => s.codec_type === "audio");
  let audioInfo: AudioInfo | undefined;

  if (audioStream) {
    audioInfo = {
      codec: (audioStream.codec_name as string) ?? "unknown",
      codecLongName: (audioStream.codec_long_name as string) ?? "",
      sampleRate: parseInt(audioStream.sample_rate as string, 10) || 0,
      channels: (audioStream.channels as number) ?? 0,
      channelLayout: audioStream.channel_layout as string | undefined,
      bitrate: audioStream.bit_rate ? parseInt(audioStream.bit_rate as string, 10) : undefined,
      duration: audioStream.duration ? parseFloat(audioStream.duration as string) : undefined,
      index: (audioStream.index as number) ?? 0,
    };
  }

  return {
    format: formatInfo,
    video: videoInfo,
    audio: audioInfo,
    streams: parsedStreams,
  };
}
