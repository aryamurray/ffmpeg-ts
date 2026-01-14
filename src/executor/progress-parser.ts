import type { Progress } from "../utils/types.js";

/**
 * Parse FFmpeg progress output from stderr
 *
 * FFmpeg outputs progress in format:
 * frame=  120 fps=30 q=28.0 size=    1024kB time=00:00:04.00 bitrate=2048.0kbits/s speed=1.5x
 */
export function parseProgressLine(line: string, totalDuration?: number): Progress | null {
  // Check if this is a progress line
  if (!line.includes("frame=") && !line.includes("size=") && !line.includes("time=")) {
    return null;
  }

  const progress: Progress = {
    frames: 0,
    fps: 0,
    bitrate: "",
    size: 0,
    time: 0,
    speed: 0,
  };

  // Parse frame count
  const frameMatch = line.match(/frame=\s*(\d+)/);
  if (frameMatch) {
    progress.frames = parseInt(frameMatch[1]!, 10);
  }

  // Parse FPS
  const fpsMatch = line.match(/fps=\s*([\d.]+)/);
  if (fpsMatch) {
    progress.fps = parseFloat(fpsMatch[1]!);
  }

  // Parse bitrate
  const bitrateMatch = line.match(/bitrate=\s*([\d.]+\s*\w+\/s|N\/A)/);
  if (bitrateMatch) {
    progress.bitrate = bitrateMatch[1]!.trim();
  }

  // Parse size
  const sizeMatch = line.match(/size=\s*(\d+)\s*(\w+)/);
  if (sizeMatch) {
    const value = parseInt(sizeMatch[1]!, 10);
    const unit = sizeMatch[2]!.toLowerCase();
    // Convert to bytes
    const multipliers: Record<string, number> = {
      b: 1,
      kb: 1024,
      kib: 1024,
      mb: 1024 * 1024,
      mib: 1024 * 1024,
      gb: 1024 * 1024 * 1024,
      gib: 1024 * 1024 * 1024,
    };
    progress.size = value * (multipliers[unit] ?? 1);
  }

  // Parse time
  const timeMatch = line.match(/time=(\d+):(\d{2}):(\d{2})(?:\.(\d+))?/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1]!, 10);
    const minutes = parseInt(timeMatch[2]!, 10);
    const seconds = parseInt(timeMatch[3]!, 10);
    const ms = timeMatch[4] ? parseInt(timeMatch[4].padEnd(3, "0").slice(0, 3), 10) : 0;
    progress.time = hours * 3600 + minutes * 60 + seconds + ms / 1000;
  }

  // Parse speed
  const speedMatch = line.match(/speed=\s*([\d.]+)x/);
  if (speedMatch) {
    progress.speed = parseFloat(speedMatch[1]!);
  }

  // Calculate percentage if duration is known
  if (totalDuration && totalDuration > 0 && progress.time > 0) {
    progress.percent = Math.min(100, Math.round((progress.time / totalDuration) * 100));
  }

  // Only return if we parsed something meaningful
  if (progress.frames > 0 || progress.time > 0 || progress.size > 0) {
    return progress;
  }

  return null;
}

/**
 * Create a progress line parser that accumulates partial lines
 */
export function createProgressParser(
  onProgress: (progress: Progress) => void,
  totalDuration?: number
): (chunk: string) => void {
  let buffer = "";

  return (chunk: string) => {
    buffer += chunk;
    
    // Process complete lines
    const lines = buffer.split(/\r?\n/);
    
    // Keep the last incomplete line in buffer
    buffer = lines.pop() ?? "";
    
    for (const line of lines) {
      const progress = parseProgressLine(line, totalDuration);
      if (progress) {
        onProgress(progress);
      }
    }

    // Also check for carriage return updates (FFmpeg uses \r for progress)
    if (buffer.includes("\r")) {
      const crLines = buffer.split("\r");
      for (let i = 0; i < crLines.length - 1; i++) {
        const progress = parseProgressLine(crLines[i]!, totalDuration);
        if (progress) {
          onProgress(progress);
        }
      }
      buffer = crLines[crLines.length - 1] ?? "";
    }
  };
}
