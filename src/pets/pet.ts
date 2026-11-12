export type LifeStage = "egg" | "child" | "adult";
export type Temperament = "light" | "neutral" | "dark";

export interface Pet {
  id: string;
  name: string;
  stage: LifeStage;
  temperament: Temperament;
}

const TEMPERAMENT_ORDER: readonly Temperament[] = ["dark", "neutral", "light"];

export function createPet(id: string, name: string): Pet {
  return { id, name, stage: "egg", temperament: "neutral" };
}

export function advanceStage(stage: LifeStage): LifeStage {
  if (stage === "egg") return "child";
  if (stage === "child") return "adult";
  return "adult";
}

/** Step one notch toward the care that was given. Neutral care pulls back to the middle. */
export function leanTemperament(current: Temperament, care: Temperament): Temperament {
  const currentIndex = TEMPERAMENT_ORDER.indexOf(current);
  const careIndex = TEMPERAMENT_ORDER.indexOf(care);
  if (currentIndex === careIndex) return current;
  const next = currentIndex + Math.sign(careIndex - currentIndex);
  return TEMPERAMENT_ORDER[next] ?? current;
}
