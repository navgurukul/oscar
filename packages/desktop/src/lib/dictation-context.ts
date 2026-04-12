import type {
  DictationCategory,
  DictationContextSnapshot,
  DictationRoutingResult,
} from "../types/note.types";

export const STREAM_PROMPT_VERSION = "stream-v1";

const GENERIC_BROWSER_APPS = [
  { key: "arc", match: ["arc", "company.thebrowser.browser"] },
  { key: "chrome", match: ["google chrome", "chrome.exe", "com.google.chrome"] },
  { key: "safari", match: ["safari", "com.apple.safari"] },
  { key: "edge", match: ["microsoft edge", "msedge.exe", "com.microsoft.edgemac"] },
  { key: "brave", match: ["brave", "brave.exe", "com.brave.browser"] },
  { key: "firefox", match: ["firefox", "firefox.exe", "org.mozilla.firefox"] },
  { key: "opera", match: ["opera", "opera.exe", "com.operasoftware.opera"] },
] as const;

const SITE_RULES: Array<{
  category: DictationCategory;
  appKey: string;
  hosts: string[];
}> = [
  { category: "email", appKey: "gmail", hosts: ["mail.google.com"] },
  {
    category: "email",
    appKey: "outlook-web",
    hosts: ["outlook.office.com", "outlook.live.com", "mail.office365.com"],
  },
  { category: "docs", appKey: "google-docs", hosts: ["docs.google.com"] },
  { category: "docs", appKey: "notion", hosts: ["notion.so", "www.notion.so"] },
  {
    category: "docs",
    appKey: "confluence",
    hosts: ["atlassian.net", "confluence.atlassian.com"],
  },
  { category: "chat", appKey: "slack", hosts: ["app.slack.com", "slack.com"] },
  { category: "chat", appKey: "discord", hosts: ["discord.com", "discordapp.com"] },
  {
    category: "chat",
    appKey: "teams-web",
    hosts: ["teams.microsoft.com", "teams.live.com"],
  },
  { category: "chat", appKey: "whatsapp-web", hosts: ["web.whatsapp.com"] },
  { category: "chat", appKey: "claude", hosts: ["claude.ai"] },
  { category: "chat", appKey: "chatgpt", hosts: ["chatgpt.com", "chat.openai.com"] },
  { category: "chat", appKey: "gemini", hosts: ["gemini.google.com"] },
] as const;

const APP_RULES: Array<{
  category: DictationCategory;
  appKey: string;
  matches: string[];
}> = [
  { category: "ide", appKey: "cursor", matches: ["cursor", "com.todesktop.230313mzl4w4u92"] },
  { category: "ide", appKey: "windsurf", matches: ["windsurf"] },
  { category: "ide", appKey: "vscode", matches: ["visual studio code", "code.exe", "com.microsoft.vscode"] },
  { category: "ide", appKey: "zed", matches: ["zed", "dev.zed.zed"] },
  {
    category: "ide",
    appKey: "jetbrains",
    matches: [
      "jetbrains",
      "android studio",
      "intellij",
      "pycharm",
      "webstorm",
      "goland",
      "datagrip",
      "rubymine",
      "clion",
      "phpstorm",
    ],
  },
  { category: "chat", appKey: "claude-desktop", matches: ["claude"] },
  { category: "email", appKey: "apple-mail", matches: ["mail", "com.apple.mail"] },
  { category: "email", appKey: "outlook", matches: ["outlook", "olk.exe", "com.microsoft.outlook"] },
  { category: "email", appKey: "superhuman", matches: ["superhuman"] },
  { category: "docs", appKey: "notion", matches: ["notion"] },
  { category: "docs", appKey: "word", matches: ["microsoft word", "winword.exe", "com.microsoft.word"] },
  { category: "docs", appKey: "obsidian", matches: ["obsidian", "md.obsidian"] },
  { category: "docs", appKey: "craft", matches: ["craft", "com.lukilabs.lukiapp"] },
  { category: "chat", appKey: "slack", matches: ["slack"] },
  { category: "chat", appKey: "discord", matches: ["discord"] },
  { category: "chat", appKey: "teams", matches: ["microsoft teams", "teams", "teams.exe"] },
  { category: "chat", appKey: "messages", matches: ["messages", "com.apple.messages"] },
] as const;

function normalize(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeHost(value?: string | null): string {
  return normalize(value)
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0];
}

function hostMatches(host: string, ruleHost: string): boolean {
  const normalizedRule = normalizeHost(ruleHost);
  return host === normalizedRule || host.endsWith(`.${normalizedRule}`);
}

function resolveSiteRule(host: string) {
  return SITE_RULES.find((rule) =>
    rule.hosts.some((ruleHost) => hostMatches(host, ruleHost)),
  );
}

function resolveAppRule(haystacks: string[]) {
  return APP_RULES.find((rule) =>
    rule.matches.some((candidate) =>
      haystacks.some((haystack) => haystack.includes(candidate)),
    ),
  );
}

function resolveGenericBrowser(haystacks: string[]) {
  return GENERIC_BROWSER_APPS.find((rule) =>
    rule.match.some((candidate) =>
      haystacks.some((haystack) => haystack.includes(candidate)),
    ),
  );
}

export function isContextAwarePlatform(platform?: string | null): boolean {
  const normalizedPlatform = normalize(platform);
  return normalizedPlatform === "macos" || normalizedPlatform === "windows";
}

export function routeDictationContext(
  snapshot?: DictationContextSnapshot | null,
): DictationRoutingResult {
  if (!snapshot) {
    return {
      category: "default",
      appKey: "default",
      source: "fallback",
      confidence: "low",
      promptVersion: STREAM_PROMPT_VERSION,
    };
  }

  const siteHost = normalizeHost(snapshot.siteHost);
  if (siteHost) {
    const siteRule = resolveSiteRule(siteHost);
    if (siteRule) {
      return {
        category: siteRule.category,
        appKey: siteRule.appKey,
        source: "site",
        confidence: "high",
        promptVersion: STREAM_PROMPT_VERSION,
      };
    }
  }

  const haystacks = [
    normalize(snapshot.appName),
    normalize(snapshot.appId),
    normalize(snapshot.processName),
  ].filter(Boolean);

  const appRule = resolveAppRule(haystacks);
  if (appRule) {
    return {
      category: appRule.category,
      appKey: appRule.appKey,
      source: "app",
      confidence: "high",
      promptVersion: STREAM_PROMPT_VERSION,
    };
  }

  const genericBrowser = resolveGenericBrowser(haystacks);
  if (genericBrowser) {
    return {
      category: "browser",
      appKey: genericBrowser.key,
      source: "app",
      confidence: siteHost ? "high" : "medium",
      promptVersion: STREAM_PROMPT_VERSION,
    };
  }

  return {
    category: "default",
    appKey: "default",
    source: "fallback",
    confidence: "low",
    promptVersion: STREAM_PROMPT_VERSION,
  };
}
