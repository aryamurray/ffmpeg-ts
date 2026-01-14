import type { MediaGraph } from "../ast/types.js";
import type { VideoFilter } from "../ast/video-filters.js";
import type { CompilationResult } from "./simple-compiler.js";
import {
  serializeVideoFilter,
  serializeAudioFilter,
} from "./filter-serializers.js";
import { getInputIndex, hasVideoOutput, hasAudioOutput } from "../ast/graph.js";

/**
 * Complex compiler for multi-input or filter graph scenarios
 * Uses -filter_complex with stream labels
 */
export function compileComplex(graph: MediaGraph): CompilationResult {
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

  // Inputs
  for (const input of graph.inputs) {
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

    if (typeof input.source === "string") {
      args.push("-i", input.source);
    } else {
      args.push("-i", "pipe:0");
    }
  }

  // Build filter_complex
  const filterParts: string[] = [];
  let outputVideoLabel = "";
  let outputAudioLabel = "";

  // Process video streams
  const hasVideo = hasVideoOutput(graph);
  if (hasVideo) {
    const videoStream = graph.videoStreams.find(s => !s.disabled);
    if (videoStream) {
      const inputIndex = getInputIndex(graph, videoStream.inputRef);
      let currentLabel = `${inputIndex}:v`;

      // Check for overlay filters and build the chain
      const filters = videoStream.filters;
      const normalFilters: VideoFilter[] = [];
      
      for (const filter of filters) {
        if (filter.kind === "overlay") {
          // Flush normal filters first
          if (normalFilters.length > 0) {
            const filterChain = normalFilters.map(serializeVideoFilter).join(",");
            const nextLabel = `v_${filterParts.length}`;
            filterParts.push(`[${currentLabel}]${filterChain}[${nextLabel}]`);
            currentLabel = nextLabel;
            normalFilters.length = 0;
          }

          // Handle overlay
          const overlayInputIndex = getInputIndex(graph, filter.inputRef);
          const overlayLabel = `${overlayInputIndex}:v`;
          const nextLabel = `v_${filterParts.length}`;
          
          const overlayFilter = serializeVideoFilter(filter);
          filterParts.push(`[${currentLabel}][${overlayLabel}]${overlayFilter}[${nextLabel}]`);
          currentLabel = nextLabel;
        } else {
          normalFilters.push(filter);
        }
      }

      // Remaining normal filters
      if (normalFilters.length > 0) {
        const filterChain = normalFilters.map(serializeVideoFilter).join(",");
        const nextLabel = `v_out`;
        filterParts.push(`[${currentLabel}]${filterChain}[${nextLabel}]`);
        outputVideoLabel = nextLabel;
      } else if (filterParts.length > 0) {
        // Last filter's output is video output
        outputVideoLabel = `v_${filterParts.length - 1}`;
        // Update the last filter to use v_out label
        const lastPart = filterParts[filterParts.length - 1]!;
        filterParts[filterParts.length - 1] = lastPart.replace(/\[[^\]]+\]$/, "[v_out]");
        outputVideoLabel = "v_out";
      } else {
        // No filters, just use input directly
        outputVideoLabel = currentLabel;
      }
    }
  }

  // Process audio streams
  const hasAudio = hasAudioOutput(graph);
  if (hasAudio) {
    const audioStream = graph.audioStreams.find(s => !s.disabled);
    if (audioStream && audioStream.filters.length > 0) {
      const inputIndex = getInputIndex(graph, audioStream.inputRef);
      const currentLabel = `${inputIndex}:a`;
      
      const filterChain = audioStream.filters.map(serializeAudioFilter).join(",");
      filterParts.push(`[${currentLabel}]${filterChain}[a_out]`);
      outputAudioLabel = "a_out";
    } else if (audioStream) {
      const inputIndex = getInputIndex(graph, audioStream.inputRef);
      outputAudioLabel = `${inputIndex}:a`;
    }
  }

  // Add filter_complex if we have filters
  if (filterParts.length > 0) {
    args.push("-filter_complex", filterParts.join(";"));
  }

  // Map outputs
  if (hasVideo && outputVideoLabel) {
    if (filterParts.length > 0 && outputVideoLabel.includes("_")) {
      args.push("-map", `[${outputVideoLabel}]`);
    } else {
      args.push("-map", outputVideoLabel);
    }
  }

  if (hasAudio && outputAudioLabel) {
    if (filterParts.length > 0 && outputAudioLabel.includes("_")) {
      args.push("-map", `[${outputAudioLabel}]`);
    } else {
      args.push("-map", outputAudioLabel);
    }
  }

  // Video codec settings
  if (graph.output.video) {
    const v = graph.output.video;

    if (v.codec === "copy") {
      args.push("-c:v", "copy");
    } else {
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

      if (v.bitrate) args.push("-b:v", v.bitrate);
      if (v.maxBitrate) args.push("-maxrate", v.maxBitrate);
      if (v.bufferSize) args.push("-bufsize", v.bufferSize);
      if (v.crf !== undefined) args.push("-crf", v.crf.toString());
      if (v.preset) args.push("-preset", v.preset);
      if (v.profile) args.push("-profile:v", v.profile);
      if (v.pixelFormat) args.push("-pix_fmt", v.pixelFormat);

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
    args.push("-vn");
  }

  // Audio codec settings
  if (graph.output.audio) {
    const a = graph.output.audio;

    if (a.codec === "copy") {
      args.push("-c:a", "copy");
    } else {
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

      if (a.bitrate) args.push("-b:a", a.bitrate);
      if (a.sampleRate) args.push("-ar", a.sampleRate.toString());
      if (a.channels) args.push("-ac", a.channels.toString());

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

  // Output format
  if (graph.output.format) {
    args.push("-f", graph.output.format);
  }

  // Output destination
  if (typeof graph.output.destination === "string") {
    args.push(graph.output.destination);
  } else {
    args.push("pipe:1");
  }

  return { args };
}
