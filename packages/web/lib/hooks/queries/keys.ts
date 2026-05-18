export const queryKeys = {
  meetings: ["meetings"] as const,
  scribbles: ["scribbles"] as const,
  trashedScribbles: ["scribbles", "trashed"] as const,
  scribble: (id: string) => ["scribbles", id] as const,
  folders: ["folders"] as const,
};
