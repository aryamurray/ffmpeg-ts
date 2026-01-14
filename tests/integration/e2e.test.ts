import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, unlinkSync, statSync } from "node:fs";
import { video, probe, setBinary } from "../../src/index.js";
import { resetInputCounter } from "../../src/ast/types.js";

/**
 * Integration tests for ffmpeg-ts
 * 
 * Run with a test video file:
 *   TEST_VIDEO=./video/big_buck_bunny_720p_h264.mov bun run test:run
 * 
 * Or set in vitest config / CI environment
 */

const TEST_VIDEO = process.env.TEST_VIDEO;
const OUTPUT_DIR = process.env.TEST_OUTPUT_DIR || "./test-output";

// Skip all tests if no test video is provided
const describeWithVideo = TEST_VIDEO ? describe : describe.skip;

describeWithVideo("Integration Tests", () => {
  const outputFiles: string[] = [];

  beforeAll(() => {
    if (!TEST_VIDEO) {
      console.log("Skipping integration tests: TEST_VIDEO environment variable not set");
      return;
    }

    if (!existsSync(TEST_VIDEO)) {
      throw new Error(`Test video not found: ${TEST_VIDEO}`);
    }

    // Create output directory if it doesn't exist
    const fs = require("node:fs");
    if (!existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    resetInputCounter();
  });

  afterAll(() => {
    // Clean up output files
    for (const file of outputFiles) {
      if (existsSync(file)) {
        try {
          unlinkSync(file);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  });

  function outputPath(name: string): string {
    const path = `${OUTPUT_DIR}/${name}`;
    outputFiles.push(path);
    return path;
  }

  describe("probe()", () => {
    it("should probe video file and return metadata", async () => {
      const info = await probe(TEST_VIDEO!);

      expect(info.format).toBeDefined();
      expect(info.format.duration).toBeGreaterThan(0);
      expect(info.format.size).toBeGreaterThan(0);

      expect(info.video).toBeDefined();
      expect(info.video!.width).toBeGreaterThan(0);
      expect(info.video!.height).toBeGreaterThan(0);
      expect(info.video!.codec).toBeTruthy();
      expect(info.video!.fps).toBeGreaterThan(0);

      console.log("Probed video info:", {
        duration: info.format.duration,
        dimensions: `${info.video!.width}x${info.video!.height}`,
        videoCodec: info.video!.codec,
        audioCodec: info.audio?.codec,
        fps: info.video!.fps,
      });
    });
  });

  describe("Basic transcoding", () => {
    it("should transcode video with resize", async () => {
      const output = outputPath("resized.mp4");

      await video(TEST_VIDEO!)
        .resize({ width: 640 })
        .codec("h264")
        .crf(28)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.video!.width).toBe(640);
      expect(info.format.duration).toBeCloseTo(2, 0);
    }, 30000);

    it("should transcode with specific FPS", async () => {
      const output = outputPath("fps-changed.mp4");

      await video(TEST_VIDEO!)
        .resize({ width: 320 })
        .fps(15)
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);

      const info = await probe(output);
      expect(info.video!.fps).toBeCloseTo(15, 0);
    }, 30000);

    it("should transcode with audio normalization", async () => {
      const output = outputPath("normalized.mp4");

      await video(TEST_VIDEO!)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .audio(a => a.normalize("loudnorm"))
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.audio).toBeDefined();
    }, 30000);

    it("should mute audio", async () => {
      const output = outputPath("muted.mp4");

      await video(TEST_VIDEO!)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .mute()
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);

      const info = await probe(output);
      expect(info.audio).toBeUndefined();
    }, 30000);
  });

  describe("Video filters", () => {
    it("should crop video", async () => {
      const output = outputPath("cropped.mp4");

      await video(TEST_VIDEO!)
        .crop({ width: 400, height: 300, x: 100, y: 50 })
        .codec("h264")
        .crf(28)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);

      const info = await probe(output);
      expect(info.video!.width).toBe(400);
      expect(info.video!.height).toBe(300);
    }, 30000);

    it("should flip video horizontally", async () => {
      const output = outputPath("flipped.mp4");

      await video(TEST_VIDEO!)
        .resize({ width: 320 })
        .flip("horizontal")
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      expect(statSync(output).size).toBeGreaterThan(0);
    }, 30000);

    it("should apply fade in effect", async () => {
      const output = outputPath("fade-in.mp4");

      await video(TEST_VIDEO!)
        .resize({ width: 320 })
        .fade({ type: "in", start: 0, duration: 1 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 3 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);
  });

  describe("Audio filters", () => {
    it("should adjust volume", async () => {
      const output = outputPath("volume.mp4");

      await video(TEST_VIDEO!)
        .resize({ width: 320 })
        .volume(0.5)
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);
  });

  describe("Output formats", () => {
    it("should output as WebM", async () => {
      const output = outputPath("output.webm");

      await video(TEST_VIDEO!)
        .resize({ width: 320 })
        .codec("vp9")
        .crf(35)
        .audioCodec("opus")
        .container("webm")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);

      const info = await probe(output);
      expect(info.video!.codec).toContain("vp9");
    }, 60000);

    it("should output with fastStart for MP4", async () => {
      const output = outputPath("faststart.mp4");

      await video(TEST_VIDEO!)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .fastStart()
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);
  });

  describe("Progress tracking", () => {
    it("should report progress during encoding", async () => {
      const output = outputPath("progress.mp4");
      const progressUpdates: number[] = [];

      // Get duration first for percentage calculation
      const info = await probe(TEST_VIDEO!);

      await video(TEST_VIDEO!)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 3 })
        .duration(3) // Tell it the expected duration
        .onProgress(p => {
          if (p.percent !== undefined) {
            progressUpdates.push(p.percent);
          }
        })
        .save(output);

      expect(existsSync(output)).toBe(true);
      expect(progressUpdates.length).toBeGreaterThan(0);
      console.log("Progress updates received:", progressUpdates.length);
    }, 30000);
  });

  describe("Cancellation", () => {
    it("should cancel encoding with AbortController", async () => {
      const output = outputPath("cancelled.mp4");
      const controller = new AbortController();

      // Cancel after 500ms
      setTimeout(() => controller.abort(), 500);

      await expect(
        video(TEST_VIDEO!)
          .resize({ width: 640 })
          .codec("h264")
          .preset("veryslow") // Slow preset to ensure we can cancel
          .save(output, { signal: controller.signal })
      ).rejects.toThrow("aborted");
    }, 10000);
  });

  describe("Sub-builders", () => {
    it("should use video sub-builder", async () => {
      const output = outputPath("sub-builder-video.mp4");

      await video(TEST_VIDEO!)
        .video(v => v
          .scale(480, 270)
          .fps(24)
        )
        .codec("h264")
        .crf(28)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);

      const info = await probe(output);
      expect(info.video!.width).toBe(480);
      expect(info.video!.height).toBe(270);
      expect(info.video!.fps).toBeCloseTo(24, 0);
    }, 30000);

    it("should use audio sub-builder", async () => {
      const output = outputPath("sub-builder-audio.mp4");

      await video(TEST_VIDEO!)
        .resize({ width: 320 })
        .audio(a => a
          .volume(0.8)
          .sampleRate(44100)
        )
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);

      const info = await probe(output);
      expect(info.audio!.sampleRate).toBe(44100);
    }, 30000);
  });

  describe("toArgs() debugging", () => {
    it("should generate correct FFmpeg arguments", () => {
      const chain = video(TEST_VIDEO!)
        .resize({ width: 1280, height: 720 })
        .fps(30)
        .codec("h264")
        .crf(23)
        .preset("medium")
        .audioCodec("aac")
        .audioBitrate("192k");
      
      chain.toGraph().output.destination = "output.mp4";
      const args = chain.toArgs();

      console.log("Generated FFmpeg args:", args.join(" "));

      expect(args).toContain("-i");
      expect(args).toContain(TEST_VIDEO);
      expect(args).toContain("-vf");
      expect(args).toContain("-c:v");
      expect(args).toContain("libx264");
      expect(args).toContain("-crf");
      expect(args).toContain("23");
      expect(args).toContain("-preset");
      expect(args).toContain("medium");
      expect(args).toContain("-c:a");
      expect(args).toContain("aac");
      expect(args).toContain("-b:a");
      expect(args).toContain("192k");
    });
  });
});
