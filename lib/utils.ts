import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get context-aware prompt based on current time
 */
export function getTimeBasedPrompt(): string {
  const hour = new Date().getHours();

  // Morning (6 AM - 10 AM)
  if (hour >= 6 && hour < 10) {
    return "Dreamt anything weird? Catch it before it fades.";
  }

  // Work Hours (10 AM - 5 PM)
  if (hour >= 10 && hour < 17) {
    return "Meeting overload? Summarize the chaos.";
  }

  // Late Night (10 PM+)
  if (hour >= 22 || hour < 6) {
    return "Clear your head so you can sleep.";
  }

  // Evening (5 PM - 10 PM) - default fallback
  return "Capture your thoughts before they slip away.";
}
