import { describe, it, expect } from "vitest";
import {
  FFmpegTsError,
  FFmpegNotFoundError,
  FFprobeNotFoundError,
  ValidationError,
  ExecutionError,
  InputNotFoundError,
  CodecNotFoundError,
  AbortError,
} from "../../src/errors/index.js";
import { parseFFmpegError } from "../../src/executor/error-parser.js";

describe("Error Classes", () => {
  it("should create FFmpegNotFoundError with default message", () => {
    const error = new FFmpegNotFoundError();
    expect(error.name).toBe("FFmpegNotFoundError");
    expect(error.message).toContain("FFmpeg not found");
    expect(error.message).toContain("PATH");
  });

  it("should create FFmpegNotFoundError with custom path", () => {
    const error = new FFmpegNotFoundError("/custom/path/ffmpeg");
    expect(error.message).toContain("/custom/path/ffmpeg");
  });

  it("should create FFprobeNotFoundError", () => {
    const error = new FFprobeNotFoundError();
    expect(error.name).toBe("FFprobeNotFoundError");
    expect(error.message).toContain("FFprobe not found");
  });

  it("should create ValidationError with field", () => {
    const error = new ValidationError("must be positive", "fps");
    expect(error.name).toBe("ValidationError");
    expect(error.message).toContain("fps");
    expect(error.message).toContain("positive");
    expect(error.field).toBe("fps");
  });

  it("should create ValidationError without field", () => {
    const error = new ValidationError("general error");
    expect(error.message).toBe("general error");
    expect(error.field).toBeUndefined();
  });

  it("should create ExecutionError with exit code", () => {
    const error = new ExecutionError("Process failed", 1, "error output");
    expect(error.name).toBe("ExecutionError");
    expect(error.exitCode).toBe(1);
    expect(error.stderr).toBe("error output");
  });

  it("should create InputNotFoundError", () => {
    const error = new InputNotFoundError("/path/to/video.mp4");
    expect(error.name).toBe("InputNotFoundError");
    expect(error.path).toBe("/path/to/video.mp4");
    expect(error.message).toContain("/path/to/video.mp4");
  });

  it("should create CodecNotFoundError for encoder", () => {
    const error = new CodecNotFoundError("libx265", "encoder");
    expect(error.name).toBe("CodecNotFoundError");
    expect(error.codec).toBe("libx265");
    expect(error.type).toBe("encoder");
    expect(error.message).toContain("Encoder");
  });

  it("should create CodecNotFoundError for decoder", () => {
    const error = new CodecNotFoundError("h264", "decoder");
    expect(error.message).toContain("Decoder");
  });

  it("should create AbortError", () => {
    const error = new AbortError();
    expect(error.name).toBe("AbortError");
    expect(error.message).toContain("aborted");
  });

  it("should inherit from FFmpegTsError", () => {
    const error = new FFmpegNotFoundError();
    expect(error instanceof FFmpegTsError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe("Error Parser", () => {
  it("should parse input not found error", () => {
    const stderr = "input.mp4: No such file or directory";
    const error = parseFFmpegError(stderr, 1);

    expect(error).toBeInstanceOf(InputNotFoundError);
    expect((error as InputNotFoundError).path).toBe("input.mp4");
  });

  it("should parse unknown encoder error", () => {
    const stderr = "Unknown encoder 'libx265custom'";
    const error = parseFFmpegError(stderr, 1);

    expect(error).toBeInstanceOf(CodecNotFoundError);
    expect((error as CodecNotFoundError).codec).toBe("libx265custom");
    expect((error as CodecNotFoundError).type).toBe("encoder");
  });

  it("should parse decoder not found error", () => {
    const stderr = "Decoder 'h265custom' not found";
    const error = parseFFmpegError(stderr, 1);

    expect(error).toBeInstanceOf(CodecNotFoundError);
    expect((error as CodecNotFoundError).type).toBe("decoder");
  });

  it("should return generic ExecutionError for unknown errors", () => {
    const stderr = "Some random error message\nwithout clear pattern";
    const error = parseFFmpegError(stderr, 1);

    expect(error).toBeInstanceOf(ExecutionError);
    expect((error as ExecutionError).exitCode).toBe(1);
    expect((error as ExecutionError).stderr).toBe(stderr);
  });

  it("should extract relevant error line", () => {
    const stderr = `
Input #0, mp4, from 'input.mp4':
  Duration: 00:01:00.00
Conversion failed!
`;
    const error = parseFFmpegError(stderr, 1);

    expect(error.message).toContain("Conversion failed");
  });
});
