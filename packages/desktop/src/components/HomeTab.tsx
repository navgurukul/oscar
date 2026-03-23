import { TranscriptsSection } from "./TranscriptsSection";
import type { LocalTranscript } from "../types/note.types";

interface HomeTabProps {
  userName: string;
  userId: string;
  totalNotes?: number;
  localTranscripts: LocalTranscript[];
  onDeleteTranscript: (id: string) => void;
  onClearAllTranscripts: () => void;
}

// App icons wrapper - shows grayscale by default, full color on hover
const AppIconWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="opacity-50 hover:opacity-100 transition-opacity duration-200">
    {children}
  </div>
);

// Multi-color brand logo SVGs
const AppIcons = {
  Slack: () => (
    <AppIconWrapper>
      <svg viewBox="0 0 127 127" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
        <rect x="27.2" y="78.8" width="22.4" height="22.4" fill="#E01E5A"/>
        <rect x="5.6" y="78.8" width="22.4" height="22.4" fill="#36C5F0"/>
        <rect x="5.6" y="56.4" width="22.4" height="22.4" fill="#2EB67D"/>
        <rect x="5.6" y="33.8" width="22.4" height="22.4" fill="#ECB22E"/>
        <rect x="27.2" y="33.8" width="22.4" height="22.4" fill="#E01E5A"/>
      </svg>
    </AppIconWrapper>
  ),
  Notion: () => (
    <AppIconWrapper>
      <svg viewBox="0 0 100 100" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
        <path d="M6.75 0.5L93.25 7L100 93.5L6.75 100Q0 100 0 93.25L0 7Q0 0.5 6.75 0.5Z" fill="#000"/>
        <path d="M75 11L87 9L87 72Q87 80 81 82L19 87Q11 88 11 80L11 20Q11 14 17 13L75 11M75 20L17 22L17 78L75 76Z" fill="#fff"/>
      </svg>
    </AppIconWrapper>
  ),
  VSCode: () => (
    <AppIconWrapper>
      <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
        <path d="M16.5 2L8.5 7V17L16.5 22H22V2Z" fill="#0098FF"/>
        <path d="M7 10L2 13V14L7 17" fill="#00D4FF"/>
        <path d="M12 9L9 12L12 15" fill="#fff" opacity="0.5"/>
      </svg>
    </AppIconWrapper>
  ),
  GoogleDocs: () => (
    <AppIconWrapper>
      <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 2H16V8H22V22H2V2H8Z" fill="#4285F4"/>
        <path d="M8 2H2V22H22V8H16V2H8Z" fill="#FFFFFF" opacity="0.5"/>
      </svg>
    </AppIconWrapper>
  ),
  Chrome: () => (
    <AppIconWrapper>
      <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="#4285F4"/>
        <circle cx="12" cy="12" r="6" fill="#FFFFFF" opacity="0.3"/>
      </svg>
    </AppIconWrapper>
  ),
  Discord: () => (
    <AppIconWrapper>
      <svg viewBox="0 0 127 127" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
        <path d="M108 14L95 108H32L19 14H108Z" fill="#5865F2"/>
        <circle cx="38" cy="60" r="4" fill="#FFFFFF"/>
        <circle cx="89" cy="60" r="4" fill="#FFFFFF"/>
      </svg>
    </AppIconWrapper>
  ),
  Teams: () => (
    <AppIconWrapper>
      <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="4" width="6" height="6" fill="#6264A7"/>
        <rect x="12" y="4" width="6" height="6" fill="#50E6FF"/>
        <rect x="4" y="12" width="6" height="6" fill="#FF8C00"/>
        <rect x="12" y="12" width="6" height="6" fill="#7FBA00"/>
      </svg>
    </AppIconWrapper>
  ),
  Figma: () => (
    <AppIconWrapper>
      <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="6" cy="6" r="3" fill="#F24E1E"/>
        <circle cx="18" cy="6" r="3" fill="#FF7262"/>
        <circle cx="6" cy="18" r="3" fill="#A259FF"/>
        <circle cx="12" cy="18" r="3" fill="#00D084"/>
        <rect x="9" y="9" width="6" height="6" fill="#F24E1E"/>
      </svg>
    </AppIconWrapper>
  ),
  GitHub: () => (
    <AppIconWrapper>
      <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.37 0 0 5.37 0 12C0 17.31 3.435 21.8 8.205 23.385C8.805 23.49 9.02 23.13 9.02 22.81V20.575C5.662 21.302 4.967 19.16 4.967 19.16C4.422 17.8 3.634 17.44 3.634 17.44C2.546 16.73 3.717 16.73 3.717 16.73C4.922 16.84 5.555 17.94 5.555 17.94C6.625 19.745 8.385 19.16 9.02 18.84C9.125 18.12 9.427 17.595 9.73 17.295C7.08 16.995 4.303 15.995 4.303 11.38C4.303 10.07 4.81 8.98 5.567 8.15C5.452 7.85 5.042 6.635 5.682 4.975C5.682 4.975 6.732 4.655 9.02 6.21C10.02 5.95 11.07 5.81 12.12 5.81C13.17 5.81 14.22 5.95 15.22 6.21C17.508 4.655 18.558 4.975 18.558 4.975C19.198 6.635 18.788 7.85 18.673 8.15C19.43 8.98 19.937 10.07 19.937 11.38C19.937 15.995 17.16 16.995 14.51 17.295C14.91 17.66 15.267 18.39 15.267 19.515V22.81C15.267 23.13 15.482 23.49 16.082 23.385C20.745 21.8 24.12 17.31 24.12 12C24.12 5.37 18.63 0 12 0Z" fill="#181717"/>
      </svg>
    </AppIconWrapper>
  ),
  Zoom: () => (
    <AppIconWrapper>
      <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="10" height="10" fill="#2D8CFF"/>
        <rect x="12" y="2" width="10" height="10" fill="#2D8CFF" opacity="0.7"/>
        <rect x="2" y="12" width="10" height="10" fill="#2D8CFF" opacity="0.7"/>
        <rect x="12" y="12" width="10" height="10" fill="#2D8CFF" opacity="0.5"/>
      </svg>
    </AppIconWrapper>
  ),
  Spotify: () => (
    <AppIconWrapper>
      <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="#1DB954"/>
        <circle cx="9" cy="10" r="1.5" fill="#FFFFFF"/>
        <circle cx="15" cy="10" r="1.5" fill="#FFFFFF"/>
        <path d="M10 15Q12 16 14 15" stroke="#FFFFFF" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </svg>
    </AppIconWrapper>
  ),
};


