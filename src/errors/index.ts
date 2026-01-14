/**
 * Base error class for all ffmpeg-ts errors
 */
export class FFmpegTsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FFmpegTsError";
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Thrown when FFmpeg binary is not found on PATH or at the specified location
 */
export class FFmpegNotFoundError extends FFmpegTsError {
  constructor(searchedPath?: string) {
    const message = searchedPath
      ? `FFmpeg not found at "${searchedPath}". Please install FFmpeg or use setBinary() to specify a custom path.`
      : `FFmpeg not found on PATH. Please install FFmpeg (https://ffmpeg.org/download.html) or use setBinary() to specify a custom path.`;
    super(message);
    this.name = "FFmpegNotFoundError";
  }
}

/**
 * Thrown when FFprobe binary is not found
 */
export class FFprobeNotFoundError extends FFmpegTsError {
  constructor(searchedPath?: string) {
    const message = searchedPath
      ? `FFprobe not found at "${searchedPath}". Please install FFmpeg or use setFFprobeBinary() to specify a custom path.`
      : `FFprobe not found on PATH. Please install FFmpeg (https://ffmpeg.org/download.html) or use setFFprobeBinary() to specify a custom path.`;
    super(message);
    this.name = "FFprobeNotFoundError";
  }
}

/**
 * Thrown when FFmpeg version is below minimum required
 */
export class FFmpegVersionError extends FFmpegTsError {
  constructor(
    public readonly found: string,
    public readonly required: string
  ) {
    super(
      `FFmpeg version ${found} is below the minimum required version ${required}. Please upgrade FFmpeg.`
    );
    this.name = "FFmpegVersionError";
  }
}

/**
 * Thrown when user input validation fails before execution
 */
export class ValidationError extends FFmpegTsError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(field ? `Validation error in "${field}": ${message}` : message);
    this.name = "ValidationError";
  }
}

/**
 * Thrown when AST compilation to FFmpeg arguments fails
 */
export class CompilationError extends FFmpegTsError {
  constructor(message: string) {
    super(`Failed to compile media graph: ${message}`);
    this.name = "CompilationError";
  }
}

/**
 * Thrown when FFmpeg process execution fails
 */
export class ExecutionError extends FFmpegTsError {
  constructor(
    message: string,
    public readonly exitCode?: number,
    public readonly stderr?: string
  ) {
    super(message);
    this.name = "ExecutionError";
  }
}

/**
 * Thrown when input file is not found or not readable
 */
export class InputNotFoundError extends FFmpegTsError {
  constructor(public readonly path: string) {
    super(`Input file not found: "${path}"`);
    this.name = "InputNotFoundError";
  }
}

/**
 * Thrown when output path is not writable
 */
export class OutputNotWritableError extends FFmpegTsError {
  constructor(public readonly path: string) {
    super(`Cannot write to output path: "${path}"`);
    this.name = "OutputNotWritableError";
  }
}

/**
 * Thrown when a codec is not available in FFmpeg
 */
export class CodecNotFoundError extends FFmpegTsError {
  constructor(
    public readonly codec: string,
    public readonly type: "encoder" | "decoder"
  ) {
    super(`${type === "encoder" ? "Encoder" : "Decoder"} "${codec}" not found in FFmpeg`);
    this.name = "CodecNotFoundError";
  }
}

/**
 * Thrown when operation is cancelled via AbortSignal
 */
export class AbortError extends FFmpegTsError {
  constructor() {
    super("Operation was aborted");
    this.name = "AbortError";
  }
}

/**
 * Thrown when a filter combination is incompatible
 */
export class IncompatibleFilterError extends FFmpegTsError {
  constructor(message: string) {
    super(message);
    this.name = "IncompatibleFilterError";
  }
}

/**
 * Thrown when container format doesn't support the requested features
 */
export class ContainerFormatError extends FFmpegTsError {
  constructor(
    public readonly format: string,
    message: string
  ) {
    super(`Container format "${format}": ${message}`);
    this.name = "ContainerFormatError";
  }
}
