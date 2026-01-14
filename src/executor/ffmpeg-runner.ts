import { spawn, type ChildProcess } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { resolveFFmpeg } from "./binary-resolver.js";
import { createProgressParser } from "./progress-parser.js";
import { parseFFmpegError } from "./error-parser.js";
import { AbortError, ExecutionError } from "../errors/index.js";
import type { Progress } from "../utils/types.js";

/**
 * Options for running FFmpeg
 */
export interface RunOptions {
  /** FFmpeg arguments */
  args: string[];
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Progress callback */
  onProgress?: (progress: Progress) => void;
  /** Known input duration for percentage calculation */
  duration?: number;
  /** Input stream (for pipe:0) */
  stdin?: Readable;
  /** Output stream (for pipe:1) */
  stdout?: Writable;
}

/**
 * Run FFmpeg with the given arguments
 */
export async function runFFmpeg(options: RunOptions): Promise<void> {
  const { args, signal, onProgress, duration, stdin, stdout } = options;

  // Check if already aborted
  if (signal?.aborted) {
    throw new AbortError();
  }

  // Resolve FFmpeg binary
  const ffmpegPath = await resolveFFmpeg();

  return new Promise<void>((resolve, reject) => {
    let proc: ChildProcess | null = null;
    let stderr = "";
    let resolved = false;

    const cleanup = () => {
      if (proc && !proc.killed) {
        proc.kill("SIGKILL");
      }
    };

    const handleAbort = () => {
      if (!resolved) {
        cleanup();
        resolved = true;
        reject(new AbortError());
      }
    };

    // Setup abort handler
    if (signal) {
      signal.addEventListener("abort", handleAbort, { once: true });
    }

    try {
      // Spawn FFmpeg process
      proc = spawn(ffmpegPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });

      // Handle stdin
      if (stdin && proc.stdin) {
        stdin.pipe(proc.stdin);
        stdin.on("error", (err) => {
          // Ignore EPIPE errors when process is killed
          if ((err as NodeJS.ErrnoException).code !== "EPIPE") {
            console.error("stdin error:", err);
          }
        });
      } else if (proc.stdin) {
        proc.stdin.end();
      }

      // Handle stdout
      if (stdout && proc.stdout) {
        proc.stdout.pipe(stdout);
      } else if (proc.stdout) {
        // Discard stdout if not using pipe output
        proc.stdout.resume();
      }

      // Handle stderr (progress and errors)
      if (proc.stderr) {
        const progressParser = onProgress
          ? createProgressParser(onProgress, duration)
          : null;

        proc.stderr.setEncoding("utf8");
        proc.stderr.on("data", (chunk: string) => {
          stderr += chunk;
          if (progressParser) {
            progressParser(chunk);
          }
        });
      }

      // Handle process events
      proc.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          signal?.removeEventListener("abort", handleAbort);
          reject(new ExecutionError(`Failed to spawn FFmpeg: ${err.message}`));
        }
      });

      proc.on("close", (code) => {
        if (!resolved) {
          resolved = true;
          signal?.removeEventListener("abort", handleAbort);

          if (code === 0) {
            resolve();
          } else {
            reject(parseFFmpegError(stderr, code ?? undefined));
          }
        }
      });
    } catch (err) {
      resolved = true;
      signal?.removeEventListener("abort", handleAbort);
      reject(
        err instanceof Error
          ? err
          : new ExecutionError(`FFmpeg execution failed: ${String(err)}`)
      );
    }
  });
}

/**
 * Run FFmpeg and capture output as buffer
 */
export async function runFFmpegToBuffer(options: Omit<RunOptions, "stdout">): Promise<Buffer> {
  const { PassThrough } = await import("node:stream");
  const chunks: Buffer[] = [];
  const passThrough = new PassThrough();

  passThrough.on("data", (chunk: Buffer) => chunks.push(chunk));

  await runFFmpeg({
    ...options,
    stdout: passThrough,
  });

  return Buffer.concat(chunks);
}
