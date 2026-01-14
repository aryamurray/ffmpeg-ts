import {
  setBinary as setFFmpegBinary,
  setFFprobeBinary,
  getBinaryPath,
  getFFprobeBinaryPath,
  getVersion,
  resetConfig,
} from "./executor/binary-resolver.js";

/**
 * Set custom FFmpeg binary path
 *
 * @example
 * ```ts
 * setBinary("/opt/ffmpeg/bin/ffmpeg");
 * ```
 */
export const setBinary = setFFmpegBinary;

/**
 * Set custom FFprobe binary path
 *
 * @example
 * ```ts
 * setFFprobeBinary("/opt/ffmpeg/bin/ffprobe");
 * ```
 */
export { setFFprobeBinary };

/**
 * Get the current FFmpeg binary path (null if not yet resolved)
 */
export { getBinaryPath };

/**
 * Get the current FFprobe binary path (null if not yet resolved)
 */
export { getFFprobeBinaryPath };

/**
 * Get the detected FFmpeg version (null if not yet validated)
 */
export { getVersion };

/**
 * Reset configuration to defaults (mainly for testing)
 */
export { resetConfig };
