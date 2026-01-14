import { ValidationError } from "../errors/index.js";

/**
 * Validates that a number is positive
 */
export function validatePositive(value: number, field: string): void {
  if (value <= 0) {
    throw new ValidationError(`must be positive, got ${value}`, field);
  }
}

/**
 * Validates that a number is non-negative
 */
export function validateNonNegative(value: number, field: string): void {
  if (value < 0) {
    throw new ValidationError(`must be non-negative, got ${value}`, field);
  }
}

/**
 * Validates that a number is within a range
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  field: string
): void {
  if (value < min || value > max) {
    throw new ValidationError(`must be between ${min} and ${max}, got ${value}`, field);
  }
}

/**
 * Validates FPS value
 */
export function validateFps(fps: number): void {
  validateRange(fps, 1, 240, "fps");
}

/**
 * Validates bitrate string format (e.g., "4M", "192k", "4000000")
 */
export function validateBitrate(bitrate: string): void {
  const pattern = /^\d+(\.\d+)?[kKmMgG]?$/;
  if (!pattern.test(bitrate)) {
    throw new ValidationError(
      `invalid format "${bitrate}". Use formats like "4M", "192k", or "4000000"`,
      "bitrate"
    );
  }
}

/**
 * Validates CRF value (typically 0-51)
 */
export function validateCrf(crf: number): void {
  validateRange(crf, 0, 63, "crf");
}

/**
 * Validates dimensions (width/height)
 */
export function validateDimension(value: number, field: string): void {
  // -1 is allowed for auto-calculation
  if (value !== -1 && value !== -2) {
    validatePositive(value, field);
    // Must be even for most codecs
    if (value % 2 !== 0) {
      throw new ValidationError(
        `must be even for compatibility (got ${value}). Consider using ${value + 1} or ${value - 1}`,
        field
      );
    }
  }
}

/**
 * Validates time value in seconds
 */
export function validateTime(time: number, field: string): void {
  validateNonNegative(time, field);
}

/**
 * Validates that a string is not empty
 */
export function validateNotEmpty(value: string, field: string): void {
  if (!value || value.trim().length === 0) {
    throw new ValidationError("must not be empty", field);
  }
}

/**
 * Parse duration string (HH:MM:SS.ms) to seconds
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (!match) {
    throw new ValidationError(`invalid duration format: ${duration}`, "duration");
  }
  
  const hours = parseInt(match[1]!, 10);
  const minutes = parseInt(match[2]!, 10);
  const seconds = parseInt(match[3]!, 10);
  const ms = match[4] ? parseInt(match[4].padEnd(3, "0").slice(0, 3), 10) : 0;
  
  return hours * 3600 + minutes * 60 + seconds + ms / 1000;
}

/**
 * Format seconds to FFmpeg time format (HH:MM:SS.mmm)
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const h = hours.toString().padStart(2, "0");
  const m = minutes.toString().padStart(2, "0");
  const s = secs.toFixed(3).padStart(6, "0");
  
  return `${h}:${m}:${s}`;
}
