#!/usr/bin/env bun
/**
 * Download test video for integration tests
 *
 * This script downloads the Big Buck Bunny video from Blender's server
 * if it doesn't already exist in the video folder.
 *
 * Usage:
 *   bun scripts/download-test-video.ts
 *   # or
 *   bun run download-test-video
 */

import { existsSync, mkdirSync, createWriteStream } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { get } from "node:https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VIDEO_DIR = join(__dirname, "../video");
const VIDEO_FILE = join(VIDEO_DIR, "big_buck_bunny_720p_h264.mov");
const VIDEO_URL = "https://download.blender.org/peach/bigbuckbunny_movies/big_buck_bunny_720p_h264.mov";

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);

    console.log(`Downloading from ${url}...`);
    console.log(`Destination: ${dest}`);

    const request = get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          console.log(`Following redirect to ${redirectUrl}`);
          file.close();
          downloadFile(redirectUrl, dest).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        file.close();
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers["content-length"] || "0", 10);
      let downloadedSize = 0;
      let lastPercent = 0;

      response.on("data", (chunk: Buffer) => {
        downloadedSize += chunk.length;
        if (totalSize > 0) {
          const percent = Math.floor((downloadedSize / totalSize) * 100);
          if (percent >= lastPercent + 10) {
            console.log(`Progress: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(1)} MB / ${(totalSize / 1024 / 1024).toFixed(1)} MB)`);
            lastPercent = percent;
          }
        }
      });

      response.pipe(file);

      file.on("finish", () => {
        file.close();
        console.log("Download complete!");
        resolve();
      });
    });

    request.on("error", (err) => {
      file.close();
      reject(err);
    });

    file.on("error", (err) => {
      file.close();
      reject(err);
    });
  });
}

async function main() {
  console.log("Test Video Download Script");
  console.log("==========================\n");

  // Check if video already exists
  if (existsSync(VIDEO_FILE)) {
    console.log(`Video already exists at ${VIDEO_FILE}`);
    console.log("Skipping download.");
    return;
  }

  // Create video directory if it doesn't exist
  if (!existsSync(VIDEO_DIR)) {
    console.log(`Creating video directory: ${VIDEO_DIR}`);
    mkdirSync(VIDEO_DIR, { recursive: true });
  }

  // Download the video
  try {
    await downloadFile(VIDEO_URL, VIDEO_FILE);
    console.log("\nTest video downloaded successfully!");
  } catch (error) {
    console.error("\nFailed to download test video:", error);
    process.exit(1);
  }
}

main();
