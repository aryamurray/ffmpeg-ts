import type { MediaGraph } from "../ast/types.js";
import { serializeVideoFilterChain, serializeAudioFilterChain } from "./filter-serializers.js";
import { hasVideoOutput, hasAudioOutput } from "../ast/graph.js";

/**
 * Compilation result
 */
export interface CompilationResult {
  args: string[];
}

/**
 * Simple compiler for single-input, single-output graphs
 * Uses -vf and -af instead of -filter_complex
 */
export function compileSimple(graph: MediaGraph): CompilationResult {
  const args: string[] = [];

  // Global options
  if (graph.options.overwrite) {
    args.push("-y");
  }

  if (graph.options.logLevel) {
    args.push("-loglevel", graph.options.logLevel);
  }

  if (graph.options.threads !== undefined) {
    args.push("-threads", graph.options.threads.toString());
  }

  if (graph.options.hwAccel) {
    args.push("-hwaccel", graph.options.hwAccel);
  }

  // Input(s)
  for (const input of graph.inputs) {
    // Input options
    if (input.options?.seekTo !== undefined) {
      args.push("-ss", input.options.seekTo.toString());
    }
    if (input.options?.duration !== undefined) {
      args.push("-t", input.options.duration.toString());
    }
    if (input.options?.format) {
      args.push("-f", input.options.format);
    }
    if (input.options?.frameRate !== undefined) {
      args.push("-r", input.options.frameRate.toString());
    }
    if (input.options?.loop !== undefined) {
      args.push("-stream_loop", input.options.loop.toString());
    }

    // Input source
    if (typeof input.source === "string") {
      args.push("-i", input.source);
    } else {
      // Stream input
      args.push("-i", "pipe:0");
    }
  }

  // Video filter chain
  const hasVideo = hasVideoOutput(graph);
  if (hasVideo) {
    const videoStream = graph.videoStreams.find(s => !s.disabled);
    if (videoStream && videoStream.filters.length > 0) {
      const vf = serializeVideoFilterChain(videoStream.filters);
      if (vf) {
        args.push("-vf", vf);
      }
    }
  }

  // Audio filter chain
  const hasAudio = hasAudioOutput(graph);
  if (hasAudio) {
    const audioStream = graph.audioStreams.find(s => !s.disabled);
    if (audioStream && audioStream.filters.length > 0) {
      const af = serializeAudioFilterChain(audioStream.filters);
      if (af) {
        args.push("-af", af);
      }
    }
  }

  // Video codec settings
  if (graph.output.video) {
    const v = graph.output.video;

    if (v.codec === "copy") {
      args.push("-c:v", "copy");
    } else {
      // Map codec names
      const codecMap: Record<string, string> = {
        h264: "libx264",
        h265: "libx265",
        hevc: "libx265",
        vp9: "libvpx-vp9",
        vp8: "libvpx",
        av1: "libaom-av1",
        mpeg4: "mpeg4",
        prores: "prores_ks",
      };

      const encoder = codecMap[v.codec] ?? v.codec;
      args.push("-c:v", encoder);

      if (v.bitrate) {
        args.push("-b:v", v.bitrate);
      }
      if (v.maxBitrate) {
        args.push("-maxrate", v.maxBitrate);
      }
      if (v.bufferSize) {
        args.push("-bufsize", v.bufferSize);
      }
      if (v.crf !== undefined) {
        args.push("-crf", v.crf.toString());
      }
      if (v.preset) {
        args.push("-preset", v.preset);
      }
      if (v.profile) {
        args.push("-profile:v", v.profile);
      }
      if (v.pixelFormat) {
        args.push("-pix_fmt", v.pixelFormat);
      }

      // Additional options
      if (v.options) {
        for (const [key, value] of Object.entries(v.options)) {
          if (typeof value === "boolean") {
            if (value) args.push(`-${key}`);
          } else {
            args.push(`-${key}`, value.toString());
          }
        }
      }
    }
  } else if (!hasVideo) {
    // No video output
    args.push("-vn");
  }

  // Audio codec settings
  if (graph.output.audio) {
    const a = graph.output.audio;

    if (a.codec === "copy") {
      args.push("-c:a", "copy");
    } else {
      // Map codec names
      const codecMap: Record<string, string> = {
        aac: "aac",
        mp3: "libmp3lame",
        opus: "libopus",
        vorbis: "libvorbis",
        flac: "flac",
        ac3: "ac3",
        pcm_s16le: "pcm_s16le",
      };

      const encoder = codecMap[a.codec] ?? a.codec;
      args.push("-c:a", encoder);

      if (a.bitrate) {
        args.push("-b:a", a.bitrate);
      }
      if (a.sampleRate) {
        args.push("-ar", a.sampleRate.toString());
      }
      if (a.channels) {
        args.push("-ac", a.channels.toString());
      }

      // Additional options
      if (a.options) {
        for (const [key, value] of Object.entries(a.options)) {
          if (typeof value === "boolean") {
            if (value) args.push(`-${key}`);
          } else {
            args.push(`-${key}`, value.toString());
          }
        }
      }
    }
  } else if (!hasAudio) {
    // No audio output
    args.push("-an");
  }

  // Metadata
  if (graph.output.metadata) {
    for (const [key, value] of Object.entries(graph.output.metadata)) {
      args.push("-metadata", `${key}=${value}`);
    }
  }

  // Output flags
  if (graph.output.flags) {
    if (graph.output.flags.fastStart) {
      args.push("-movflags", "+faststart");
    }
    if (graph.output.flags.shortest) {
      args.push("-shortest");
    }
  }

  // Output format (if specified)
  if (graph.output.format) {
    args.push("-f", graph.output.format);
  }

  // Output destination
  if (typeof graph.output.destination === "string") {
    args.push(graph.output.destination);
  } else {
    // Stream output
    args.push("pipe:1");
  }

  return { args };
}
