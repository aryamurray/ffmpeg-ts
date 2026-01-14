import type { MediaGraph } from "./types.js";
import type { VideoFilter } from "./video-filters.js";
import type { AudioFilter } from "./audio-filters.js";
import { ValidationError } from "../errors/index.js";
import { getInputIds, getReferencedInputs } from "./graph.js";

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

/**
 * Validate a media graph before compilation
 */
export function validateGraph(graph: MediaGraph): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Must have at least one input
  if (graph.inputs.length === 0) {
    errors.push(new ValidationError("At least one input is required"));
  }

  // Must have an output destination
  if (!graph.output.destination) {
    errors.push(new ValidationError("Output destination is required"));
  }

  // All referenced inputs must exist
  const inputIds = getInputIds(graph);
  const referencedInputs = getReferencedInputs(graph);

  for (const ref of referencedInputs) {
    if (!inputIds.has(ref)) {
      errors.push(new ValidationError(`Referenced input "${ref}" does not exist`));
    }
  }

  // Validate video streams
  for (let i = 0; i < graph.videoStreams.length; i++) {
    const stream = graph.videoStreams[i]!;
    
    if (!inputIds.has(stream.inputRef)) {
      errors.push(new ValidationError(`Video stream ${i} references non-existent input "${stream.inputRef}"`));
    }

    // Validate each filter
    for (const filter of stream.filters) {
      const filterErrors = validateVideoFilter(filter, inputIds);
      errors.push(...filterErrors);
    }
  }

  // Validate audio streams
  for (let i = 0; i < graph.audioStreams.length; i++) {
    const stream = graph.audioStreams[i]!;
    
    if (!inputIds.has(stream.inputRef)) {
      errors.push(new ValidationError(`Audio stream ${i} references non-existent input "${stream.inputRef}"`));
    }

    // Validate each filter
    for (const filter of stream.filters) {
      const filterErrors = validateAudioFilter(filter);
      errors.push(...filterErrors);
    }
  }

  // Validate codec configuration
  if (graph.output.video) {
    if (graph.output.video.crf !== undefined) {
      if (graph.output.video.crf < 0 || graph.output.video.crf > 63) {
        errors.push(new ValidationError("CRF must be between 0 and 63", "crf"));
      }
    }
  }

  // Warn about potential issues
  if (graph.videoStreams.length === 0 && graph.audioStreams.length === 0) {
    warnings.push("No video or audio streams configured - output may be empty");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a video filter
 */
function validateVideoFilter(filter: VideoFilter, inputIds: Set<string>): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (filter.kind) {
    case "scale":
      if (filter.width !== undefined && filter.width !== -1 && filter.width !== -2 && filter.width <= 0) {
        errors.push(new ValidationError("Width must be positive or -1/-2 for auto", "scale.width"));
      }
      if (filter.height !== undefined && filter.height !== -1 && filter.height !== -2 && filter.height <= 0) {
        errors.push(new ValidationError("Height must be positive or -1/-2 for auto", "scale.height"));
      }
      break;

    case "fps":
      if (filter.value <= 0 || filter.value > 240) {
        errors.push(new ValidationError("FPS must be between 1 and 240", "fps.value"));
      }
      break;

    case "trim":
      if (filter.start !== undefined && filter.start < 0) {
        errors.push(new ValidationError("Start time cannot be negative", "trim.start"));
      }
      if (filter.end !== undefined && filter.end < 0) {
        errors.push(new ValidationError("End time cannot be negative", "trim.end"));
      }
      if (filter.start !== undefined && filter.end !== undefined && filter.start >= filter.end) {
        errors.push(new ValidationError("Start time must be before end time", "trim"));
      }
      if (filter.duration !== undefined && filter.duration <= 0) {
        errors.push(new ValidationError("Duration must be positive", "trim.duration"));
      }
      break;

    case "fade":
      if (filter.startTime < 0) {
        errors.push(new ValidationError("Fade start time cannot be negative", "fade.startTime"));
      }
      if (filter.duration <= 0) {
        errors.push(new ValidationError("Fade duration must be positive", "fade.duration"));
      }
      break;

    case "overlay":
      if (!inputIds.has(filter.inputRef)) {
        errors.push(new ValidationError(`Overlay references non-existent input "${filter.inputRef}"`, "overlay.inputRef"));
      }
      break;

    case "crop":
      // Crop dimensions can be expressions, so we can't fully validate
      break;

    case "rotate":
      // Rotation angle can be expressions, so we can't fully validate
      break;
  }

  return errors;
}

/**
 * Validate an audio filter
 */
function validateAudioFilter(filter: AudioFilter): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (filter.kind) {
    case "volume":
      if (typeof filter.value === "number" && filter.value < 0) {
        errors.push(new ValidationError("Volume cannot be negative", "volume.value"));
      }
      break;

    case "atrim":
      if (filter.start !== undefined && filter.start < 0) {
        errors.push(new ValidationError("Start time cannot be negative", "atrim.start"));
      }
      if (filter.end !== undefined && filter.end < 0) {
        errors.push(new ValidationError("End time cannot be negative", "atrim.end"));
      }
      if (filter.start !== undefined && filter.end !== undefined && filter.start >= filter.end) {
        errors.push(new ValidationError("Start time must be before end time", "atrim"));
      }
      break;

    case "afade":
      if (filter.startTime < 0) {
        errors.push(new ValidationError("Fade start time cannot be negative", "afade.startTime"));
      }
      if (filter.duration <= 0) {
        errors.push(new ValidationError("Fade duration must be positive", "afade.duration"));
      }
      break;

    case "aresample":
      if (filter.sampleRate <= 0) {
        errors.push(new ValidationError("Sample rate must be positive", "aresample.sampleRate"));
      }
      if (filter.sampleRate < 8000 || filter.sampleRate > 192000) {
        errors.push(new ValidationError("Sample rate should be between 8000 and 192000 Hz", "aresample.sampleRate"));
      }
      break;

    case "highpass":
    case "lowpass":
      if (filter.frequency <= 0) {
        errors.push(new ValidationError("Frequency must be positive", `${filter.kind}.frequency`));
      }
      break;

    case "equalizer":
      if (filter.frequency <= 0) {
        errors.push(new ValidationError("Frequency must be positive", "equalizer.frequency"));
      }
      if (filter.width <= 0) {
        errors.push(new ValidationError("Width must be positive", "equalizer.width"));
      }
      break;
  }

  return errors;
}

/**
 * Validate and throw if invalid
 */
export function assertValid(graph: MediaGraph): void {
  const result = validateGraph(graph);
  if (!result.valid) {
    // Throw the first error
    throw result.errors[0];
  }
}
