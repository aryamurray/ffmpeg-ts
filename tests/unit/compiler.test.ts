import { describe, it, expect, beforeEach } from "vitest";
import { video } from "../../src/video.js";
import { resetInputCounter } from "../../src/ast/types.js";
import {
  serializeVideoFilter,
  serializeAudioFilter,
  serializeVideoFilterChain,
  serializeAudioFilterChain,
} from "../../src/compiler/filter-serializers.js";
import type { VideoFilter } from "../../src/ast/video-filters.js";
import type { AudioFilter } from "../../src/ast/audio-filters.js";

describe("Filter Serializers", () => {
  describe("Video Filters", () => {
    it("should serialize scale filter", () => {
      const filter: VideoFilter = { kind: "scale", width: 1920, height: 1080 };
      expect(serializeVideoFilter(filter)).toBe("scale=w=1920:h=1080");
    });

    it("should serialize scale filter with auto height", () => {
      const filter: VideoFilter = { kind: "scale", width: 1280, height: -1 };
      expect(serializeVideoFilter(filter)).toBe("scale=w=1280:h=-1");
    });

    it("should serialize scale filter with algorithm", () => {
      const filter: VideoFilter = { kind: "scale", width: 1280, height: 720, algorithm: "lanczos" };
      expect(serializeVideoFilter(filter)).toBe("scale=w=1280:h=720:flags=lanczos");
    });

    it("should serialize crop filter", () => {
      const filter: VideoFilter = { kind: "crop", width: 640, height: 480, x: 100, y: 50 };
      expect(serializeVideoFilter(filter)).toBe("crop=w=640:h=480:x=100:y=50");
    });

    it("should serialize crop filter with expressions", () => {
      const filter: VideoFilter = { kind: "crop", width: "iw/2", height: "ih/2", x: "iw/4", y: "ih/4" };
      expect(serializeVideoFilter(filter)).toBe("crop=w=iw/2:h=ih/2:x=iw/4:y=ih/4");
    });

    it("should serialize fps filter", () => {
      const filter: VideoFilter = { kind: "fps", value: 30 };
      expect(serializeVideoFilter(filter)).toBe("fps=30");
    });

    it("should serialize trim filter", () => {
      const filter: VideoFilter = { kind: "trim", start: 5, end: 10 };
      expect(serializeVideoFilter(filter)).toBe("trim=start=5:end=10,setpts=PTS-STARTPTS");
    });

    it("should serialize fade filter", () => {
      const filter: VideoFilter = { kind: "fade", type: "in", startTime: 0, duration: 2 };
      expect(serializeVideoFilter(filter)).toBe("fade=t=in:st=0:d=2");
    });

    it("should serialize flip filters", () => {
      expect(serializeVideoFilter({ kind: "flip", direction: "horizontal" })).toBe("hflip");
      expect(serializeVideoFilter({ kind: "flip", direction: "vertical" })).toBe("vflip");
    });

    it("should serialize transpose filter", () => {
      const filter: VideoFilter = { kind: "transpose", direction: 1 };
      expect(serializeVideoFilter(filter)).toBe("transpose=1");
    });

    it("should serialize pad filter", () => {
      const filter: VideoFilter = { kind: "pad", width: 1920, height: 1080, x: "(ow-iw)/2", y: "(oh-ih)/2", color: "black" };
      expect(serializeVideoFilter(filter)).toBe("pad=w=1920:h=1080:x=(ow-iw)/2:y=(oh-ih)/2:color=black");
    });
  });

  describe("Audio Filters", () => {
    it("should serialize volume filter with number", () => {
      const filter: AudioFilter = { kind: "volume", value: 0.5 };
      expect(serializeAudioFilter(filter)).toBe("volume=0.5");
    });

    it("should serialize volume filter with dB", () => {
      const filter: AudioFilter = { kind: "volume", value: "-3dB" };
      expect(serializeAudioFilter(filter)).toBe("volume=-3dB");
    });

    it("should serialize loudnorm filter", () => {
      const filter: AudioFilter = { kind: "normalize", type: "loudnorm" };
      expect(serializeAudioFilter(filter)).toBe("loudnorm");
    });

    it("should serialize loudnorm filter with options", () => {
      const filter: AudioFilter = { kind: "normalize", type: "loudnorm", targetLoudness: -16, truePeak: -1 };
      expect(serializeAudioFilter(filter)).toBe("loudnorm=I=-16:TP=-1");
    });

    it("should serialize dynaudnorm filter", () => {
      const filter: AudioFilter = { kind: "normalize", type: "dynaudnorm" };
      expect(serializeAudioFilter(filter)).toBe("dynaudnorm");
    });

    it("should serialize afade filter", () => {
      const filter: AudioFilter = { kind: "afade", type: "out", startTime: 10, duration: 3 };
      expect(serializeAudioFilter(filter)).toBe("afade=t=out:st=10:d=3");
    });

    it("should serialize atrim filter", () => {
      const filter: AudioFilter = { kind: "atrim", start: 5, duration: 10 };
      expect(serializeAudioFilter(filter)).toBe("atrim=start=5:duration=10,asetpts=PTS-STARTPTS");
    });

    it("should serialize aresample filter", () => {
      const filter: AudioFilter = { kind: "aresample", sampleRate: 48000 };
      expect(serializeAudioFilter(filter)).toBe("aresample=48000");
    });

    it("should serialize highpass filter", () => {
      const filter: AudioFilter = { kind: "highpass", frequency: 200 };
      expect(serializeAudioFilter(filter)).toBe("highpass=f=200");
    });

    it("should serialize lowpass filter", () => {
      const filter: AudioFilter = { kind: "lowpass", frequency: 3000 };
      expect(serializeAudioFilter(filter)).toBe("lowpass=f=3000");
    });
  });

  describe("Filter Chains", () => {
    it("should serialize video filter chain", () => {
      const filters: VideoFilter[] = [
        { kind: "scale", width: 1280, height: 720 },
        { kind: "fps", value: 30 },
      ];
      expect(serializeVideoFilterChain(filters)).toBe("scale=w=1280:h=720,fps=30");
    });

    it("should serialize audio filter chain", () => {
      const filters: AudioFilter[] = [
        { kind: "volume", value: 0.8 },
        { kind: "normalize", type: "loudnorm" },
      ];
      expect(serializeAudioFilterChain(filters)).toBe("volume=0.8,loudnorm");
    });

    it("should return empty string for empty filter chain", () => {
      expect(serializeVideoFilterChain([])).toBe("");
      expect(serializeAudioFilterChain([])).toBe("");
    });
  });
});

