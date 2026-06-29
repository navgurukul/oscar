export const queryKeys = {
  meetings: ["meetings"] as const,
  scribbles: ["scribbles"] as const,
  trashedScribbles: ["trashed-scribbles"] as const,
  scribble: (id: string) => ["scribbles", id] as const,
  folders: ["folders"] as const,
  activeOrg: ["org", "active"] as const,
};
