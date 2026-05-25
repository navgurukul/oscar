// Oscar v2 — Wispr × Granola explorations.
// New design language: warm cream stage, ink type, terracotta accent (only
// for live-audio + just-finished moments), monospace captions for metadata,
// editorial pacing. Three big-idea moves:
//   1. Unified "listening surface" — Stream / Minutes / Scribble are modes,
//      not separate tabs. The day is a vertical spine of listening moments.
//   2. AI margin notes — your raw transcript on the left, Oscar's distillation
//      in the right margin (Granola-style, but quieter).
//   3. The pill becomes a presence, not a button — ghost-glass at rest,
//      terracotta only when audio is live.

const v2 = {
  cream:    '#f7f4ee',
  cream2:   '#efeae0',
  ink:      '#1a1816',
  inkSoft:  '#5a5852',
  inkFaint: '#8b8780',
  rule:     '#e5e0d6',
  ruleHard: '#d8d2c4',
  accent:   '#b8623d',
  accentSoft: '#e8c9b8',
  // dark stage (pill artboard)
  night:    '#0f0d0a',
  nightSoft:'#1a1714',
};
const v2Sans  = 'Figtree, system-ui, sans-serif';
const v2Serif = '"EB Garamond", Georgia, serif';
const v2Mono  = '"IBM Plex Mono", ui-monospace, monospace';

// ─── Primitives ──────────────────────────────────────────────────────────
function V2Mono({ children, className = '', style = {} }) {
  return <span className={className} style={{ fontFamily: v2Mono, ...style }}>{children}</span>;
}

function V2Caps({ children, color = v2.inkFaint, size = 10 }) {
  return (
    <span style={{
      fontFamily: v2Mono,
      fontSize: size,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color,
    }}>{children}</span>
  );
}

function V2Wordmark({ light = false }) {
  const ink = light ? v2.cream : v2.ink;
  return (
    <div className="inline-flex items-center gap-2.5">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10.5" stroke={ink} strokeWidth="1.2" />
        <path d="M7.5 12c0-1.6.8-2.5 1.8-2.5M9.3 14.5c-1 0-1.8-1-1.8-2.4M12 8.5v7M14.8 10v4M17.5 11.2v1.8"
          stroke={ink} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span style={{
        fontFamily: v2Serif,
        fontSize: 22,
        letterSpacing: '-0.005em',
        fontWeight: 500,
        color: ink,
      }}>Oscar</span>
    </div>
  );
}

// Avatar — placeholder dot, terracotta
function V2Avatar({ size = 32 }) {
  return (
    <div className="inline-flex items-center justify-center"
      style={{ width: size, height: size, borderRadius: 999, background: v2.accent, color: v2.cream, fontFamily: v2Serif, fontSize: size * 0.45, fontWeight: 500 }}>
      S
    </div>
  );
}

// Source pill — used in timeline events. Title-cased name, mono kind.
function V2Source({ name, kind }) {
  return (
    <div style={{ fontFamily: v2Mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: v2.inkFaint }}>
      {name}{kind ? <> · {kind}</> : null}
    </div>
  );
}

