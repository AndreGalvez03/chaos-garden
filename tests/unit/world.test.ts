import { describe, expect, it } from "vitest";
import { advanceStage, createPet, leanTemperament } from "../../src/pets";
import { GARDEN_THEMES, GARDEN_VARIANTS } from "../../src/garden";
import { AudioBus } from "../../src/audio/audio-bus";

describe("pets", () => {
  it("grows from egg to child to adult and then stays adult", () => {
    const pet = createPet("pip", "Pip");
    expect(pet.stage).toBe("egg");
    expect(pet.temperament).toBe("neutral");
    expect(advanceStage(pet.stage)).toBe("child");
    expect(advanceStage("child")).toBe("adult");
    expect(advanceStage("adult")).toBe("adult");
  });

  it("leans one step toward the care it was given", () => {
    expect(leanTemperament("neutral", "light")).toBe("light");
    expect(leanTemperament("dark", "light")).toBe("neutral");
    expect(leanTemperament("light", "neutral")).toBe("neutral");
    expect(leanTemperament("light", "light")).toBe("light");
  });
});

describe("gardens", () => {
  it("lists the three variants", () => {
    expect(GARDEN_VARIANTS).toEqual(["light", "neutral", "dark"]);
    expect(GARDEN_THEMES).toHaveLength(3);
  });
});

describe("audio bus", () => {
  it("tracks mute without playing a cue", () => {
    const audio = new AudioBus();
    audio.play("ui");
    audio.setMuted(true);
    audio.play("ui");
    expect(audio.isMuted).toBe(true);
  });
});
