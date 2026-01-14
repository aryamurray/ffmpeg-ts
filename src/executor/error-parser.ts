import {
  ExecutionError,
  InputNotFoundError,
  CodecNotFoundError,
  OutputNotWritableError,
} from "../errors/index.js";

/**
 * Parse FFmpeg stderr and create appropriate error
 */
export function parseFFmpegError(stderr: string, exitCode?: number): Error {
  const lowerStderr = stderr.toLowerCase();

  // Input file not found
  const inputNotFoundMatch = stderr.match(/([^:]+): No such file or directory/);
  if (inputNotFoundMatch) {
    return new InputNotFoundError(inputNotFoundMatch[1]!.trim());
  }

  // Alternative input not found pattern
  if (lowerStderr.includes("does not exist") || lowerStderr.includes("no such file")) {
    const pathMatch = stderr.match(/(?:file |path )?['"]?([^'":\n]+)['"]?(?:: | does not exist| no such file)/i);
    if (pathMatch) {
      return new InputNotFoundError(pathMatch[1]!.trim());
    }
  }

  // Encoder not found
  const encoderNotFoundMatch = stderr.match(/Unknown encoder ['"]?(\w+)['"]?/);
  if (encoderNotFoundMatch) {
    return new CodecNotFoundError(encoderNotFoundMatch[1]!, "encoder");
  }

  // Decoder not found
  const decoderNotFoundMatch = stderr.match(/Decoder ['"]?(\w+)['"]? not found/);
  if (decoderNotFoundMatch) {
    return new CodecNotFoundError(decoderNotFoundMatch[1]!, "decoder");
  }

  // Codec not found (alternative pattern)
  if (lowerStderr.includes("codec not found") || lowerStderr.includes("encoder not found")) {
    const codecMatch = stderr.match(/(?:codec|encoder|decoder) (?:\(.*?\) )?['"]?(\w+)['"]? not found/i);
    if (codecMatch) {
      return new CodecNotFoundError(codecMatch[1]!, "encoder");
    }
  }

  // Output not writable
  if (
    lowerStderr.includes("permission denied") ||
    lowerStderr.includes("read-only file system") ||
    lowerStderr.includes("cannot open")
  ) {
    const outputMatch = stderr.match(/(?:Output|File) ['"]?([^'":\n]+)['"]?/i);
    if (outputMatch) {
      return new OutputNotWritableError(outputMatch[1]!.trim());
    }
  }

  // Invalid option
  if (lowerStderr.includes("unrecognized option") || lowerStderr.includes("option .* not found")) {
    const optionMatch = stderr.match(/(?:Unrecognized option|Option) ['"]?([^'".\n]+)['"]?/i);
    const option = optionMatch ? optionMatch[1] : "unknown";
    return new ExecutionError(`Invalid FFmpeg option: ${option}`, exitCode, stderr);
  }

  // Invalid filter
  if (lowerStderr.includes("no such filter") || lowerStderr.includes("unknown filter")) {
    const filterMatch = stderr.match(/(?:No such filter|Unknown filter): ['"]?(\w+)['"]?/i);
    const filter = filterMatch ? filterMatch[1] : "unknown";
    return new ExecutionError(`Invalid FFmpeg filter: ${filter}`, exitCode, stderr);
  }

  // Stream mapping error
  if (lowerStderr.includes("stream map") || lowerStderr.includes("invalid stream specifier")) {
    return new ExecutionError("Invalid stream mapping configuration", exitCode, stderr);
  }

  // Generic execution error with the most relevant line from stderr
  const relevantLine = extractRelevantErrorLine(stderr);
  return new ExecutionError(
    relevantLine || `FFmpeg process exited with code ${exitCode ?? "unknown"}`,
    exitCode,
    stderr
  );
}

/**
 * Extract the most relevant error line from FFmpeg stderr
 */
function extractRelevantErrorLine(stderr: string): string | null {
  const lines = stderr.split(/\r?\n/);

  // Look for lines that indicate errors
  const errorPatterns = [
    /^error:/i,
    /^fatal:/i,
    /error while/i,
    /conversion failed/i,
    /invalid/i,
    /cannot/i,
    /failed/i,
    /no such/i,
    /not found/i,
    /unknown/i,
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const pattern of errorPatterns) {
      if (pattern.test(trimmed)) {
        // Clean up the line
        return trimmed
          .replace(/^\[.*?\]\s*/, "") // Remove [component] prefix
          .replace(/\s+/g, " ") // Normalize whitespace
          .slice(0, 200); // Limit length
      }
    }
  }

  // If no specific error found, return the last non-empty line
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i]!.trim();
    if (trimmed && !trimmed.startsWith("frame=")) {
      return trimmed.slice(0, 200);
    }
  }

  return null;
}