// ═══ V2 WEB · HOME (UNIFIED LISTENING SURFACE) ═══════════════════════════
function V2WebHome() {
  const events = [
    {
      time: '14:08', source: 'SLACK', kind: 'DICTATED',
      body: <>&ldquo;Wrapping the desktop pill polish today. Settings popover is in. Verifier is happy — let&rsquo;s ship this week.&rdquo;</>,
      distill: 'Status update — tightened, three filler words removed, formatted as a Slack message.',
      live: true,
    },
    {
      time: '13:42', source: 'STANDUP', kind: 'MINUTES · 27 MIN',
      body: <>Locked in three north-stars for the quarter. Souvik picks up the desktop pill polish, Mira drives the Scribble editor redesign, Roshni handles Meetings.</>,
      distill: '3 decisions · 7 action items · 3 follow-ups. Five attendees.',
      meta: 'Continue →',
      live: true,
    },
    {
      time: '12:18', source: 'NOTION', kind: 'DICTATED',
      body: <>&ldquo;Two tiers feels right. Free needs a real limit so Pro is an obvious next step.&rdquo;</>,
      distill: 'Saved to Pricing experiments doc.',
    },
    {
      time: '11:45', source: 'CURSOR', kind: 'DICTATED',
      body: <>Refactor the <V2Mono style={{ fontSize: '0.9em', background: v2.cream2, padding: '1px 6px', borderRadius: 4 }}>processItems</V2Mono> function in utils/data.ts to improve performance — consider memoization for repeated keys.</>,
      distill: 'Formatted as code comment. Pasted into the active editor at line 142.',
    },
    {
      time: '10:02', source: 'GMAIL', kind: 'DICTATED',
      body: <>&ldquo;Thanks for the time today — sending over the deck and the Loom by end of day.&rdquo;</>,
      distill: 'Reply drafted to thread with Roshni Jha. Punctuation cleaned.',
    },
    {
      time: '08:14', source: 'SCRIBBLE', kind: 'VOICE NOTE · 1 MIN',
      body: <>Morning intention. Two things matter today: ship the pill settings popover, and write the v2 brief for Mira before standup.</>,
      distill: 'Filed to Scribbles → Morning notes.',
    },
  ];

  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      {/* Top nav — minimal, no logo container, just type */}
      <header className="flex items-center justify-between px-14 py-7">
        <V2Wordmark />
        <nav className="flex items-center gap-9">
          <span style={{ fontFamily: v2Mono, fontSize: 11, letterSpacing: '0.18em', color: v2.ink, borderBottom: `1px solid ${v2.ink}`, paddingBottom: 2 }}>TODAY</span>
          <V2Caps>LIBRARY</V2Caps>
          <V2Caps>MINUTES</V2Caps>
          <V2Caps>SETTINGS</V2Caps>
        </nav>
        <div className="flex items-center gap-4">
          <V2Caps>SOUVIK · PRO</V2Caps>
          <V2Avatar size={32} />
        </div>
      </header>

      {/* Hero */}
      <section className="px-14 pt-24 pb-12">
        <V2Caps>TUE · MAY 20 · 14:08</V2Caps>
        <h1 className="mt-4" style={{ fontFamily: v2Serif, fontSize: 92, lineHeight: 0.96, letterSpacing: '-0.025em', fontWeight: 500, maxWidth: 920 }}>
          Today, you <em style={{ fontStyle: 'italic', color: v2.accent }}>listened</em><br />
          for 4&thinsp;h 12&thinsp;m.
        </h1>
        <p className="mt-7 max-w-xl text-[16px] leading-relaxed" style={{ color: v2.inkSoft }}>
          23 captures across 6 apps. One Minutes meeting. Oscar distilled
          them into 14 Scribbles you can publish, paste, or forget.
        </p>
        <div className="mt-10 flex items-center gap-6">
          <button className="inline-flex items-center gap-3 rounded-full px-6 py-3" style={{ background: v2.ink, color: v2.cream, fontSize: 14, fontWeight: 500 }}>
            <span className="inline-block rounded-full" style={{ height: 7, width: 7, background: v2.accent }} />
            Hold <V2Mono style={{ fontSize: 12, color: v2.cream2 }}>Ctrl+Space</V2Mono> to listen
          </button>
          <button className="text-[14px]" style={{ color: v2.inkSoft }}>· or drop in an audio file</button>
        </div>
      </section>

      {/* Spine */}
      <section className="px-14 pt-12 pb-20" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <div className="grid grid-cols-12 gap-10 mb-12">
          <div className="col-span-2"><V2Caps>THE DAY, IN ORDER</V2Caps></div>
          <div className="col-span-10 flex items-center gap-7">
            <V2Caps>FILTER</V2Caps>
            <span style={{ fontSize: 13, color: v2.ink, borderBottom: `1px solid ${v2.ink}`, paddingBottom: 1 }}>All</span>
            <span style={{ fontSize: 13, color: v2.inkSoft }}>Stream</span>
            <span style={{ fontSize: 13, color: v2.inkSoft }}>Minutes</span>
            <span style={{ fontSize: 13, color: v2.inkSoft }}>Scribble</span>
            <span style={{ marginLeft: 'auto', fontSize: 13, color: v2.inkSoft }}>23 moments →</span>
          </div>
        </div>

        <div className="space-y-14">
          {events.map((e, i) => (
            <article key={i} className="grid grid-cols-12 gap-10 group">
              <div className="col-span-2 pt-2">
                <V2Mono style={{ fontSize: 14, color: v2.ink, letterSpacing: '0.02em' }}>{e.time}</V2Mono>
                <div className="mt-1.5"><V2Source name={e.source} kind={e.kind} /></div>
              </div>
              <div className="col-span-10">
                <p style={{ fontFamily: v2Serif, fontSize: 24, lineHeight: 1.35, color: v2.ink, letterSpacing: '-0.005em', maxWidth: 760, textWrap: 'pretty' }}>
                  {e.body}
                </p>
                {e.distill && (
                  <div className="mt-5 flex items-start gap-4 pt-5" style={{ borderTop: `1px solid ${v2.rule}` }}>
                    <V2Caps color={e.live ? v2.accent : v2.inkFaint}>OSCAR ↓</V2Caps>
                    <p className="text-[13px] leading-relaxed" style={{ color: v2.inkSoft, maxWidth: 640 }}>
                      {e.distill}{e.meta && <span style={{ color: v2.accent, marginLeft: 8 }}>{e.meta}</span>}
                    </p>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-14 py-10 flex items-center justify-between" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <V2Caps>OSCAR · v2 EXPLORATION · LISTENING SURFACE</V2Caps>
        <V2Caps>4 SCRIBBLES PENDING · 86 IN LIBRARY</V2Caps>
      </footer>
    </div>
  );
}

// ═══ V2 WEB · SINGLE SCRIBBLE (AI MARGIN NOTES) ══════════════════════════
function V2WebScribble() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <header className="flex items-center justify-between px-14 py-6" style={{ borderBottom: `1px solid ${v2.rule}` }}>
        <div className="flex items-center gap-7">
          <V2Wordmark />
          <V2Caps>← BACK TO TODAY</V2Caps>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-[12px] rounded-full px-3.5 py-1.5" style={{ color: v2.inkSoft, border: `1px solid ${v2.rule}` }}>Copy</button>
          <button className="text-[12px] rounded-full px-3.5 py-1.5" style={{ color: v2.inkSoft, border: `1px solid ${v2.rule}` }}>Share</button>
          <button className="text-[12px] rounded-full px-3.5 py-1.5" style={{ background: v2.ink, color: v2.cream }}>Publish</button>
        </div>
      </header>

      <article className="px-14 py-14">
        <V2Caps>SCRIBBLE · MAY 18 · 13:42 · 12 MIN OF AUDIO · IN PRICING</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 60, lineHeight: 1.0, letterSpacing: '-0.025em', fontWeight: 500, maxWidth: 940 }}>
          Pricing experiments — what we<br />actually <em style={{ fontStyle: 'italic', color: v2.accent }}>learned</em> this month.
        </h1>

        {/* Audio scrubber */}
        <div className="mt-9 flex items-center gap-4 max-w-xl">
          <button className="inline-flex items-center justify-center rounded-full" style={{ height: 36, width: 36, background: v2.ink, color: v2.cream }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l16 9-16 9V3z" /></svg>
          </button>
          <div className="flex-1 flex items-center gap-0.5" style={{ height: 28 }}>
            {Array.from({ length: 80 }).map((_, i) => {
              const h = 4 + Math.abs(Math.sin(i * 0.42)) * 18 + (i < 12 ? 4 : 0);
              const playedThrough = i < 18;
              return <span key={i} className="rounded-full" style={{ width: 2, height: h, background: playedThrough ? v2.accent : v2.ruleHard }} />;
            })}
          </div>
          <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>2:18 / 12:04</V2Mono>
        </div>

        {/* Two columns: raw + margin */}
        <div className="mt-12 grid grid-cols-12 gap-14">
          <div className="col-span-7" style={{ borderRight: `1px solid ${v2.rule}`, paddingRight: 56 }}>
            <V2Caps>YOUR VOICE · UNEDITED</V2Caps>
            <div className="mt-5 space-y-6" style={{ fontFamily: v2Serif, fontSize: 19, lineHeight: 1.65, color: v2.ink, textWrap: 'pretty' }}>
              <p>
                OK so the big thing from the last month is that we ran four pricing experiments and only <mark style={{ background: v2.accentSoft, color: v2.ink, padding: '0 2px' }}>two of them actually moved a metric we care about</mark>. Um, the first one was the team plan landing page where we just said &ldquo;for teams&rdquo; instead of listing seats. That worked. <mark style={{ background: v2.accentSoft, color: v2.ink, padding: '0 2px' }}>Conversion went from 1.4 to 2.1 percent</mark> which is meaningful.
              </p>
              <p>
                The second thing that worked was the annual save percentage. We <mark style={{ background: v2.accentSoft, color: v2.ink, padding: '0 2px' }}>bumped it from 17 to 20 and saw the annual ratio go up by about 4 points</mark>. I think we should push it to 22 next month and see if it caps out.
              </p>
              <p>
                The two that didn&rsquo;t work — the FAQ rewrite did basically nothing. Like, completely flat. And the testimonial reshuffle was slightly negative which honestly surprised me.
              </p>
              <p>
                For next month, I want to try a, uh, a more aggressive trial length. Right now we do 7 days, I want to test 14. And then I want to redo the &ldquo;for teams&rdquo; copy across the rest of the site so it&rsquo;s consistent.
              </p>
            </div>
          </div>

          <aside className="col-span-5 space-y-9">
            <div className="flex items-center gap-3">
              <V2Caps color={v2.accent} size={11}>OSCAR&rsquo;S MARGIN</V2Caps>
              <span style={{ flex: 1, height: 1, background: v2.rule }} />
            </div>

            <div>
              <V2Caps>TL;DR</V2Caps>
              <p className="mt-2" style={{ fontFamily: v2Serif, fontSize: 21, lineHeight: 1.4, color: v2.ink, letterSpacing: '-0.005em' }}>
                4 experiments. <em style={{ fontStyle: 'italic', color: v2.accent }}>Two won, two didn&rsquo;t.</em> Push the winners harder next month.
              </p>
            </div>

            <div>
              <V2Caps>WHAT WORKED</V2Caps>
              <ul className="mt-2.5 space-y-2 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
                <li className="flex gap-3"><V2Mono style={{ color: v2.accent, fontSize: 11 }}>+50%</V2Mono><span>&ldquo;For teams&rdquo; headline · 1.4% → 2.1%</span></li>
                <li className="flex gap-3"><V2Mono style={{ color: v2.accent, fontSize: 11 }}>+4pt</V2Mono><span>Annual save 17% → 20% lifted ratio</span></li>
              </ul>
            </div>

            <div>
              <V2Caps>WHAT DIDN&rsquo;T</V2Caps>
              <ul className="mt-2.5 space-y-2 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
                <li className="flex gap-3"><V2Mono style={{ color: v2.inkFaint, fontSize: 11 }}>±0</V2Mono><span>FAQ rewrite — flat</span></li>
                <li className="flex gap-3"><V2Mono style={{ color: v2.inkFaint, fontSize: 11 }}>−1pt</V2Mono><span>Testimonial reshuffle — slightly negative</span></li>
              </ul>
            </div>

            <div>
              <V2Caps>NEXT MONTH</V2Caps>
              <ul className="mt-2.5 space-y-2 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
                <li>· Test 14-day trial (up from 7)</li>
                <li>· Roll &ldquo;for teams&rdquo; copy site-wide</li>
                <li>· Push annual save to 22%</li>
              </ul>
            </div>

            <div className="rounded-md p-5" style={{ background: v2.cream2 }}>
              <V2Caps color={v2.accent}>ASK OSCAR TO RESHAPE</V2Caps>
              <div className="mt-3 space-y-2">
                {['Reframe as a Slack post', 'Pull out just the action items', 'Make it a board-update memo', 'Translate to a one-pager'].map(t => (
                  <div key={t} className="flex items-center gap-2.5" style={{ fontSize: 13, color: v2.ink }}>
                    <span style={{ color: v2.accent }}>→</span> {t}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </article>
    </div>
  );
}

// ═══ V2 DESKTOP · HOME (TIME-AS-SPINE, COMPRESSED) ═══════════════════════
function V2DesktopHome() {
  const events = [
    { t: '14:08', s: 'SLACK',      b: <>&ldquo;Wrapping the desktop pill polish today. Settings popover is in.&rdquo;</>, live: true },
    { t: '13:42', s: 'STANDUP · 27m', b: 'Locked in three north-stars for the quarter. Souvik picks up the pill polish.', live: true },
    { t: '12:18', s: 'NOTION',     b: <>&ldquo;Two tiers feels right. Free needs a real limit so Pro is an obvious next step.&rdquo;</> },
    { t: '11:45', s: 'CURSOR',     b: 'Refactor processItems in utils/data.ts to improve performance.' },
    { t: '10:02', s: 'GMAIL',      b: <>&ldquo;Thanks for the time today — sending the deck and Loom by EOD.&rdquo;</> },
    { t: '08:14', s: 'VOICE NOTE', b: 'Morning intention. Two things matter today.' },
  ];

  return (
    <div style={{ background: v2.cream, fontFamily: v2Sans, color: v2.ink, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tauri chrome */}
      <div className="flex items-center px-4 py-2.5" style={{ borderBottom: `1px solid ${v2.rule}`, background: v2.cream2 }}>
        <div className="flex items-center gap-1.5">
          <div style={{ height: 11, width: 11, borderRadius: 999, background: '#ff5f57' }} />
          <div style={{ height: 11, width: 11, borderRadius: 999, background: '#febc2e' }} />
          <div style={{ height: 11, width: 11, borderRadius: 999, background: '#28c840' }} />
        </div>
        <div className="flex-1 text-center"><V2Caps>OSCAR · LISTENING SURFACE</V2Caps></div>
        <div style={{ width: 48 }} />
      </div>

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* Sidebar */}
        <aside className="col-span-3 p-6 space-y-7" style={{ borderRight: `1px solid ${v2.rule}` }}>
          <V2Wordmark />
          <div>
            <V2Caps>RANGE</V2Caps>
            <div className="mt-3 space-y-1.5">
              <div style={{ fontSize: 13, color: v2.ink, fontWeight: 500 }}>Today</div>
              <div style={{ fontSize: 13, color: v2.inkSoft }}>Yesterday</div>
              <div style={{ fontSize: 13, color: v2.inkSoft }}>Last 7 days</div>
              <div style={{ fontSize: 13, color: v2.inkSoft }}>This month</div>
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 20 }}>
            <V2Caps>SOURCES</V2Caps>
            <div className="mt-3 space-y-2">
              {[['Slack', 8], ['Notion', 4], ['Cursor', 3], ['Gmail', 2], ['Meetings', 1], ['Voice notes', 5]].map(([n, c]) => (
                <div key={n} className="flex items-center justify-between">
                  <span style={{ fontSize: 12, color: v2.inkSoft }}>{n}</span>
                  <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>{c}</V2Mono>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 20 }}>
            <V2Caps>MODE</V2Caps>
            <div className="mt-3 space-y-1.5">
              <div style={{ fontSize: 13, color: v2.ink, fontWeight: 500 }}>Conversational</div>
              <div style={{ fontSize: 13, color: v2.inkSoft }}>Coding · for IDEs</div>
              <div style={{ fontSize: 13, color: v2.inkSoft }}>Minutes · for meetings</div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="col-span-9 overflow-hidden flex flex-col">
          <div className="px-9 pt-7 pb-5" style={{ borderBottom: `1px solid ${v2.rule}` }}>
            <V2Caps>TUE · MAY 20</V2Caps>
            <h1 className="mt-1.5 flex items-baseline gap-4" style={{ fontFamily: v2Serif }}>
              <span style={{ fontSize: 42, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 500 }}>4&thinsp;h 12&thinsp;m</span>
              <span style={{ fontSize: 14, color: v2.inkSoft, fontFamily: v2Sans }}>listening · 23 captures · 6 apps</span>
            </h1>
            <div className="mt-5 flex items-center gap-3">
              <div className="inline-flex items-center gap-2.5 rounded-full px-4 py-2" style={{ background: v2.ink, color: v2.cream }}>
                <span className="inline-block rounded-full" style={{ height: 6, width: 6, background: v2.accent }} />
                <V2Mono style={{ fontSize: 11, color: v2.cream2 }}>CTRL+SPACE</V2Mono>
                <span style={{ fontSize: 12 }}>to listen</span>
              </div>
              <button style={{ fontSize: 12, color: v2.inkSoft }}>or drop a file</button>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-9 py-6 space-y-5">
            {events.map((e, i) => (
              <div key={i} className="grid grid-cols-12 gap-4">
                <div className="col-span-2 pt-1">
                  <V2Mono style={{ fontSize: 12, color: v2.ink }}>{e.t}</V2Mono>
                  <div className="mt-0.5" style={{ fontFamily: v2Mono, fontSize: 9, letterSpacing: '0.16em', color: e.live ? v2.accent : v2.inkFaint }}>{e.s}</div>
                </div>
                <div className="col-span-10 pb-5" style={{ borderBottom: `1px solid ${v2.rule}`, fontFamily: v2Serif, fontSize: 16, lineHeight: 1.5, color: v2.ink, textWrap: 'pretty' }}>
                  {e.b}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

// ═══ V2 DESKTOP · PILL (PRESENCE, NOT BUTTON) ════════════════════════════
function V2DesktopPill() {
  // Five states laid out on a dark stage with anatomy underneath.
  return (
    <div style={{ background: v2.night, color: v2.cream, fontFamily: v2Sans, minHeight: '100%' }}>
      {/* Hero */}
      <div className="px-12 pt-12 pb-3">
        <V2Caps color="#7a7670">DESKTOP PILL · v2</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 48, lineHeight: 1.02, letterSpacing: '-0.025em', fontWeight: 500, color: v2.cream, maxWidth: 820 }}>
          The pill becomes a <em style={{ fontStyle: 'italic', color: v2.accent }}>presence</em>, not a button.
        </h1>
        <p className="mt-5 max-w-xl text-[14px] leading-relaxed" style={{ color: '#a8a39a' }}>
          A ghost-glass shell at rest. Warm light when listening. Mono text scrolls through
          processing so you can read what Oscar is doing. The accent appears <em>only</em> when
          audio is live, processing just finished, or context detection lands.
        </p>
      </div>

      {/* States */}
      <div className="px-12 py-12 grid grid-cols-5 gap-5" style={{ borderTop: `1px solid #2a2520`, borderBottom: `1px solid #2a2520`, marginTop: 32 }}>
        {/* Idle */}
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex items-center justify-center" style={{ height: 56 }}>
            <div className="rounded-full px-4 py-2.5 inline-flex items-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)' }}>
              <span className="inline-block rounded-full" style={{ height: 6, width: 6, background: '#5a554e' }} />
            </div>
          </div>
          <V2Caps color="#7a7670">IDLE</V2Caps>
          <p className="text-center text-[11px] leading-relaxed" style={{ color: '#7a7670', maxWidth: 140 }}>Almost gone. A breath of glass.</p>
        </div>

        {/* Listening */}
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex items-center justify-center" style={{ height: 56 }}>
            <div className="rounded-full px-4 py-2.5 inline-flex items-center gap-2.5"
              style={{ background: 'rgba(184,98,61,0.10)', border: '1px solid rgba(184,98,61,0.32)', boxShadow: '0 0 32px rgba(184,98,61,0.22)' }}>
              <span className="inline-block rounded-full" style={{ height: 7, width: 7, background: v2.accent }} />
              <span className="inline-flex items-end gap-0.5" style={{ height: 16 }}>
                {[4, 9, 6, 12, 5, 8, 11, 6, 4].map((h, i) => (
                  <span key={i} className="rounded-full" style={{ background: v2.accent, width: 2, height: h }} />
                ))}
              </span>
            </div>
          </div>
          <V2Caps color={v2.accent}>LISTENING</V2Caps>
          <p className="text-center text-[11px] leading-relaxed" style={{ color: '#7a7670', maxWidth: 150 }}>Terracotta lights up. Waveform in the same tone — quiet, alive.</p>
        </div>

        {/* Distilling */}
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex items-center justify-center" style={{ height: 56 }}>
            <div className="rounded-full px-4 py-2.5 inline-flex items-center gap-2.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1.6s linear infinite' }}>
                <circle cx="12" cy="12" r="9" stroke="#a8a39a" strokeWidth="2" strokeDasharray="14 30" />
              </svg>
              <V2Mono style={{ fontSize: 11, color: '#d8d2c4' }}>removing filler · formatting · slack</V2Mono>
            </div>
          </div>
          <V2Caps color="#a8a39a">DISTILLING</V2Caps>
          <p className="text-center text-[11px] leading-relaxed" style={{ color: '#7a7670', maxWidth: 160 }}>Mono caption tells you exactly what Oscar is doing. No spinner-shaped mystery.</p>
        </div>

        {/* Ready */}
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex items-center justify-center" style={{ height: 56 }}>
            <div className="rounded-full px-4 py-2.5 inline-flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(184,98,61,0.30)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke={v2.accent} strokeWidth="3" strokeLinecap="round" /></svg>
              <span style={{ fontSize: 12, color: v2.cream }}>Pasted to Slack</span>
              <V2Mono style={{ fontSize: 10, color: '#a8a39a' }}>4s</V2Mono>
            </div>
          </div>
          <V2Caps color="#a8a39a">READY</V2Caps>
          <p className="text-center text-[11px] leading-relaxed" style={{ color: '#7a7670', maxWidth: 150 }}>The accent lingers for two seconds, then fades. Confirmation without celebration.</p>
        </div>

        {/* Context */}
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex items-center justify-center" style={{ height: 56 }}>
            <div className="rounded-full px-4 py-2 inline-flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <V2Mono style={{ fontSize: 9, letterSpacing: '0.16em', color: '#8b8780' }}>OPTIMIZED FOR</V2Mono>
              <span style={{ fontSize: 12, color: v2.cream }}>Gmail</span>
            </div>
          </div>
          <V2Caps color="#a8a39a">CONTEXT</V2Caps>
          <p className="text-center text-[11px] leading-relaxed" style={{ color: '#7a7670', maxWidth: 150 }}>Reads the active app. The label is the only chrome.</p>
        </div>
      </div>

      {/* Anatomy / vs current */}
      <div className="px-12 py-12 grid grid-cols-2 gap-14">
        <div>
          <V2Caps color="#7a7670">DESIGN PRINCIPLES</V2Caps>
          <ol className="mt-5 space-y-3.5 text-[13px] leading-relaxed list-none" style={{ color: '#cfc9bd' }}>
            <li><V2Mono style={{ color: '#7a7670', marginRight: 10 }}>01</V2Mono>At rest, it&rsquo;s almost gone. One ink dot — present without demanding attention.</li>
            <li><V2Mono style={{ color: '#7a7670', marginRight: 10 }}>02</V2Mono>Accent appears <em>only</em> on live audio, fresh confirmation, or context detection.</li>
            <li><V2Mono style={{ color: '#7a7670', marginRight: 10 }}>03</V2Mono>Processing surfaces what Oscar is doing as scrolling mono — no opaque spinner.</li>
            <li><V2Mono style={{ color: '#7a7670', marginRight: 10 }}>04</V2Mono>Width never exceeds 280px. The pill earns the space it takes.</li>
            <li><V2Mono style={{ color: '#7a7670', marginRight: 10 }}>05</V2Mono>States distinguish by typography, not by saturation. Mono speaks; serif rests.</li>
          </ol>
        </div>
        <div>
          <V2Caps color="#7a7670">v2 VS. v1</V2Caps>
          <div className="mt-5 space-y-4 text-[13px] leading-relaxed" style={{ color: '#cfc9bd' }}>
            <div className="grid grid-cols-2 gap-4 pb-3" style={{ borderBottom: '1px solid #2a2520' }}>
              <div style={{ color: '#7a7670' }}>v1 cyan reads &ldquo;tech product.&rdquo;</div>
              <div>v2 terracotta reads <em>voice</em>.</div>
            </div>
            <div className="grid grid-cols-2 gap-4 pb-3" style={{ borderBottom: '1px solid #2a2520' }}>
              <div style={{ color: '#7a7670' }}>v1 says &ldquo;Polishing&hellip;&rdquo;</div>
              <div>v2 tells you the actual operation in flight.</div>
            </div>
            <div className="grid grid-cols-2 gap-4 pb-3" style={{ borderBottom: '1px solid #2a2520' }}>
              <div style={{ color: '#7a7670' }}>v1 distinguishes by colour.</div>
              <div>v2 distinguishes by typeface.</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div style={{ color: '#7a7670' }}>v1 idle pill: visible.</div>
              <div>v2 idle pill: a held breath.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ V2 MOBILE · HOME ════════════════════════════════════════════════════
function V2MobileHome() {
  const events = [
    { t: '14:08', s: 'SLACK',      b: <>&ldquo;Wrapping the desktop pill polish. Settings popover is in.&rdquo;</>, live: true },
    { t: '13:42', s: 'STANDUP',    b: 'Locked in three north-stars for the quarter.', live: true },
    { t: '12:18', s: 'NOTION',     b: <>&ldquo;Two tiers feels right. Free needs a real limit.&rdquo;</> },
    { t: '11:45', s: 'CURSOR',     b: 'Refactor processItems for performance.' },
    { t: '10:02', s: 'GMAIL',      b: <>&ldquo;Sending the deck and Loom by EOD.&rdquo;</> },
    { t: '08:14', s: 'VOICE NOTE', b: 'Morning intention. Two things matter.' },
  ];

  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%', position: 'relative', paddingBottom: 110 }}>
      {/* Top */}
      <div className="px-5 pt-7 flex items-center justify-between">
        <V2Wordmark />
        <V2Avatar size={30} />
      </div>

      {/* Hero */}
      <div className="px-5 pt-9">
        <V2Caps>TUE · MAY 20 · 14:08</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 38, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
          Today, you<br /><em style={{ fontStyle: 'italic', color: v2.accent }}>listened</em><br />for 4&thinsp;h 12&thinsp;m.
        </h1>
        <p className="mt-4 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
          23 captures · 6 apps · 1 meeting · Oscar made 14 Scribbles from it.
        </p>
      </div>

      {/* Filters */}
      <div className="mt-9 px-5 pb-3 flex items-center gap-5" style={{ borderBottom: `1px solid ${v2.rule}` }}>
        <span style={{ fontSize: 13, color: v2.ink, borderBottom: `1px solid ${v2.ink}`, paddingBottom: 6 }}>All</span>
        <span style={{ fontSize: 13, color: v2.inkSoft, paddingBottom: 6 }}>Stream</span>
        <span style={{ fontSize: 13, color: v2.inkSoft, paddingBottom: 6 }}>Minutes</span>
        <span style={{ fontSize: 13, color: v2.inkSoft, paddingBottom: 6 }}>Scribble</span>
      </div>

      {/* Spine */}
      <div className="px-5 pt-6 space-y-6">
        {events.map((e, i) => (
          <div key={i}>
            <div className="flex items-center gap-3">
              <V2Mono style={{ fontSize: 12, color: v2.ink }}>{e.t}</V2Mono>
              <V2Caps color={e.live ? v2.accent : v2.inkFaint}>{e.s}</V2Caps>
            </div>
            <p className="mt-2 pb-5" style={{ fontFamily: v2Serif, fontSize: 17, lineHeight: 1.45, color: v2.ink, borderBottom: `1px solid ${v2.rule}`, textWrap: 'pretty' }}>
              {e.b}
            </p>
          </div>
        ))}
      </div>

      {/* Floating pill */}
      <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>
        <div className="rounded-full px-5 py-3 inline-flex items-center gap-2.5" style={{ background: v2.ink, color: v2.cream, boxShadow: '0 8px 28px rgba(0,0,0,0.18)' }}>
          <span className="inline-block rounded-full" style={{ height: 7, width: 7, background: v2.accent }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Tap & hold to listen</span>
        </div>
      </div>
    </div>
  );
}

// ═══ PALETTE EXPLORER ═══════════════════════════════════════════════════
// Five color directions on the same design language. Each keeps the same
// type system, whitespace, and rhythm — only the cream / ink / accent
// triad changes. Tag tells you what mood the palette is reaching for.

const palettes = {
  terracotta: {
    name: 'Terracotta', tag: 'Voice & clay · current',
    cream:'#f7f4ee', cream2:'#efeae0', ink:'#1a1816', inkSoft:'#5a5852',
    inkFaint:'#8b8780', rule:'#e5e0d6', ruleHard:'#d8d2c4',
    accent:'#b8623d', accentSoft:'#e8c9b8',
  },
  oxblood: {
    name: 'Oxblood', tag: 'Bookish · editorial',
    cream:'#faf7f0', cream2:'#f1ece0', ink:'#1f1614', inkSoft:'#5e524e',
    inkFaint:'#8d827d', rule:'#e8e0d2', ruleHard:'#dbd1c0',
    accent:'#8c2f25', accentSoft:'#e8c4be',
  },
  moss: {
    name: 'Moss', tag: 'Slow · natural',
    cream:'#f3f4eb', cream2:'#e8eadb', ink:'#1a1e1a', inkSoft:'#525a52',
    inkFaint:'#828a80', rule:'#dde0d0', ruleHard:'#cdd2bd',
    accent:'#5a7c4a', accentSoft:'#cad8bd',
  },
  indigo: {
    name: 'Indigo', tag: 'Ink on paper',
    cream:'#f3f3ee', cream2:'#e6e7df', ink:'#161823', inkSoft:'#535665',
    inkFaint:'#82869a', rule:'#dcdcd0', ruleHard:'#caccc0',
    accent:'#3957a0', accentSoft:'#c5cde6',
  },
  honey: {
    name: 'Honey', tag: 'Warm gold · journal',
    cream:'#f5f1e6', cream2:'#ebe5d2', ink:'#1a1812', inkSoft:'#5a5448',
    inkFaint:'#8d8676', rule:'#e3dcc8', ruleHard:'#d4ccb4',
    accent:'#c9892b', accentSoft:'#ecd29b',
  },
};

// Swatches overview — five palette cards side by side, each with sample
// type, the listening-pill mini, and the four key hex codes.
function V2PaletteSwatches() {
  return (
    <div style={{ background: '#ece8de', minHeight: '100%', padding: '40px 32px', fontFamily: v2Sans }}>
      <div style={{ marginBottom: 28 }}>
        <V2Caps>v2 · COLOR EXPLORATIONS</V2Caps>
        <h2 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 32, lineHeight: 1.0, letterSpacing: '-0.02em', fontWeight: 500, color: '#1a1816' }}>
          Five palettes. Same type, same rhythm.
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: '#5a5852', maxWidth: 640 }}>
          Each palette keeps the design language identical — only the cream / ink / accent triad shifts. The accent stays muted so it earns the live-audio moments; nothing here screams.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {Object.entries(palettes).map(([key, p]) => (
          <div key={key} style={{ background: p.cream, borderRadius: 12, padding: 20, border: `1px solid ${p.rule}` }}>
            {/* Header */}
            <div className="flex items-baseline justify-between">
              <span style={{ fontFamily: v2Serif, fontSize: 18, fontWeight: 500, color: p.ink, letterSpacing: '-0.01em' }}>{p.name}</span>
              <span style={{ fontFamily: v2Mono, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: p.inkFaint }}>0{Object.keys(palettes).indexOf(key) + 1}</span>
            </div>
            <div className="mt-1" style={{ fontFamily: v2Mono, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: p.inkFaint }}>{p.tag}</div>

            {/* Sample type */}
            <div className="mt-7" style={{ fontFamily: v2Serif, fontSize: 30, lineHeight: 0.98, letterSpacing: '-0.02em', fontWeight: 500, color: p.ink }}>
              You<br /><em style={{ fontStyle: 'italic', color: p.accent }}>listened</em><br />today.
            </div>

            {/* Mini pill */}
            <div className="mt-7 inline-flex items-center gap-2 rounded-full" style={{ padding: '7px 12px', background: p.ink, color: p.cream }}>
              <span style={{ display: 'inline-block', height: 6, width: 6, borderRadius: 999, background: p.accent }} />
              <span style={{ fontSize: 11, fontWeight: 500 }}>Hold </span>
              <span style={{ fontFamily: v2Mono, fontSize: 10, color: p.cream2 }}>Ctrl+Space</span>
            </div>

            {/* Mini transcript */}
            <div className="mt-7 pt-4" style={{ borderTop: `1px solid ${p.rule}` }}>
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: v2Mono, fontSize: 10, color: p.ink }}>14:08</span>
                <span style={{ fontFamily: v2Mono, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: p.accent }}>SLACK</span>
              </div>
              <p style={{ marginTop: 4, fontFamily: v2Serif, fontSize: 14, lineHeight: 1.45, color: p.ink }}>
                &ldquo;Wrapping the pill polish today.&rdquo;
              </p>
            </div>

            {/* Hex codes */}
            <div className="mt-6 space-y-1.5">
              {[['cream', p.cream], ['ink', p.ink], ['accent', p.accent], ['rule', p.rule]].map(([label, hex]) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span style={{ display: 'inline-block', height: 14, width: 14, borderRadius: 3, background: hex, border: `1px solid ${p.rule}` }} />
                  <span style={{ fontFamily: v2Mono, fontSize: 10, color: p.inkSoft, letterSpacing: '0.04em' }}>{hex.toUpperCase()}</span>
                  <span style={{ fontFamily: v2Mono, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: p.inkFaint, marginLeft: 'auto' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Hero rendered in a specific palette — full layout vibe at smaller scale
// so you can see how each palette feels in real chrome.
function V2HeroIn({ palette = 'terracotta' }) {
  const p = palettes[palette];
  return (
    <div style={{ background: p.cream, color: p.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      {/* Top */}
      <header className="flex items-center justify-between" style={{ padding: '20px 28px' }}>
        <div className="inline-flex items-center gap-2.5">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10.5" stroke={p.ink} strokeWidth="1.2" />
            <path d="M7.5 12c0-1.6.8-2.5 1.8-2.5M9.3 14.5c-1 0-1.8-1-1.8-2.4M12 8.5v7M14.8 10v4M17.5 11.2v1.8" stroke={p.ink} strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: v2Serif, fontSize: 20, fontWeight: 500, color: p.ink }}>Oscar</span>
        </div>
        <span style={{ fontFamily: v2Mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: p.inkFaint }}>{p.name.toUpperCase()}</span>
      </header>

      {/* Hero */}
      <section style={{ padding: '40px 28px 24px' }}>
        <span style={{ fontFamily: v2Mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: p.inkFaint }}>TUE · MAY 20 · 14:08</span>
        <h1 style={{ marginTop: 10, fontFamily: v2Serif, fontSize: 48, lineHeight: 0.96, letterSpacing: '-0.025em', fontWeight: 500 }}>
          Today, you<br /><em style={{ fontStyle: 'italic', color: p.accent }}>listened</em> for 4&thinsp;h 12&thinsp;m.
        </h1>
        <p style={{ marginTop: 16, fontSize: 13, lineHeight: 1.6, color: p.inkSoft, maxWidth: 380 }}>
          23 captures across 6 apps. Oscar distilled them into 14 Scribbles.
        </p>
        <div style={{ marginTop: 22 }}>
          <button className="inline-flex items-center gap-2.5 rounded-full" style={{ background: p.ink, color: p.cream, padding: '10px 18px', fontSize: 12, fontWeight: 500 }}>
            <span style={{ display: 'inline-block', height: 6, width: 6, borderRadius: 999, background: p.accent }} />
            Hold <span style={{ fontFamily: v2Mono, fontSize: 11, color: p.cream2 }}>Ctrl+Space</span> to listen
          </button>
        </div>
      </section>

      {/* Spine */}
      <section style={{ padding: '24px 28px 32px', borderTop: `1px solid ${p.rule}` }}>
        <div style={{ marginBottom: 18 }}>
          <span style={{ fontFamily: v2Mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: p.inkFaint }}>THE DAY, IN ORDER</span>
        </div>
        {[
          { t: '14:08', s: 'SLACK', b: <>&ldquo;Wrapping the desktop pill polish today. Settings popover is in.&rdquo;</>, d: 'Status update — three filler words removed.', live: true },
          { t: '13:42', s: 'STANDUP · 27m', b: <>Locked in three north-stars for the quarter. Souvik picks up the pill polish.</>, d: '3 decisions · 7 actions · 3 follow-ups.', live: true },
          { t: '12:18', s: 'NOTION', b: <>&ldquo;Two tiers feels right. Free needs a real limit.&rdquo;</>, d: 'Saved to Pricing experiments doc.' },
          { t: '10:02', s: 'GMAIL', b: <>&ldquo;Sending the deck and Loom by EOD.&rdquo;</>, d: 'Reply drafted to Roshni Jha.' },
        ].map((e, i) => (
          <article key={i} style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 16, marginBottom: 22 }}>
            <div style={{ paddingTop: 4 }}>
              <div style={{ fontFamily: v2Mono, fontSize: 12, color: p.ink, letterSpacing: '0.02em' }}>{e.t}</div>
              <div style={{ marginTop: 4, fontFamily: v2Mono, fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: e.live ? p.accent : p.inkFaint }}>{e.s}</div>
            </div>
            <div>
              <p style={{ fontFamily: v2Serif, fontSize: 16, lineHeight: 1.4, color: p.ink, textWrap: 'pretty' }}>{e.b}</p>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${p.rule}`, display: 'flex', alignItems: 'start', gap: 10 }}>
                <span style={{ fontFamily: v2Mono, fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: e.live ? p.accent : p.inkFaint }}>OSCAR ↓</span>
                <span style={{ fontSize: 11, lineHeight: 1.55, color: p.inkSoft }}>{e.d}</span>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

Object.assign(window, { v2, v2Sans, v2Serif, v2Mono, V2Mono, V2Caps, V2Wordmark, V2Avatar, V2Source, V2WebHome, V2WebScribble, V2DesktopHome, V2DesktopPill, V2MobileHome, V2PaletteSwatches, V2HeroIn, palettes });
