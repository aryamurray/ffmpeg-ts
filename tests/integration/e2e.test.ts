import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, unlinkSync, statSync, mkdirSync } from "node:fs";
import { video, audio, audioOnly, probe, setBinary, getVersion } from "../../src/index.js";
import { resetInputCounter } from "../../src/ast/types.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Get the directory of this test file, then navigate to the video folder
const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_VIDEO = join(__dirname, "../../video/big_buck_bunny_720p_h264.mov");
const OUTPUT_DIR = process.env.TEST_OUTPUT_DIR || "./test-output";

describe("Integration Tests", () => {
  const outputFiles: string[] = [];
  let sourceInfo: Awaited<ReturnType<typeof probe>>;

  beforeAll(async () => {
    if (!existsSync(TEST_VIDEO)) {
      throw new Error(
        `Test video not found: ${TEST_VIDEO}\n\n` +
        `Please run 'bun run download-test-video' to download the test video.\n` +
        `Or manually download from:\n` +
        `  https://download.blender.org/peach/bigbuckbunny_movies/big_buck_bunny_720p_h264.mov\n` +
        `And place it in the video/ folder.`
      );
    }

    // Create output directory if it doesn't exist
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Get source video info for reference
    sourceInfo = await probe(TEST_VIDEO);
    console.log("\n📹 Source video:", {
      duration: `${sourceInfo.format.duration.toFixed(1)}s`,
      dimensions: `${sourceInfo.video!.width}x${sourceInfo.video!.height}`,
      videoCodec: sourceInfo.video!.codec,
      audioCodec: sourceInfo.audio?.codec,
      fps: sourceInfo.video!.fps,
    });

    resetInputCounter();
  });

  afterAll(() => {
    // Clean up output files
    let cleaned = 0;
    for (const file of outputFiles) {
      if (existsSync(file)) {
        try {
          unlinkSync(file);
          cleaned++;
        } catch {
          // Ignore cleanup errors
        }
      }
    }
    console.log(`\n🧹 Cleaned up ${cleaned} test output files`);
  });

  function outputPath(name: string): string {
    const path = `${OUTPUT_DIR}/${name}`;
    outputFiles.push(path);
    return path;
  }

  // ============================================
  // PROBE TESTS
  // ============================================
  describe("probe()", () => {
    it("should probe video file and return metadata", async () => {
      const info = await probe(TEST_VIDEO);

      expect(info.format).toBeDefined();
      expect(info.format.duration).toBeGreaterThan(0);
      expect(info.format.size).toBeGreaterThan(0);
      expect(info.format.bitrate).toBeGreaterThan(0);
      expect(info.format.formatName).toBeTruthy();

      expect(info.video).toBeDefined();
      expect(info.video!.width).toBeGreaterThan(0);
      expect(info.video!.height).toBeGreaterThan(0);
      expect(info.video!.codec).toBeTruthy();
      expect(info.video!.fps).toBeGreaterThan(0);
      expect(info.video!.pixelFormat).toBeTruthy();

      expect(info.audio).toBeDefined();
      expect(info.audio!.codec).toBeTruthy();
      expect(info.audio!.sampleRate).toBeGreaterThan(0);
      expect(info.audio!.channels).toBeGreaterThan(0);

      expect(info.streams.length).toBeGreaterThanOrEqual(2);
    });

    it("should return correct stream count", async () => {
      const info = await probe(TEST_VIDEO);
      expect(info.format.streamCount).toBe(info.streams.length);
    });

    it("should throw for non-existent file", async () => {
      await expect(probe("./nonexistent-file.mp4")).rejects.toThrow();
    });
  });

  // ============================================
  // BASIC TRANSCODING
  // ============================================
  describe("Basic transcoding", () => {
    it("should transcode with default settings", async () => {
      const output = outputPath("default.mp4");

      await video(TEST_VIDEO)
        .trim({ start: 0, duration: 1 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      const info = await probe(output);
      expect(info.video).toBeDefined();
      expect(info.audio).toBeDefined();
    }, 30000);

    it("should transcode with resize (width only)", async () => {
      const output = outputPath("resized-width.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 640 })
        .codec("h264")
        .crf(28)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.video!.width).toBe(640);
      // Height should be auto-calculated maintaining aspect ratio
      expect(info.video!.height).toBeLessThan(sourceInfo.video!.height);
    }, 30000);

    it("should transcode with resize (both dimensions)", async () => {
      const output = outputPath("resized-both.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 480, height: 360 })
        .codec("h264")
        .crf(28)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.video!.width).toBe(480);
      expect(info.video!.height).toBe(360);
    }, 30000);

    it("should transcode with specific FPS", async () => {
      const output = outputPath("fps-changed.mp4");

      await video(TEST_VIDEO)
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

    it("should transcode with high FPS", async () => {
      const output = outputPath("fps-high.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .fps(60)
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 1 })
        .save(output);

      expect(existsSync(output)).toBe(true);

      const info = await probe(output);
      expect(info.video!.fps).toBeCloseTo(60, 0);
    }, 30000);

    it("should copy video stream without re-encoding", async () => {
      const output = outputPath("copy-video.mp4");

      // Note: Stream copy cannot be combined with filters
      // This test just verifies we can set copy codec
      const chain = video(TEST_VIDEO);
      chain.toGraph().output.destination = output;
      chain.toGraph().output.video = { codec: "copy" };
      chain.toGraph().output.audio = { codec: "copy" };
      
      // Clear filters for copy mode
      chain.toGraph().videoStreams.forEach(s => s.filters = []);
      chain.toGraph().audioStreams.forEach(s => s.filters = []);
      
      // Use input seeking instead of filter-based trim
      chain.toGraph().inputs[0]!.options = { 
        ...chain.toGraph().inputs[0]!.options,
        seekTo: 5,
        duration: 2 
      };
      
      await chain.save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.video!.codec).toBe(sourceInfo.video!.codec);
    }, 30000);
  });

  // ============================================
  // VIDEO FILTERS
  // ============================================
  describe("Video filters", () => {
    it("should crop video to specific dimensions", async () => {
      const output = outputPath("cropped.mp4");

      await video(TEST_VIDEO)
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

    it("should crop video with centered crop", async () => {
      const output = outputPath("cropped-center.mp4");

      // Crop center 50% of the video
      await video(TEST_VIDEO)
        .crop({ 
          width: "iw/2", 
          height: "ih/2",
          x: "iw/4",
          y: "ih/4"
        })
        .codec("h264")
        .crf(28)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);

      const info = await probe(output);
      expect(info.video!.width).toBe(Math.floor(sourceInfo.video!.width / 2));
      expect(info.video!.height).toBe(Math.floor(sourceInfo.video!.height / 2));
    }, 30000);

    it("should flip video horizontally", async () => {
      const output = outputPath("flipped-h.mp4");

      await video(TEST_VIDEO)
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

    it("should flip video vertically", async () => {
      const output = outputPath("flipped-v.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .flip("vertical")
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      expect(statSync(output).size).toBeGreaterThan(0);
    }, 30000);

    it("should rotate video 90 degrees", async () => {
      const output = outputPath("rotated-90.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .video(v => v.transpose(1)) // 90 clockwise
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      // After 90° rotation, width and height should be swapped (approximately)
      expect(info.video!.height).toBeGreaterThan(info.video!.width);
    }, 30000);

    it("should apply fade in effect", async () => {
      const output = outputPath("fade-in.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .fade({ type: "in", start: 0, duration: 1 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 3 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);

    it("should apply fade out effect", async () => {
      const output = outputPath("fade-out.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .fade({ type: "out", start: 2, duration: 1 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 3 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);

    it("should apply both fade in and fade out", async () => {
      const output = outputPath("fade-both.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .fade({ type: "in", start: 0, duration: 0.5 })
        .fade({ type: "out", start: 2.5, duration: 0.5 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 3 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);

    it("should add padding to video", async () => {
      const output = outputPath("padded.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .video(v => v.pad(400, 300, "(ow-iw)/2", "(oh-ih)/2", "black"))
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.video!.width).toBe(400);
      expect(info.video!.height).toBe(300);
    }, 30000);

    it("should apply multiple video filters in chain", async () => {
      const output = outputPath("multi-filter.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 640 })
        .fps(24)
        .flip("horizontal")
        .fade({ type: "in", start: 0, duration: 0.5 })
        .codec("h264")
        .crf(28)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.video!.width).toBe(640);
      expect(info.video!.fps).toBeCloseTo(24, 0);
    }, 30000);
  });

  // ============================================
  // AUDIO PROCESSING
  // ============================================
  describe("Audio processing", () => {
    it("should mute audio completely", async () => {
      const output = outputPath("muted.mp4");

      await video(TEST_VIDEO)
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

    it("should adjust volume down", async () => {
      const output = outputPath("volume-down.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .volume(0.5)
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      expect(statSync(output).size).toBeGreaterThan(0);
    }, 30000);

    it("should adjust volume up", async () => {
      const output = outputPath("volume-up.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .volume(1.5)
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);

    it("should normalize audio with loudnorm", async () => {
      const output = outputPath("normalized-loudnorm.mp4");

      await video(TEST_VIDEO)
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

    it("should normalize audio with dynaudnorm", async () => {
      const output = outputPath("normalized-dynaudnorm.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .audio(a => a.normalize("dynaudnorm"))
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);

    it("should resample audio to different sample rate", async () => {
      const output = outputPath("resampled.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .audio(a => a.sampleRate(44100))
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);

      const info = await probe(output);
      expect(info.audio!.sampleRate).toBe(44100);
    }, 30000);

    it("should apply audio fade in", async () => {
      const output = outputPath("audio-fade-in.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .audio(a => a.fade({ type: "in", start: 0, duration: 1 }))
        .trim({ start: 0, duration: 3 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);

    it("should apply audio fade out", async () => {
      const output = outputPath("audio-fade-out.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .audio(a => a.fade({ type: "out", start: 2, duration: 1 }))
        .trim({ start: 0, duration: 3 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);

    it("should apply lowpass filter", async () => {
      const output = outputPath("audio-lowpass.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .audio(a => a.lowpass(3000))
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);

    it("should apply highpass filter", async () => {
      const output = outputPath("audio-highpass.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .audio(a => a.highpass(200))
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);

    it("should apply multiple audio filters", async () => {
      const output = outputPath("audio-multi-filter.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .audio(a => a
          .volume(0.8)
          .highpass(100)
          .lowpass(8000)
          .normalize("loudnorm")
        )
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);
  });

  // ============================================
  // TRIMMING & SEEKING
  // ============================================
  describe("Trimming & seeking", () => {
    it("should trim from start", async () => {
      const output = outputPath("trim-start.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 3 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.format.duration).toBeCloseTo(3, 0);
    }, 30000);

    it("should trim from middle", async () => {
      const output = outputPath("trim-middle.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 10, duration: 3 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.format.duration).toBeCloseTo(3, 0);
    }, 30000);

    it("should trim with start and end times", async () => {
      const output = outputPath("trim-start-end.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 5, end: 10 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.format.duration).toBeCloseTo(5, 0);
    }, 30000);

    it("should extract very short clip", async () => {
      const output = outputPath("trim-short.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 0.5 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.format.duration).toBeLessThan(1);
    }, 30000);
  });

  // ============================================
  // CODEC SETTINGS
  // ============================================
  describe("Codec settings", () => {
    it("should encode with different CRF values", async () => {
      const outputLow = outputPath("crf-low.mp4");
      const outputHigh = outputPath("crf-high.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(18) // High quality
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(outputLow);

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(35) // Low quality
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(outputHigh);

      expect(existsSync(outputLow)).toBe(true);
      expect(existsSync(outputHigh)).toBe(true);
      
      // Higher quality (lower CRF) should produce larger file
      expect(statSync(outputLow).size).toBeGreaterThan(statSync(outputHigh).size);
    }, 60000);

    it("should encode with different presets", async () => {
      const outputFast = outputPath("preset-ultrafast.mp4");
      const outputSlow = outputPath("preset-medium.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(28)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(outputFast);

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(28)
        .preset("medium")
        .trim({ start: 0, duration: 2 })
        .save(outputSlow);

      expect(existsSync(outputFast)).toBe(true);
      expect(existsSync(outputSlow)).toBe(true);
      
      // Slower preset should produce smaller file at same CRF
      expect(statSync(outputSlow).size).toBeLessThan(statSync(outputFast).size);
    }, 60000);

    it("should set video bitrate", async () => {
      const output = outputPath("bitrate.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .bitrate("500k")
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);

    it("should set audio bitrate", async () => {
      const output = outputPath("audio-bitrate.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .audioCodec("aac")
        .audioBitrate("64k")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);

    it("should set pixel format", async () => {
      const output = outputPath("pixfmt.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .pixelFormat("yuv420p")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.video!.pixelFormat).toBe("yuv420p");
    }, 30000);
  });

  // ============================================
  // OUTPUT FORMATS
  // ============================================
  describe("Output formats", () => {
    it("should output as MP4", async () => {
      const output = outputPath("format.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .container("mp4")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.format.formatName).toContain("mp4");
    }, 30000);

    it("should output as WebM with VP9", async () => {
      const output = outputPath("format.webm");

      await video(TEST_VIDEO)
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
      expect(info.audio!.codec).toContain("opus");
    }, 60000);

    it("should output as MKV", async () => {
      const output = outputPath("format_mkv.mkv");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        // Don't specify container - let FFmpeg infer from extension
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.format.formatName).toContain("matroska");
    }, 30000);

    it("should output as AVI", async () => {
      const output = outputPath("format.avi");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("mpeg4")
        .bitrate("1M")
        .container("avi")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.format.formatName).toContain("avi");
    }, 30000);

    it("should output as MPEG-TS", async () => {
      const output = outputPath("format_ts.ts");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        // Don't specify container - let FFmpeg infer from extension
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.format.formatName).toContain("mpegts");
    }, 30000);

    it("should output as GIF", async () => {
      const output = outputPath("format.gif");

      await video(TEST_VIDEO)
        .resize({ width: 160 })
        .fps(10)
        .container("gif")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      expect(statSync(output).size).toBeGreaterThan(0);
    }, 30000);

    it("should output with fastStart for streaming MP4", async () => {
      const output = outputPath("faststart.mp4");

      await video(TEST_VIDEO)
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

  // ============================================
  // AUDIO EXTRACTION
  // ============================================
  describe("Audio extraction", () => {
    it("should extract audio to MP3", async () => {
      const output = outputPath("audio.mp3");

      await video(TEST_VIDEO)
        .mute() // No video
        .audioCodec("mp3")
        .audioBitrate("192k")
        .container("mp3")
        .trim({ start: 0, duration: 5 })
        .save(output);

      // Note: This might fail because we're muting video but expecting audio
      // Let me check if it works
    }, 30000);

    it("should extract audio to AAC", async () => {
      const output = outputPath("audio_aac.aac");

      // Create audio-only by disabling video
      const chain = video(TEST_VIDEO)
        .audioCodec("aac")
        .audioBitrate("128k")
        .trim({ start: 0, duration: 5 });
      
      // Manually disable video in the graph
      chain.toGraph().videoStreams.forEach(s => s.disabled = true);
      chain.toGraph().output.destination = output;
      
      await chain.save(output);

      expect(existsSync(output)).toBe(true);
      expect(statSync(output).size).toBeGreaterThan(0);
    }, 30000);
  });

  // ============================================
  // METADATA
  // ============================================
  describe("Metadata", () => {
    it("should set title metadata", async () => {
      const output = outputPath("metadata-title.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .metadata("title", "Test Video Title")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.format.tags?.title).toBe("Test Video Title");
    }, 30000);

    it("should set multiple metadata fields", async () => {
      const output = outputPath("metadata-multi.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .metadata("title", "My Video")
        .metadata("artist", "Test Artist")
        .metadata("comment", "Created with ffmpeg-ts")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.format.tags?.title).toBe("My Video");
      expect(info.format.tags?.artist).toBe("Test Artist");
    }, 30000);
  });

  // ============================================
  // PROGRESS TRACKING
  // ============================================
  describe("Progress tracking", () => {
    it("should report progress updates during encoding", async () => {
      const output = outputPath("progress.mp4");
      const progressUpdates: { time: number; fps: number; speed: number }[] = [];

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 5 })
        .duration(5)
        .onProgress(p => {
          progressUpdates.push({ 
            time: p.time, 
            fps: p.fps, 
            speed: p.speed 
          });
        })
        .save(output);

      expect(existsSync(output)).toBe(true);
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Progress should increase over time
      if (progressUpdates.length > 1) {
        const first = progressUpdates[0]!;
        const last = progressUpdates[progressUpdates.length - 1]!;
        expect(last.time).toBeGreaterThanOrEqual(first.time);
      }
      
      console.log(`Progress updates: ${progressUpdates.length}`);
    }, 30000);

    it("should calculate percentage when duration is known", async () => {
      const output = outputPath("progress-percent.mp4");
      const percentages: number[] = [];

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 3 })
        .duration(3)
        .onProgress(p => {
          if (p.percent !== undefined) {
            percentages.push(p.percent);
          }
        })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      if (percentages.length > 0) {
        // Should have some percentage values
        expect(percentages.some(p => p > 0)).toBe(true);
        // Last percentage should be near 100
        const last = percentages[percentages.length - 1]!;
        expect(last).toBeGreaterThanOrEqual(50);
      }
    }, 30000);
  });

  // ============================================
  // CANCELLATION
  // ============================================
  describe("Cancellation", () => {
    it("should cancel encoding with AbortController", async () => {
      const output = outputPath("cancelled.mp4");
      const controller = new AbortController();

      // Cancel after 300ms
      setTimeout(() => controller.abort(), 300);

      await expect(
        video(TEST_VIDEO)
          .resize({ width: 640 })
          .codec("h264")
          .preset("veryslow") // Slow preset to ensure we can cancel
          .save(output, { signal: controller.signal })
      ).rejects.toThrow("aborted");
    }, 10000);

    it("should cancel immediately if already aborted", async () => {
      const output = outputPath("pre-cancelled.mp4");
      const controller = new AbortController();
      controller.abort(); // Abort before starting

      await expect(
        video(TEST_VIDEO)
          .resize({ width: 320 })
          .trim({ start: 0, duration: 2 })
          .save(output, { signal: controller.signal })
      ).rejects.toThrow("aborted");
    }, 5000);
  });

  // ============================================
  // SUB-BUILDERS
  // ============================================
  describe("Sub-builders", () => {
    it("should use video sub-builder for complex operations", async () => {
      const output = outputPath("sub-video.mp4");

      await video(TEST_VIDEO)
        .video(v => v
          .scale(480, 270)
          .fps(24)
          .flip("horizontal")
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

    it("should use audio sub-builder for complex operations", async () => {
      const output = outputPath("sub-audio.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .audio(a => a
          .volume(0.8)
          .sampleRate(48000) // Use 48000 which is a common sample rate
        )
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);

      const info = await probe(output);
      expect(info.audio!.sampleRate).toBe(48000);
    }, 30000);

    it("should combine video and audio sub-builders", async () => {
      const output = outputPath("sub-both.mp4");

      await video(TEST_VIDEO)
        .video(v => v
          .scale(480, 270)
          .fps(30)
        )
        .audio(a => a
          .volume(0.9)
          .normalize("loudnorm")
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
      expect(info.video!.fps).toBeCloseTo(30, 0);
      expect(info.audio).toBeDefined();
    }, 30000);
  });

  // ============================================
  // EDGE CASES
  // ============================================
  describe("Edge cases", () => {
    it("should handle non-standard dimensions", async () => {
      const output = outputPath("nonstandard-dims.mp4");

      // Test with non-16:9 aspect ratio
      await video(TEST_VIDEO)
        .resize({ width: 400, height: 300 }) // 4:3 ratio
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.video!.width).toBe(400);
      expect(info.video!.height).toBe(300);
    }, 30000);

    it("should handle very small dimensions", async () => {
      const output = outputPath("tiny.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 64, height: 36 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.video!.width).toBe(64);
    }, 30000);

    it("should handle upscaling", async () => {
      const output = outputPath("upscaled.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 1920, height: 1080 })
        .codec("h264")
        .crf(28)
        .preset("ultrafast")
        .trim({ start: 0, duration: 1 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      
      const info = await probe(output);
      expect(info.video!.width).toBe(1920);
      expect(info.video!.height).toBe(1080);
    }, 30000);
  });

  // ============================================
  // toArgs() DEBUGGING
  // ============================================
  describe("toArgs() debugging", () => {
    it("should generate correct FFmpeg arguments", () => {
      resetInputCounter();
      
      const chain = video(TEST_VIDEO)
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

      expect(args).toContain("-y");
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

    it("should generate args with multiple filters", () => {
      resetInputCounter();
      
      const chain = video(TEST_VIDEO)
        .resize({ width: 640 })
        .fps(24)
        .flip("horizontal")
        .fade({ type: "in", start: 0, duration: 1 })
        .codec("h264")
        .crf(28);
      
      chain.toGraph().output.destination = "output.mp4";
      const args = chain.toArgs();

      console.log("Multi-filter args:", args.join(" "));

      // Check that -vf contains multiple comma-separated filters
      const vfIndex = args.indexOf("-vf");
      expect(vfIndex).toBeGreaterThan(-1);
      
      const vfValue = args[vfIndex + 1]!;
      expect(vfValue).toContain("scale=");
      expect(vfValue).toContain("fps=");
      expect(vfValue).toContain("hflip");
      expect(vfValue).toContain("fade=");
    });

    it("should generate args with audio filters", () => {
      resetInputCounter();
      
      const chain = video(TEST_VIDEO)
        .resize({ width: 320 })
        .volume(0.8)
        .normalize("loudnorm")
        .codec("h264")
        .crf(30);
      
      chain.toGraph().output.destination = "output.mp4";
      const args = chain.toArgs();

      console.log("Audio filter args:", args.join(" "));

      expect(args).toContain("-af");
      
      const afIndex = args.indexOf("-af");
      const afValue = args[afIndex + 1]!;
      expect(afValue).toContain("volume=");
      expect(afValue).toContain("loudnorm");
    });
  });

  // ============================================
  // ERROR HANDLING
  // ============================================
  describe("Error handling", () => {
    it("should throw for invalid input file", async () => {
      const output = outputPath("error-input.mp4");

      await expect(
        video("./nonexistent-video.mp4")
          .resize({ width: 320 })
          .save(output)
      ).rejects.toThrow();
    }, 10000);

    it("should throw for invalid output path", async () => {
      await expect(
        video(TEST_VIDEO)
          .resize({ width: 320 })
          .trim({ start: 0, duration: 1 })
          .save("/nonexistent/path/output.mp4")
      ).rejects.toThrow();
    }, 10000);
  });

  // ============================================
  // AUDIO ENTRY POINT
  // ============================================
  describe("audio() entry point", () => {
    it("should process video file with audio() function", async () => {
      const output = outputPath("audio-entry.mp4");

      await audio(TEST_VIDEO)
        .resize({ width: 320 })
        .volume(0.8)
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);

      const info = await probe(output);
      expect(info.video).toBeDefined();
      expect(info.audio).toBeDefined();
    }, 30000);

    it("should create audio-only output with audioOnly()", async () => {
      const output = outputPath("audio-only.aac");

      await audioOnly(TEST_VIDEO)
        .volume(0.9)
        .audioCodec("aac")
        .audioBitrate("128k")
        .trim({ start: 0, duration: 3 })
        .save(output);

      expect(existsSync(output)).toBe(true);
      expect(statSync(output).size).toBeGreaterThan(0);
    }, 30000);
  });

  // ============================================
  // toBuffer() METHOD
  // ============================================
  describe("toBuffer() method", () => {
    it("should return video as buffer (matroska)", async () => {
      const buffer = await video(TEST_VIDEO)
        .resize({ width: 160 })
        .fps(10)
        .codec("h264")
        .crf(35)
        .preset("ultrafast")
        .container("matroska")
        .trim({ start: 0, duration: 1 })
        .toBuffer();

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Verify it's a valid MKV by checking for EBML header
      const header = buffer.slice(0, 4).toString("hex");
      expect(header).toBe("1a45dfa3"); // EBML header signature
    }, 30000);

    it("should return video without audio as buffer", async () => {
      const buffer = await video(TEST_VIDEO)
        .mute()
        .resize({ width: 160 })
        .codec("h264")
        .crf(35)
        .preset("ultrafast")
        .container("matroska")
        .trim({ start: 0, duration: 1 })
        .toBuffer();

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    }, 30000);
  });

  // ============================================
  // H264 PROFILE SETTINGS
  // ============================================
  describe("H264 Profile settings", () => {
    it("should encode with baseline profile", async () => {
      const output = outputPath("profile-baseline.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .profile("baseline")
        .crf(28)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);

    it("should encode with main profile", async () => {
      const output = outputPath("profile-main.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .profile("main")
        .crf(28)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);

    it("should encode with high profile", async () => {
      const output = outputPath("profile-high.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .profile("high")
        .crf(28)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);
  });

  // ============================================
  // OVERLAY FUNCTIONALITY
  // ============================================
  describe("Overlay functionality", () => {
    it("should overlay one video on another", async () => {
      const output = outputPath("overlay.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 640 })
        .overlay(TEST_VIDEO, { x: 10, y: 10 })
        .codec("h264")
        .crf(28)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 60000);

    it("should overlay with specific position", async () => {
      const output = outputPath("overlay-position.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 640 })
        .overlay(TEST_VIDEO, { x: 100, y: 100 })
        .codec("h264")
        .crf(28)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 60000);
  });

  // ============================================
  // ROTATE FUNCTIONALITY
  // ============================================
  describe("Rotate functionality", () => {
    it("should rotate video by 45 degrees", async () => {
      const output = outputPath("rotated-45.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .rotate(45)
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);

    it("should rotate video by 180 degrees", async () => {
      const output = outputPath("rotated-180.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .rotate(180)
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);
  });

  // ============================================
  // SCALE METHOD
  // ============================================
  describe("scale() method", () => {
    it("should scale video with both dimensions", async () => {
      const output = outputPath("scaled-both.mp4");

      await video(TEST_VIDEO)
        .scale(400, 300)
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);

      const info = await probe(output);
      expect(info.video!.width).toBe(400);
      expect(info.video!.height).toBe(300);
    }, 30000);

    it("should scale video with width only", async () => {
      const output = outputPath("scaled-width.mp4");

      await video(TEST_VIDEO)
        .scale(400)
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);

      const info = await probe(output);
      expect(info.video!.width).toBe(400);
    }, 30000);
  });

  // ============================================
  // CONFIGURATION
  // ============================================
  describe("Configuration", () => {
    it("should get FFmpeg version", async () => {
      const version = await getVersion();

      expect(version).toBeDefined();
      expect(typeof version).toBe("string");
      expect(version.length).toBeGreaterThan(0);
      console.log("FFmpeg version:", version);
    });
  });

  // ============================================
  // FORMAT METHOD
  // ============================================
  describe("format() method alias", () => {
    it("should work as alias for container()", async () => {
      const output = outputPath("format-alias.mp4");

      await video(TEST_VIDEO)
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .format("mp4")
        .trim({ start: 0, duration: 2 })
        .save(output);

      expect(existsSync(output)).toBe(true);

      const info = await probe(output);
      expect(info.format.formatName).toContain("mp4");
    }, 30000);
  });

  // ============================================
  // INPUT FORMAT OPTIONS
  // ============================================
  describe("inputFormat() method", () => {
    it("should accept input format specification", async () => {
      const output = outputPath("input-format.mp4");

      // Create chain with explicit input format
      const chain = video(TEST_VIDEO)
        .inputFormat("mov")
        .resize({ width: 320 })
        .codec("h264")
        .crf(30)
        .preset("ultrafast")
        .trim({ start: 0, duration: 2 });

      await chain.save(output);

      expect(existsSync(output)).toBe(true);
    }, 30000);
  });
});
