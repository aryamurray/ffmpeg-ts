import { describe, it, expect } from "vitest";
import { parseProgressLine } from "../../src/executor/progress-parser.js";

describe("Progress Parser", () => {
  it("should parse standard FFmpeg progress line", () => {
    const line = "frame=  120 fps=30.0 q=28.0 size=    1024kB time=00:00:04.00 bitrate=2048.0kbits/s speed=1.50x";
    const progress = parseProgressLine(line);

    expect(progress).not.toBeNull();
    expect(progress!.frames).toBe(120);
    expect(progress!.fps).toBe(30.0);
    expect(progress!.time).toBe(4.0);
    expect(progress!.bitrate).toBe("2048.0kbits/s");
    expect(progress!.speed).toBe(1.5);
  });

  it("should parse progress line with large values", () => {
    const line = "frame=12345 fps=60.0 q=23.0 size=  102400kB time=00:05:30.50 bitrate=4096.0kbits/s speed=2.00x";
    const progress = parseProgressLine(line);

    expect(progress).not.toBeNull();
    expect(progress!.frames).toBe(12345);
    expect(progress!.fps).toBe(60.0);
    expect(progress!.time).toBe(330.5);
    expect(progress!.speed).toBe(2.0);
  });

  it("should calculate percentage when duration is provided", () => {
    const line = "frame=  120 fps=30.0 time=00:00:10.00 bitrate=2048.0kbits/s speed=1.00x";
    const progress = parseProgressLine(line, 100);

    expect(progress).not.toBeNull();
    expect(progress!.percent).toBe(10);
  });

  it("should cap percentage at 100", () => {
    const line = "frame=  120 fps=30.0 time=00:01:50.00 bitrate=2048.0kbits/s speed=1.00x";
    const progress = parseProgressLine(line, 100);

    expect(progress).not.toBeNull();
    expect(progress!.percent).toBe(100);
  });

  it("should parse progress with milliseconds", () => {
    const line = "frame=  100 fps=25.0 time=00:00:04.123 bitrate=1000.0kbits/s speed=1.00x";
    const progress = parseProgressLine(line);

    expect(progress).not.toBeNull();
    expect(progress!.time).toBeCloseTo(4.123, 2);
  });

  it("should parse progress with hours", () => {
    const line = "frame=10000 fps=30.0 time=01:30:45.00 bitrate=5000.0kbits/s speed=1.50x";
    const progress = parseProgressLine(line);

    expect(progress).not.toBeNull();
    expect(progress!.time).toBe(3600 + 30 * 60 + 45);
  });

  it("should return null for non-progress lines", () => {
    expect(parseProgressLine("Input #0, mp4")).toBeNull();
    expect(parseProgressLine("Stream mapping:")).toBeNull();
    expect(parseProgressLine("Press [q] to stop")).toBeNull();
    expect(parseProgressLine("")).toBeNull();
  });

  it("should parse size correctly", () => {
    const lineKB = "frame=100 fps=30 size=  1024kB time=00:00:01.00 bitrate=1000kbits/s speed=1x";
    expect(parseProgressLine(lineKB)!.size).toBe(1024 * 1024);

    const lineMB = "frame=100 fps=30 size=    10mB time=00:00:01.00 bitrate=1000kbits/s speed=1x";
    expect(parseProgressLine(lineMB)!.size).toBe(10 * 1024 * 1024);
  });

  it("should handle N/A bitrate", () => {
    const line = "frame=1 fps=0.0 time=00:00:00.04 bitrate=N/A speed=N/A";
    const progress = parseProgressLine(line);

    expect(progress).not.toBeNull();
    expect(progress!.frames).toBe(1);
    expect(progress!.bitrate).toBe("N/A");
    expect(progress!.speed).toBe(0); // N/A won't match the regex
  });
});
