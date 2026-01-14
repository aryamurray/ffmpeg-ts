import type { VideoFilter } from "../ast/video-filters.js";
import type { AudioFilter } from "../ast/audio-filters.js";
import type { Expr } from "../utils/types.js";

/**
 * Serialize an expression (number or string) for FFmpeg
 */
function serializeExpr(expr: Expr): string {
  if (typeof expr === "number") {
    return expr.toString();
  }
  return expr;
}

/**
 * Escape special characters in FFmpeg filter values
 */
function escapeValue(value: string): string {
  // Escape backslashes, colons, and single quotes
  return value.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "'\\''");
}

/**
 * Serialize a video filter to FFmpeg filter string
 */
export function serializeVideoFilter(filter: VideoFilter): string {
  switch (filter.kind) {
    case "scale": {
      const parts: string[] = [];
      // Use -2 instead of -1 to ensure dimensions are divisible by 2 (required for h264/h265)
      const w = filter.width ?? -2;
      const h = filter.height ?? -2;
      // When one dimension is set and the other is -1, convert to -2 for codec compatibility
      const effectiveW = w === -1 ? -2 : w;
      const effectiveH = h === -1 ? -2 : h;
      parts.push(`w=${effectiveW}`);
      parts.push(`h=${effectiveH}`);
      if (filter.algorithm) {
        parts.push(`flags=${filter.algorithm}`);
      }
      if (filter.forceOriginalAspectRatio) {
        parts.push(`force_original_aspect_ratio=${filter.forceOriginalAspectRatio}`);
      }
      return `scale=${parts.join(":")}`;
    }

    case "crop": {
      const parts: string[] = [];
      parts.push(`w=${serializeExpr(filter.width)}`);
      parts.push(`h=${serializeExpr(filter.height)}`);
      if (filter.x !== undefined) {
        parts.push(`x=${serializeExpr(filter.x)}`);
      }
      if (filter.y !== undefined) {
        parts.push(`y=${serializeExpr(filter.y)}`);
      }
      return `crop=${parts.join(":")}`;
    }

    case "fps": {
      let result = `fps=${filter.value}`;
      if (filter.round) {
        result += `:round=${filter.round}`;
      }
      return result;
    }

    case "trim": {
      const parts: string[] = [];
      if (filter.start !== undefined) {
        parts.push(`start=${filter.start}`);
      }
      if (filter.end !== undefined) {
        parts.push(`end=${filter.end}`);
      }
      if (filter.duration !== undefined) {
        parts.push(`duration=${filter.duration}`);
      }
      // Need setpts to reset timestamps after trim
      return parts.length > 0 ? `trim=${parts.join(":")},setpts=PTS-STARTPTS` : "null";
    }

    case "fade": {
      const parts: string[] = [];
      parts.push(`t=${filter.type}`);
      parts.push(`st=${filter.startTime}`);
      parts.push(`d=${filter.duration}`);
      if (filter.color) {
        parts.push(`c=${escapeValue(filter.color)}`);
      }
      return `fade=${parts.join(":")}`;
    }

    case "rotate": {
      const parts: string[] = [];
      parts.push(`a=${serializeExpr(filter.angle)}`);
      if (filter.outputWidth !== undefined) {
        parts.push(`ow=${serializeExpr(filter.outputWidth)}`);
      }
      if (filter.outputHeight !== undefined) {
        parts.push(`oh=${serializeExpr(filter.outputHeight)}`);
      }
      if (filter.fillColor) {
        parts.push(`c=${escapeValue(filter.fillColor)}`);
      }
      return `rotate=${parts.join(":")}`;
    }

    case "flip": {
      return filter.direction === "horizontal" ? "hflip" : "vflip";
    }

    case "transpose": {
      return `transpose=${filter.direction}`;
    }

    case "overlay": {
      // For simple compiler, overlay is handled differently
      // This is used in complex filter mode
      const parts: string[] = [];
      parts.push(`x=${serializeExpr(filter.x)}`);
      parts.push(`y=${serializeExpr(filter.y)}`);
      if (filter.enableAlpha) {
        parts.push("format=auto");
      }
      if (filter.shortest) {
        parts.push("shortest=1");
      }
      return `overlay=${parts.join(":")}`;
    }

    case "pad": {
      const parts: string[] = [];
      parts.push(`w=${serializeExpr(filter.width)}`);
      parts.push(`h=${serializeExpr(filter.height)}`);
      if (filter.x !== undefined) {
        parts.push(`x=${serializeExpr(filter.x)}`);
      }
      if (filter.y !== undefined) {
        parts.push(`y=${serializeExpr(filter.y)}`);
      }
      if (filter.color) {
        parts.push(`color=${escapeValue(filter.color)}`);
      }
      return `pad=${parts.join(":")}`;
    }

    case "setsar": {
      return `setsar=${filter.sar}`;
    }

    case "setdar": {
      return `setdar=${filter.dar}`;
    }

    case "format": {
      return `format=${filter.pixelFormats.join("|")}`;
    }

    default: {
      const _exhaustive: never = filter;
      throw new Error(`Unknown video filter: ${(_exhaustive as { kind: string }).kind}`);
    }
  }
}

