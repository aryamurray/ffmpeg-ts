import { describe, it, expect, beforeEach } from "vitest";
import { validateGraph } from "../../src/ast/validation.js";
import { createMediaGraph, resetInputCounter } from "../../src/ast/types.js";
import type { MediaGraph } from "../../src/ast/types.js";

describe("AST Validation", () => {
  let graph: MediaGraph;

  beforeEach(() => {
    resetInputCounter();
    graph = createMediaGraph();
  });

  it("should fail when no inputs are provided", () => {
    graph.output.destination = "output.mp4";
    const result = validateGraph(graph);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.message).toContain("input");
  });

  it("should fail when no output destination is provided", () => {
    graph.inputs.push({ id: "input_0", source: "input.mp4" });
    const result = validateGraph(graph);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("destination"))).toBe(true);
  });

  it("should pass with valid basic graph", () => {
    graph.inputs.push({ id: "input_0", source: "input.mp4" });
    graph.videoStreams.push({ inputRef: "input_0", filters: [] });
    graph.audioStreams.push({ inputRef: "input_0", filters: [] });
    graph.output.destination = "output.mp4";

    const result = validateGraph(graph);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("should fail when video stream references non-existent input", () => {
    graph.inputs.push({ id: "input_0", source: "input.mp4" });
    graph.videoStreams.push({ inputRef: "nonexistent", filters: [] });
    graph.output.destination = "output.mp4";

    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("nonexistent"))).toBe(true);
  });

  it("should validate scale filter dimensions", () => {
    graph.inputs.push({ id: "input_0", source: "input.mp4" });
    graph.videoStreams.push({
      inputRef: "input_0",
      filters: [{ kind: "scale", width: -5, height: 720 }],
    });
    graph.output.destination = "output.mp4";

    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("Width"))).toBe(true);
  });

  it("should allow -1 for auto-calculated dimensions", () => {
    graph.inputs.push({ id: "input_0", source: "input.mp4" });
    graph.videoStreams.push({
      inputRef: "input_0",
      filters: [{ kind: "scale", width: 1280, height: -1 }],
    });
    graph.output.destination = "output.mp4";

    const result = validateGraph(graph);
    expect(result.valid).toBe(true);
  });

  it("should validate FPS range", () => {
    graph.inputs.push({ id: "input_0", source: "input.mp4" });
    graph.videoStreams.push({
      inputRef: "input_0",
      filters: [{ kind: "fps", value: 500 }],
    });
    graph.output.destination = "output.mp4";

    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("240"))).toBe(true);
  });

  it("should validate trim start before end", () => {
    graph.inputs.push({ id: "input_0", source: "input.mp4" });
    graph.videoStreams.push({
      inputRef: "input_0",
      filters: [{ kind: "trim", start: 10, end: 5 }],
    });
    graph.output.destination = "output.mp4";

    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("before end"))).toBe(true);
  });

  it("should validate fade duration is positive", () => {
    graph.inputs.push({ id: "input_0", source: "input.mp4" });
    graph.videoStreams.push({
      inputRef: "input_0",
      filters: [{ kind: "fade", type: "in", startTime: 0, duration: 0 }],
    });
    graph.output.destination = "output.mp4";

    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("duration") && e.message.includes("positive"))).toBe(true);
  });

  it("should validate CRF range", () => {
    graph.inputs.push({ id: "input_0", source: "input.mp4" });
    graph.videoStreams.push({ inputRef: "input_0", filters: [] });
    graph.output.destination = "output.mp4";
    graph.output.video = { codec: "h264", crf: 100 };

    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("CRF"))).toBe(true);
  });

  it("should validate audio filter sample rate", () => {
    graph.inputs.push({ id: "input_0", source: "input.mp4" });
    graph.audioStreams.push({
      inputRef: "input_0",
      filters: [{ kind: "aresample", sampleRate: 100 }],
    });
    graph.output.destination = "output.mp4";

    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("8000"))).toBe(true);
  });

  it("should validate overlay references existing input", () => {
    graph.inputs.push({ id: "input_0", source: "input.mp4" });
    graph.videoStreams.push({
      inputRef: "input_0",
      filters: [{ kind: "overlay", inputRef: "missing_overlay", x: 0, y: 0 }],
    });
    graph.output.destination = "output.mp4";

    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes("missing_overlay"))).toBe(true);
  });

  it("should warn when no streams are configured", () => {
    graph.inputs.push({ id: "input_0", source: "input.mp4" });
    graph.output.destination = "output.mp4";

    const result = validateGraph(graph);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes("empty"))).toBe(true);
  });
});
