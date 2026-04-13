/**
 * Sanitizes user input to prevent prompt injection attacks
 */
export function sanitizeUserInput(input: string): string {
  if (!input) return "";

  const sanitized = input
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\b(ignore|disregard|forget)\s+(previous|above|all)\s+(instructions?|prompts?|rules?|context)/gi, "[FILTERED]")
    .replace(/\b(system|assistant|user)\s*:/gi, "[FILTERED]")
    .replace(/<\/?transcript>/gi, "[FILTERED]")
    .replace(/<\/?text>/gi, "[FILTERED]")
    .replace(/<\/?content>/gi, "[FILTERED]")
    .trim();

  return sanitized;
}

/**
 * Validates that user input doesn't contain malicious prompt injection patterns
 */
export function validateUserInput(input: string): {
  isValid: boolean;
  warning?: string;
  severity?: 'low' | 'medium' | 'high';
} {
  if (!input) return { isValid: true };

  const highSeverityPatterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?|commands?)/i,
    /disregard\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/i,
    /forget\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|context)/i,
    /\b(show|reveal|print|display|return|tell|give|extract|dump|expose|leak)\b[\s\S]{0,80}\b(api[_\s-]?key|secret|access[_\s-]?token|password|environment[_\s-]?variable)s?\b/i,
  ];

  const mediumSeverityPatterns = [
    /^\s*(system|assistant|user)\s*:/i,
    /(role|act|behave|pretend)\s+(as|like)\s+(system|admin|root|assistant)/i,
    /you\s+are\s+(now\s+)?(a\s+|an\s+)?(system|admin|root)/i,
  ];

  for (const pattern of highSeverityPatterns) {
    if (pattern.test(input)) {
      return {
        isValid: false,
        warning: "Input contains suspicious patterns that may attempt to manipulate AI behavior or access sensitive information",
        severity: 'high',
      };
    }
  }

  for (const pattern of mediumSeverityPatterns) {
    if (pattern.test(input)) {
      return {
        isValid: false,
        warning: "Input contains patterns that may attempt to manipulate AI role or behavior",
        severity: 'medium',
      };
    }
  }

  return { isValid: true };
}

/**
 * Wraps user input in explicit XML-style delimiters to prevent prompt injection
 */
export function wrapUserInput(input: string, tag: string = 'transcript'): string {
  const sanitized = sanitizeUserInput(input);
  return `<${tag}>\n${sanitized}\n</${tag}>`;
}
