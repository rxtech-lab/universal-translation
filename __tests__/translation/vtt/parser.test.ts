import { describe, expect, it } from "vitest";
import {
  msToTimestamp,
  parseVtt,
  serializeVtt,
  timestampToMs,
} from "@/lib/translation/vtt/parser";

describe("timestampToMs", () => {
  it("converts HH:MM:SS.mmm format", () => {
    expect(timestampToMs("00:01:23.456")).toBe(83456);
  });

  it("converts MM:SS.mmm format", () => {
    expect(timestampToMs("01:23.456")).toBe(83456);
  });

  it("handles zero timestamp", () => {
    expect(timestampToMs("00:00:00.000")).toBe(0);
  });

  it("handles large values", () => {
    expect(timestampToMs("02:30:45.100")).toBe(9045100);
  });
});

describe("msToTimestamp", () => {
  it("converts milliseconds to HH:MM:SS.mmm", () => {
    expect(msToTimestamp(83456)).toBe("00:01:23.456");
  });

  it("handles zero", () => {
    expect(msToTimestamp(0)).toBe("00:00:00.000");
  });

  it("pads values correctly", () => {
    expect(msToTimestamp(1001)).toBe("00:00:01.001");
  });
});

describe("parseVtt", () => {
  it("parses a basic WebVTT file", () => {
    const input = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello world

00:00:05.000 --> 00:00:08.000
Second subtitle`;

    const { header, cues } = parseVtt(input);
    expect(header).toBe("WEBVTT");
    expect(cues).toHaveLength(2);
    expect(cues[0].index).toBe(1);
    expect(cues[0].startTimestamp).toBe("00:00:01.000");
    expect(cues[0].endTimestamp).toBe("00:00:04.000");
    expect(cues[0].text).toBe("Hello world");
    expect(cues[1].index).toBe(2);
    expect(cues[1].text).toBe("Second subtitle");
  });

  it("handles cue IDs", () => {
    const input = `WEBVTT

intro
00:00:01.000 --> 00:00:04.000
Hello world

outro
00:00:05.000 --> 00:00:08.000
Goodbye`;

    const { cues } = parseVtt(input);
    expect(cues).toHaveLength(2);
    expect(cues[0].id).toBe("intro");
    expect(cues[0].text).toBe("Hello world");
    expect(cues[1].id).toBe("outro");
    expect(cues[1].text).toBe("Goodbye");
  });

  it("handles multi-line cue text", () => {
    const input = `WEBVTT

00:00:01.000 --> 00:00:04.000
Line one
Line two
Line three`;

    const { cues } = parseVtt(input);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Line one\nLine two\nLine three");
  });

  it("handles cue settings", () => {
    const input = `WEBVTT

00:00:01.000 --> 00:00:04.000 position:10% align:start
Hello world`;

    const { cues } = parseVtt(input);
    expect(cues).toHaveLength(1);
    expect(cues[0].settings).toBe("position:10% align:start");
    expect(cues[0].text).toBe("Hello world");
  });

  it("handles BOM", () => {
    const input = `\uFEFFWEBVTT

00:00:01.000 --> 00:00:04.000
Hello`;

    const { cues } = parseVtt(input);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Hello");
  });

  it("handles CRLF line endings", () => {
    const input = "WEBVTT\r\n\r\n00:00:01.000 --> 00:00:04.000\r\nHello";

    const { cues } = parseVtt(input);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Hello");
  });

  it("skips NOTE blocks", () => {
    const input = `WEBVTT

NOTE This is a comment

00:00:01.000 --> 00:00:04.000
Hello`;

    const { cues } = parseVtt(input);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Hello");
  });

  it("skips STYLE blocks", () => {
    const input = `WEBVTT

STYLE
::cue {
  color: white;
}

00:00:01.000 --> 00:00:04.000
Hello`;

    const { cues } = parseVtt(input);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Hello");
  });

  it("preserves header with description", () => {
    const input = `WEBVTT - This file has subtitles

00:00:01.000 --> 00:00:04.000
Hello`;

    const { header, cues } = parseVtt(input);
    expect(header).toBe("WEBVTT - This file has subtitles");
    expect(cues).toHaveLength(1);
  });

  it("handles MM:SS.mmm timestamps", () => {
    const input = `WEBVTT

01:23.456 --> 02:34.567
Short format`;

    const { cues } = parseVtt(input);
    expect(cues).toHaveLength(1);
    expect(cues[0].startMs).toBe(83456);
    expect(cues[0].endMs).toBe(154567);
  });

  it("returns empty cues for empty input", () => {
    const { cues } = parseVtt("");
    expect(cues).toHaveLength(0);
  });

  it("returns empty cues for header-only input", () => {
    const { cues } = parseVtt("WEBVTT");
    expect(cues).toHaveLength(0);
  });

  it("handles leading whitespace on timestamp lines", () => {
    const input = `WEBVTT

  00:00:01.000 --> 00:00:04.000
Hello with indented timestamp`;

    const { cues } = parseVtt(input);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Hello with indented timestamp");
  });
});

describe("serializeVtt", () => {
  it("serializes cues back to WebVTT format", () => {
    const cues = [
      {
        id: undefined,
        index: 1,
        startMs: 1000,
        endMs: 4000,
        startTimestamp: "00:00:01.000",
        endTimestamp: "00:00:04.000",
        settings: "",
        text: "Hello world",
      },
      {
        id: undefined,
        index: 2,
        startMs: 5000,
        endMs: 8000,
        startTimestamp: "00:00:05.000",
        endTimestamp: "00:00:08.000",
        settings: "",
        text: "Second subtitle",
      },
    ];

    const result = serializeVtt("WEBVTT", cues);
    expect(result).toBe(
      "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello world\n\n00:00:05.000 --> 00:00:08.000\nSecond subtitle\n",
    );
  });

  it("includes cue IDs when present", () => {
    const cues = [
      {
        id: "intro",
        index: 1,
        startMs: 1000,
        endMs: 4000,
        startTimestamp: "00:00:01.000",
        endTimestamp: "00:00:04.000",
        settings: "",
        text: "Hello",
      },
    ];

    const result = serializeVtt("WEBVTT", cues);
    expect(result).toBe(
      "WEBVTT\n\nintro\n00:00:01.000 --> 00:00:04.000\nHello\n",
    );
  });

  it("includes cue settings", () => {
    const cues = [
      {
        id: undefined,
        index: 1,
        startMs: 1000,
        endMs: 4000,
        startTimestamp: "00:00:01.000",
        endTimestamp: "00:00:04.000",
        settings: "position:10% align:start",
        text: "Hello",
      },
    ];

    const result = serializeVtt("WEBVTT", cues);
    expect(result).toBe(
      "WEBVTT\n\n00:00:01.000 --> 00:00:04.000 position:10% align:start\nHello\n",
    );
  });

  it("round-trips correctly", () => {
    const input = `WEBVTT

intro
00:00:01.000 --> 00:00:04.000 position:10%
Hello world

00:00:05.000 --> 00:00:08.000
Second subtitle
`;

    const { header, cues } = parseVtt(input);
    const output = serializeVtt(header, cues);
    expect(output).toBe(input);
  });
});
