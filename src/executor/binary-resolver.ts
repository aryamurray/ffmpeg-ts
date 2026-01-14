import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, constants } from "node:fs/promises";
import {
  FFmpegNotFoundError,
  FFprobeNotFoundError,
  FFmpegVersionError,
} from "../errors/index.js";

const execFileAsync = promisify(execFile);

/**
 * Minimum supported FFmpeg version
 */
const MIN_FFMPEG_VERSION = "4.0.0";

/**
 * Global configuration for binary paths
 */
interface BinaryConfig {
  ffmpegPath: string | null;
  ffprobePath: string | null;
  validated: boolean;
  version: string | null;
}

const config: BinaryConfig = {
  ffmpegPath: null,
  ffprobePath: null,
  validated: false,
  version: null,
};

/**
 * Set custom FFmpeg binary path
 */
export function setBinary(path: string): void {
  config.ffmpegPath = path;
  config.validated = false;
  config.version = null;
}

/**
 * Set custom FFprobe binary path
 */
export function setFFprobeBinary(path: string): void {
  config.ffprobePath = path;
}

/**
 * Get the current FFmpeg binary path (for debugging)
 */
export function getBinaryPath(): string | null {
  return config.ffmpegPath;
}

/**
 * Get the current FFprobe binary path (for debugging)
 */
export function getFFprobeBinaryPath(): string | null {
  return config.ffprobePath;
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): void {
  config.ffmpegPath = null;
  config.ffprobePath = null;
  config.validated = false;
  config.version = null;
}

/**
 * Check if a file exists and is executable
 */
async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    // On Windows, X_OK might not work - try R_OK instead
    try {
      await access(path, constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Parse FFmpeg version string
 */
function parseVersion(output: string): string | null {
  // FFmpeg version output: "ffmpeg version 5.1.2 Copyright..."
  const match = output.match(/ffmpeg version (\d+\.\d+(?:\.\d+)?)/i);
  if (match) {
    return match[1]!;
  }
  
  // Try alternate format: "ffmpeg version n5.1.2..."
  const altMatch = output.match(/ffmpeg version n?(\d+\.\d+(?:\.\d+)?)/i);
  return altMatch ? altMatch[1]! : null;
}

/**
 * Compare semantic versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);
  
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const partA = partsA[i] ?? 0;
    const partB = partsB[i] ?? 0;
    
    if (partA < partB) return -1;
    if (partA > partB) return 1;
  }
  
  return 0;
}

/**
 * Try to find FFmpeg on PATH
 */
async function findOnPath(binary: "ffmpeg" | "ffprobe"): Promise<string | null> {
  // Use 'where' on Windows, 'which' on Unix
  const isWindows = process.platform === "win32";
  const command = isWindows ? "where" : "which";
  
  try {
    const { stdout } = await execFileAsync(command, [binary]);
    const path = stdout.trim().split(/\r?\n/)[0];
    if (path && (await isExecutable(path))) {
      return path;
    }
  } catch {
    // Not found
  }
  
  return null;
}

/**
 * Resolve and validate FFmpeg binary
 * This is called lazily on first execution
 */
export async function resolveFFmpeg(): Promise<string> {
  // If we have a validated path, return it
  if (config.validated && config.ffmpegPath) {
    return config.ffmpegPath;
  }
  
  let ffmpegPath = config.ffmpegPath;
  
  // If no custom path, search on PATH
  if (!ffmpegPath) {
    ffmpegPath = await findOnPath("ffmpeg");
    if (!ffmpegPath) {
      throw new FFmpegNotFoundError();
    }
  } else {
    // Verify custom path exists
    if (!(await isExecutable(ffmpegPath))) {
      throw new FFmpegNotFoundError(ffmpegPath);
    }
  }
  
  // Validate version
  try {
    const { stdout, stderr } = await execFileAsync(ffmpegPath, ["-version"]);
    const output = stdout || stderr;
    const version = parseVersion(output);
    
    if (!version) {
      // Can't parse version, but binary exists - allow it
      config.ffmpegPath = ffmpegPath;
      config.validated = true;
      config.version = "unknown";
      return ffmpegPath;
    }
    
    if (compareVersions(version, MIN_FFMPEG_VERSION) < 0) {
      throw new FFmpegVersionError(version, MIN_FFMPEG_VERSION);
    }
    
    config.ffmpegPath = ffmpegPath;
    config.validated = true;
    config.version = version;
    
    return ffmpegPath;
  } catch (error) {
    if (error instanceof FFmpegVersionError) {
      throw error;
    }
    throw new FFmpegNotFoundError(ffmpegPath);
  }
}

/**
 * Resolve FFprobe binary
 */
export async function resolveFFprobe(): Promise<string> {
  let ffprobePath = config.ffprobePath;
  
  // If no custom path, try to find it
  if (!ffprobePath) {
    // First, try next to ffmpeg
    if (config.ffmpegPath) {
      const dir = config.ffmpegPath.replace(/ffmpeg(\.exe)?$/i, "");
      const probePath = dir + (process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
      if (await isExecutable(probePath)) {
        ffprobePath = probePath;
      }
    }
    
    // Otherwise, search on PATH
    if (!ffprobePath) {
      ffprobePath = await findOnPath("ffprobe");
    }
    
    if (!ffprobePath) {
      throw new FFprobeNotFoundError();
    }
  } else {
    // Verify custom path exists
    if (!(await isExecutable(ffprobePath))) {
      throw new FFprobeNotFoundError(ffprobePath);
    }
  }
  
  config.ffprobePath = ffprobePath;
  return ffprobePath;
}

/**
 * Get the validated FFmpeg version (or null if not yet validated)
 */
export function getVersion(): string | null {
  return config.version;
}

/**
 * Check if FFmpeg is available without throwing
 */
export async function isFFmpegAvailable(): Promise<boolean> {
  try {
    await resolveFFmpeg();
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if FFprobe is available without throwing
 */
export async function isFFprobeAvailable(): Promise<boolean> {
  try {
    await resolveFFprobe();
    return true;
  } catch {
    return false;
  }
}