/**
 * Serialize an audio filter to FFmpeg filter string
 */
export function serializeAudioFilter(filter: AudioFilter): string {
  switch (filter.kind) {
    case "volume": {
      if (typeof filter.value === "number") {
        return `volume=${filter.value}`;
      }
      // Handle dB values
      return `volume=${filter.value}`;
    }

    case "normalize": {
      if (filter.type === "loudnorm") {
        const parts: string[] = [];
        if (filter.targetLoudness !== undefined) {
          parts.push(`I=${filter.targetLoudness}`);
        }
        if (filter.loudnessRange !== undefined) {
          parts.push(`LRA=${filter.loudnessRange}`);
        }
        if (filter.truePeak !== undefined) {
          parts.push(`TP=${filter.truePeak}`);
        }
        return parts.length > 0 ? `loudnorm=${parts.join(":")}` : "loudnorm";
      } else {
        const parts: string[] = [];
        if (filter.frameLength !== undefined) {
          parts.push(`f=${filter.frameLength}`);
        }
        if (filter.gaussSize !== undefined) {
          parts.push(`g=${filter.gaussSize}`);
        }
        return parts.length > 0 ? `dynaudnorm=${parts.join(":")}` : "dynaudnorm";
      }
    }

    case "afade": {
      const parts: string[] = [];
      parts.push(`t=${filter.type}`);
      parts.push(`st=${filter.startTime}`);
      parts.push(`d=${filter.duration}`);
      if (filter.curve) {
        parts.push(`curve=${filter.curve}`);
      }
      return `afade=${parts.join(":")}`;
    }

    case "atrim": {
      const parts: string[] = [];
      if (filter.start !== undefined) {
        parts.push(`start=${filter.start}`);
      }
      if (filter.end !== undefined) {
        parts.push(`end=${filter.end}`);
      }
      if (filter.duration !== undefined) {
        parts.push(`duration=${filter.duration}`);
      }
      // Need asetpts to reset timestamps after trim
      return parts.length > 0 ? `atrim=${parts.join(":")},asetpts=PTS-STARTPTS` : "anull";
    }

    case "aresample": {
      return `aresample=${filter.sampleRate}`;
    }

    case "channelmap": {
      let result = `channelmap=map=${filter.map}`;
      if (filter.channelLayout) {
        result += `:channel_layout=${filter.channelLayout}`;
      }
      return result;
    }

    case "channelmix": {
      // Convert to appropriate channel layout
      const layoutMap: Record<string, string> = {
        mono: "mono",
        stereo: "stereo",
        "5.1": "5.1",
        "7.1": "7.1",
      };
      return `aformat=channel_layouts=${layoutMap[filter.layout] ?? filter.layout}`;
    }

    case "adelay": {
      return `adelay=${filter.delays}`;
    }

    case "highpass": {
      let result = `highpass=f=${filter.frequency}`;
      if (filter.poles !== undefined) {
        result += `:p=${filter.poles}`;
      }
      if (filter.width !== undefined) {
        result += `:w=${filter.width}`;
        if (filter.widthType) {
          result += `:t=${filter.widthType}`;
        }
      }
      return result;
    }

    case "lowpass": {
      let result = `lowpass=f=${filter.frequency}`;
      if (filter.poles !== undefined) {
        result += `:p=${filter.poles}`;
      }
      if (filter.width !== undefined) {
        result += `:w=${filter.width}`;
        if (filter.widthType) {
          result += `:t=${filter.widthType}`;
        }
      }
      return result;
    }

    case "equalizer": {
      let result = `equalizer=f=${filter.frequency}:g=${filter.gain}`;
      result += `:w=${filter.width}`;
      if (filter.widthType) {
        result += `:t=${filter.widthType}`;
      }
      return result;
    }

    default: {
      const _exhaustive: never = filter;
      throw new Error(`Unknown audio filter: ${(_exhaustive as { kind: string }).kind}`);
    }
  }
}

/**
 * Serialize a chain of video filters
 */
export function serializeVideoFilterChain(filters: VideoFilter[]): string {
  if (filters.length === 0) return "";
  return filters.map(serializeVideoFilter).join(",");
}

/**
 * Serialize a chain of audio filters
 */
export function serializeAudioFilterChain(filters: AudioFilter[]): string {
  if (filters.length === 0) return "";
  return filters.map(serializeAudioFilter).join(",");
}
