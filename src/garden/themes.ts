export const GARDEN_VARIANTS = ["light", "neutral", "dark"] as const;

export type GardenVariant = (typeof GARDEN_VARIANTS)[number];

export interface GardenTheme {
  variant: GardenVariant;
  label: string;
}

export const GARDEN_THEMES: readonly GardenTheme[] = [
  { variant: "light", label: "Sunken terrace" },
  { variant: "neutral", label: "Moss court" },
  { variant: "dark", label: "Night orchard" },
];