describe("MediaChain Compiler", () => {
  beforeEach(() => {
    resetInputCounter();
  });

  it("should generate basic args for simple conversion", () => {
    const args = video("input.mp4").save("output.mp4");
    // We can't test save() directly without FFmpeg, but we can test toArgs()
    const chain = video("input.mp4");
    chain.toGraph().output.destination = "output.mp4";
    const compiledArgs = chain.toArgs();
    
    expect(compiledArgs).toContain("-i");
    expect(compiledArgs).toContain("input.mp4");
    expect(compiledArgs).toContain("output.mp4");
    expect(compiledArgs).toContain("-y"); // overwrite by default
  });

  it("should generate args with resize", () => {
    const chain = video("input.mp4").resize({ width: 1280, height: 720 });
    chain.toGraph().output.destination = "output.mp4";
    const args = chain.toArgs();

    expect(args).toContain("-vf");
    expect(args.some(arg => arg.includes("scale="))).toBe(true);
  });

  it("should generate args with fps", () => {
    const chain = video("input.mp4").fps(30);
    chain.toGraph().output.destination = "output.mp4";
    const args = chain.toArgs();

    expect(args).toContain("-vf");
    expect(args.some(arg => arg.includes("fps=30"))).toBe(true);
  });

  it("should generate args with codec", () => {
    const chain = video("input.mp4").codec("h264").bitrate("4M");
    chain.toGraph().output.destination = "output.mp4";
    const args = chain.toArgs();

    expect(args).toContain("-c:v");
    expect(args).toContain("libx264");
    expect(args).toContain("-b:v");
    expect(args).toContain("4M");
  });

  it("should generate args with CRF", () => {
    const chain = video("input.mp4").codec("h264").crf(23);
    chain.toGraph().output.destination = "output.mp4";
    const args = chain.toArgs();

    expect(args).toContain("-crf");
    expect(args).toContain("23");
  });

  it("should generate args with preset", () => {
    const chain = video("input.mp4").codec("h264").preset("fast");
    chain.toGraph().output.destination = "output.mp4";
    const args = chain.toArgs();

    expect(args).toContain("-preset");
    expect(args).toContain("fast");
  });

  it("should generate args with audio codec", () => {
    const chain = video("input.mp4").audioCodec("aac").audioBitrate("192k");
    chain.toGraph().output.destination = "output.mp4";
    const args = chain.toArgs();

    expect(args).toContain("-c:a");
    expect(args).toContain("aac");
    expect(args).toContain("-b:a");
    expect(args).toContain("192k");
  });

  it("should generate args with mute", () => {
    const chain = video("input.mp4").mute();
    chain.toGraph().output.destination = "output.mp4";
    const args = chain.toArgs();

    expect(args).toContain("-an");
  });

  it("should generate args with container format", () => {
    const chain = video("input.mp4").container("webm");
    chain.toGraph().output.destination = "output.webm";
    const args = chain.toArgs();

    expect(args).toContain("-f");
    expect(args).toContain("webm");
  });

  it("should generate args with fastStart", () => {
    const chain = video("input.mp4").fastStart();
    chain.toGraph().output.destination = "output.mp4";
    const args = chain.toArgs();

    expect(args).toContain("-movflags");
    expect(args).toContain("+faststart");
  });

  it("should combine video and audio filters", () => {
    const chain = video("input.mp4")
      .resize({ width: 1280 })
      .fps(30)
      .volume(0.8)
      .normalize();
    chain.toGraph().output.destination = "output.mp4";
    const args = chain.toArgs();

    expect(args).toContain("-vf");
    expect(args).toContain("-af");
    expect(args.some(arg => arg.includes("scale="))).toBe(true);
    expect(args.some(arg => arg.includes("volume=0.8"))).toBe(true);
    expect(args.some(arg => arg.includes("loudnorm"))).toBe(true);
  });

  it("should use video sub-builder", () => {
    const chain = video("input.mp4")
      .video(v => v.scale(1920, 1080).fps(60));
    chain.toGraph().output.destination = "output.mp4";
    const args = chain.toArgs();

    expect(args).toContain("-vf");
    expect(args.some(arg => arg.includes("scale=w=1920:h=1080"))).toBe(true);
    expect(args.some(arg => arg.includes("fps=60"))).toBe(true);
  });

  it("should use audio sub-builder", () => {
    const chain = video("input.mp4")
      .audio(a => a.volume(0.5).normalize("dynaudnorm"));
    chain.toGraph().output.destination = "output.mp4";
    const args = chain.toArgs();

    expect(args).toContain("-af");
    expect(args.some(arg => arg.includes("volume=0.5"))).toBe(true);
    expect(args.some(arg => arg.includes("dynaudnorm"))).toBe(true);
  });
});
