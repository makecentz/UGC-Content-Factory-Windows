export const VIDEO_PROVIDER_OPTIONS = [
  {
    value: "local-comfyui-wan22",
    label: "Comfy Local (Wan 2.2)",
    description: "Local ComfyUI render with Wan 2.2"
  }
] as const;

export type VideoProviderOptionValue = (typeof VIDEO_PROVIDER_OPTIONS)[number]["value"];

export function videoProviderLabel(value?: string | null) {
  return VIDEO_PROVIDER_OPTIONS.find((option) => option.value === value)?.label || "Comfy Local (Wan 2.2)";
}
