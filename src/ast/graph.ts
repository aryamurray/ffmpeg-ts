import type { MediaGraph, MediaInput, VideoStream, AudioStream } from "./types.js";
import type { VideoFilter, OverlayFilter } from "./video-filters.js";
import type { AudioFilter } from "./audio-filters.js";

/**
 * Check if the graph requires -filter_complex (vs simple -vf/-af)
 */
export function requiresComplexFilter(graph: MediaGraph): boolean {
  // Multiple inputs always require filter_complex
  if (graph.inputs.length > 1) {
    return true;
  }

  // Check for overlay filters (reference other inputs)
  for (const stream of graph.videoStreams) {
    for (const filter of stream.filters) {
      if (filter.kind === "overlay") {
        return true;
      }
    }
  }

  // Multiple video or audio streams being combined
  if (graph.videoStreams.length > 1 || graph.audioStreams.length > 1) {
    return true;
  }

  return false;
}

/**
 * Get all inputs referenced in the graph
 */
export function getReferencedInputs(graph: MediaGraph): Set<string> {
  const refs = new Set<string>();

  for (const stream of graph.videoStreams) {
    refs.add(stream.inputRef);
    for (const filter of stream.filters) {
      if (filter.kind === "overlay") {
        refs.add((filter as OverlayFilter).inputRef);
      }
    }
  }

  for (const stream of graph.audioStreams) {
    refs.add(stream.inputRef);
  }

  return refs;
}

/**
 * Get all input IDs in the graph
 */
export function getInputIds(graph: MediaGraph): Set<string> {
  return new Set(graph.inputs.map(i => i.id));
}

/**
 * Find an input by ID
 */
export function findInput(graph: MediaGraph, id: string): MediaInput | undefined {
  return graph.inputs.find(i => i.id === id);
}

/**
 * Get the index of an input in the inputs array
 */
export function getInputIndex(graph: MediaGraph, id: string): number {
  return graph.inputs.findIndex(i => i.id === id);
}

/**
 * Check if graph has any video processing
 */
export function hasVideoProcessing(graph: MediaGraph): boolean {
  return graph.videoStreams.some(s => !s.disabled && s.filters.length > 0);
}

/**
 * Check if graph has any audio processing
 */
export function hasAudioProcessing(graph: MediaGraph): boolean {
  return graph.audioStreams.some(s => !s.disabled && s.filters.length > 0);
}

/**
 * Check if video output is enabled
 */
export function hasVideoOutput(graph: MediaGraph): boolean {
  return graph.videoStreams.some(s => !s.disabled);
}

/**
 * Check if audio output is enabled
 */
export function hasAudioOutput(graph: MediaGraph): boolean {
  return graph.audioStreams.some(s => !s.disabled);
}

/**
 * Clone a media graph (deep copy)
 */
export function cloneGraph(graph: MediaGraph): MediaGraph {
  return JSON.parse(JSON.stringify(graph)) as MediaGraph;
}

/**
 * Add a video filter to the primary video stream
 */
export function addVideoFilter(graph: MediaGraph, filter: VideoFilter): void {
  if (graph.videoStreams.length === 0) {
    throw new Error("No video stream to add filter to");
  }
  graph.videoStreams[0]!.filters.push(filter);
}

/**
 * Add an audio filter to the primary audio stream
 */
export function addAudioFilter(graph: MediaGraph, filter: AudioFilter): void {
  if (graph.audioStreams.length === 0) {
    throw new Error("No audio stream to add filter to");
  }
  graph.audioStreams[0]!.filters.push(filter);
}