function HomeTab({
  userName,
  totalNotes,
  localTranscripts,
  onDeleteTranscript,
  onClearAllTranscripts,
}: HomeTabProps) {
  // Extract first name
  const firstName = userName?.split(" ")[0] || "";
  const greeting = firstName ? `Welcome back, ${firstName}` : "Welcome back";

  return (
    <div className="relative flex-1 flex flex-col min-h-full h-full px-6 py-10 bg-[#fafafa] overflow-y-auto">
      {/* Top Section: Greeting, Stats, Shortcut */}
      <div className="flex flex-col items-center gap-5 max-w-[500px] w-full mx-auto">
        {/* Greeting */}
        <h1 className="text-[2rem] font-bold text-slate-900 text-center font-['EB_Garamond',Georgia,serif] tracking-tight">
          {greeting}
        </h1>

        {/* Minimal Stats */}
        {typeof totalNotes === "number" && (
          <p className="text-sm text-slate-400 text-center mt-1">
            {totalNotes} {totalNotes === 1 ? "note" : "notes"} recorded
          </p>
        )}

        {/* Shortcut Section */}
        <div className="w-full max-w-[520px] bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center self-center">
          <p className="text-[0.9375rem] text-slate-600 mb-5 leading-relaxed">
            Hold <kbd className="inline-block px-2 py-[3px] text-[0.8125rem] font-mono font-semibold bg-slate-200 border border-slate-300 border-b-[3px] rounded-md text-slate-700">Ctrl</kbd> + <kbd className="inline-block px-2 py-[3px] text-[0.8125rem] font-mono font-semibold bg-slate-200 border border-slate-300 border-b-[3px] rounded-md text-slate-700">Space</kbd> to record from anywhere
          </p>
          <div className="flex flex-wrap justify-center gap-3.5 mb-3">
            <AppIcons.Slack />
            <AppIcons.Notion />
            <AppIcons.VSCode />
            <AppIcons.GoogleDocs />
            <AppIcons.Chrome />
            <AppIcons.Discord />
            <AppIcons.Teams />
            <AppIcons.Figma />
            <AppIcons.GitHub />
            <AppIcons.Zoom />
            <AppIcons.Spotify />
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-medium">Works everywhere</p>
        </div>
      </div>

      {/* Transcripts Section */}
      <div className="w-full max-w-[600px] mx-auto px-5">
        <TranscriptsSection
          transcripts={localTranscripts}
          onDeleteTranscript={onDeleteTranscript}
          onClearAll={onClearAllTranscripts}
        />
      </div>
    </div>
  );
}

export default HomeTab;
