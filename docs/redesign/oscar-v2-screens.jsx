// Oscar v2 · Wave 1 — Terracotta rollout to the daily-driver screens.
// Web: Library · Minutes (list + detail) · Settings · Landing · Auth
// Desktop: Scribble tab · Minutes tab · Settings tab
// Mobile: Library · Editor

// Pull primitives + tokens from oscar-v2.jsx (it loads first in the page).
const v2       = window.v2;
const v2Sans   = window.v2Sans;
const v2Serif  = window.v2Serif;
const v2Mono   = window.v2Mono;
const V2Mono   = window.V2Mono;
const V2Caps   = window.V2Caps;
const V2Wordmark = window.V2Wordmark;
const V2Avatar = window.V2Avatar;
const V2Source = window.V2Source;

// ─── Shared chrome ───────────────────────────────────────────────────────
function V2WebHeader({ active = 'TODAY' }) {
  return (
    <header className="flex items-center justify-between px-14 py-7">
      <V2Wordmark />
      <nav className="flex items-center gap-9">
        {['TODAY', 'LIBRARY', 'MINUTES', 'SETTINGS'].map((label) => (
          label === active
            ? <span key={label} style={{ fontFamily: v2Mono, fontSize: 11, letterSpacing: '0.18em', color: v2.ink, borderBottom: `1px solid ${v2.ink}`, paddingBottom: 2 }}>{label}</span>
            : <V2Caps key={label}>{label}</V2Caps>
        ))}
      </nav>
      <div className="flex items-center gap-4">
        <V2Caps>SOUVIK · PRO</V2Caps>
        <V2Avatar size={32} />
      </div>
    </header>
  );
}

function V2WinChrome({ title = 'OSCAR' }) {
  return (
    <div className="flex items-center px-4 py-2.5" style={{ borderBottom: `1px solid ${v2.rule}`, background: v2.cream2 }}>
      <div className="flex items-center gap-1.5">
        <div style={{ height: 11, width: 11, borderRadius: 999, background: '#ff5f57' }} />
        <div style={{ height: 11, width: 11, borderRadius: 999, background: '#febc2e' }} />
        <div style={{ height: 11, width: 11, borderRadius: 999, background: '#28c840' }} />
      </div>
      <div className="flex-1 text-center"><V2Caps>{title}</V2Caps></div>
      <div style={{ width: 48 }} />
    </div>
  );
}

function V2DeskSidebar({ active }) {
  const tabs = [
    { id: 'home',     label: 'Today' },
    { id: 'scribble', label: 'Scribbles' },
    { id: 'minutes',  label: 'Minutes' },
    { id: 'settings', label: 'Settings' },
  ];
  return (
    <aside className="col-span-3 p-6 space-y-7" style={{ borderRight: `1px solid ${v2.rule}` }}>
      <V2Wordmark />
      <div>
        <V2Caps>WORKSPACE</V2Caps>
        <div className="mt-3 space-y-1.5">
          {tabs.map(t => (
            <div key={t.id} className="flex items-center gap-2.5" style={{
              fontSize: 13,
              color: t.id === active ? v2.ink : v2.inkSoft,
              fontWeight: t.id === active ? 500 : 400,
            }}>
              {t.id === active && <span style={{ display: 'inline-block', height: 5, width: 5, borderRadius: 999, background: v2.accent }} />}
              {t.label}
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 20 }}>
        <V2Caps>FOLDERS</V2Caps>
        <div className="mt-3 space-y-2">
          {[['Pricing', 12], ['Engineering', 24], ['Standup', 8], ['Inbox', 7]].map(([n, c]) => (
            <div key={n} className="flex items-center justify-between">
              <span style={{ fontSize: 12, color: v2.inkSoft }}>{n}</span>
              <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>{c}</V2Mono>
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 20 }}>
        <V2Caps>SOUVIK · PRO</V2Caps>
        <div className="mt-3 flex items-center gap-2.5">
          <V2Avatar size={28} />
          <div style={{ fontSize: 12, color: v2.inkSoft }}>
            <div style={{ color: v2.ink }}>Souvik Deb</div>
            <V2Caps>2 / 5 GB USED</V2Caps>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ═══ WEB · LIBRARY ═══════════════════════════════════════════════════════
function V2WebLibrary() {
  const scribbles = [
    { date: 'TUE · 14:08', source: 'SLACK',          title: 'Status update — pill polish + verifier', preview: 'Wrapping the desktop pill polish today. Settings popover is in. Verifier is happy.', dur: '0:42' },
    { date: 'TUE · 13:42', source: 'MINUTES · 27m',  title: 'Standup — north stars for the quarter',  preview: 'Locked in three north-stars. Souvik picks up the pill polish; Mira drives the Scribble editor redesign.', dur: '27:12' },
    { date: 'TUE · 12:18', source: 'NOTION',         title: 'Pricing thoughts on tiers',               preview: 'Two tiers feels right. Free needs a real limit so Pro is an obvious next step.', dur: '1:08' },
    { date: 'TUE · 11:45', source: 'CURSOR',         title: 'Refactor note for processItems',          preview: 'Refactor the processItems function in utils/data.ts to improve performance — consider memoization.', dur: '0:35' },
    { date: 'TUE · 10:02', source: 'GMAIL',          title: 'Reply to Roshni on the deck',             preview: 'Thanks for the time today — sending over the deck and the Loom by end of day.', dur: '0:22' },
    { date: 'TUE · 08:14', source: 'VOICE NOTE',     title: 'Morning intention',                       preview: 'Two things matter today: ship the pill settings popover, and write the v2 brief.', dur: '0:58' },
    { date: 'MON · 17:21', source: 'SCRIBBLE · 12m', title: 'Pricing experiments — what we learned',   preview: '4 experiments. Two won, two didn’t. Push the winners harder next month.', dur: '12:04' },
    { date: 'MON · 11:00', source: 'MINUTES · 45m',  title: 'Roshni Jha · pricing review',             preview: 'They want a team plan with shared Minutes. Pricing-sensitive but not deal-breaker.', dur: '44:18' },
    { date: 'FRI · 16:00', source: 'MINUTES · 22m',  title: 'Office hours with Mira',                  preview: 'Aligned on Scribble editor mode toolbar shape. AI feedback bar by Wednesday.', dur: '22:08' },
  ];

  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2WebHeader active="LIBRARY" />

      <section className="px-14 pt-20 pb-12">
        <V2Caps>YOUR LIBRARY · 86 SCRIBBLES · 12 H OF AUDIO</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 84, lineHeight: 0.96, letterSpacing: '-0.025em', fontWeight: 500 }}>
          Everything you <em style={{ fontStyle: 'italic', color: v2.accent }}>kept</em>.
        </h1>
        <p className="mt-7 max-w-xl text-[16px] leading-relaxed" style={{ color: v2.inkSoft }}>
          Search by what you said, where you said it from, or when. The library is yours — Oscar only helps you find your way back.
        </p>

        <div className="mt-10 flex items-center gap-4 max-w-2xl" style={{ background: v2.cream2, border: `1px solid ${v2.rule}`, borderRadius: 999, padding: '13px 22px' }}>
          <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>SEARCH</V2Mono>
          <input placeholder="What did I say about pricing?" className="flex-1 bg-transparent outline-none" style={{ fontSize: 15, color: v2.ink, fontFamily: v2Sans }} />
          <V2Mono style={{ fontSize: 10, color: v2.inkFaint, letterSpacing: '0.16em' }}>⌘K</V2Mono>
        </div>
      </section>

      <section className="px-14 pt-10 pb-8" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <div className="grid grid-cols-12 gap-10">
          <div className="col-span-2"><V2Caps>FILTERS</V2Caps></div>
          <div className="col-span-10 flex items-center gap-7">
            <span style={{ fontSize: 13, color: v2.ink, borderBottom: `1px solid ${v2.ink}`, paddingBottom: 1 }}>All</span>
            <span style={{ fontSize: 13, color: v2.inkSoft }}>Pricing</span>
            <span style={{ fontSize: 13, color: v2.inkSoft }}>Engineering</span>
            <span style={{ fontSize: 13, color: v2.inkSoft }}>Standup</span>
            <span style={{ fontSize: 13, color: v2.inkSoft }}>Inbox</span>
            <span style={{ marginLeft: 'auto', fontSize: 13, color: v2.inkSoft }}>Sorted by recent · 86 results</span>
          </div>
        </div>
      </section>

      <section className="px-14 pb-20">
        {scribbles.map((s, i) => (
          <article key={i} className="grid grid-cols-12 gap-10 py-7 group" style={{ borderTop: `1px solid ${v2.rule}` }}>
            <div className="col-span-2">
              <V2Mono style={{ fontSize: 12, color: v2.ink }}>{s.date}</V2Mono>
              <div className="mt-1"><V2Source name={s.source} /></div>
            </div>
            <div className="col-span-9">
              <h3 style={{ fontFamily: v2Serif, fontSize: 22, lineHeight: 1.25, color: v2.ink, letterSpacing: '-0.01em', fontWeight: 500 }}>{s.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: v2.inkSoft, maxWidth: 700 }}>{s.preview}</p>
            </div>
            <div className="col-span-1 text-right">
              <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>{s.dur}</V2Mono>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

// ═══ WEB · MINUTES LIST ══════════════════════════════════════════════════
function V2WebMinutesList() {
  const meetings = [
    { date: 'TUE · 13:42', dur: '27m', title: 'Standup — north stars for the quarter',  attendees: ['Souvik', 'Mira', 'Roshni', 'Komal', 'Sanjna'], decisions: 3, actions: 7, summary: 'Locked in three north-stars. Souvik on pill polish; Mira on Scribble editor; Roshni on Meetings. Standup format moves to async on Mondays.' },
    { date: 'MON · 11:00', dur: '45m', title: 'Roshni Jha · pricing review',             attendees: ['Roshni Jha', 'Souvik', 'Sanjna'], decisions: 1, actions: 3, summary: 'They want a team plan with shared Minutes. Pricing-sensitive but not deal-breaker. Two integration asks: Slack channel posting, Notion auto-export.' },
    { date: 'FRI · 16:00', dur: '22m', title: 'Office hours · Mira & Souvik',            attendees: ['Mira', 'Souvik'], decisions: 2, actions: 4, summary: 'Aligned on Scribble editor mode toolbar shape. Mira ships the AI feedback bar by Wednesday. Mobile editor pass is a follow-up.' },
    { date: 'THU · 09:30', dur: '34m', title: 'Quarterly planning · marketing',          attendees: ['Komal', 'Sanjna', 'Souvik'], decisions: 4, actions: 11, summary: 'Pricing page rewrite ready after analytics review. Annual save percentage bumped to 20% across currencies.' },
    { date: 'WED · 14:00', dur: '52m', title: 'Engineering sync — context-aware phase 6', attendees: ['Souvik', 'Mira', 'Anil', 'Komal', 'Mehek', 'Devansh'], decisions: 2, actions: 9, summary: 'Phase 6 scope locked: context labels live in three surfaces, falls back to neutral cleanup on low confidence.' },
  ];
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2WebHeader active="MINUTES" />
      <section className="px-14 pt-20 pb-12">
        <V2Caps>MINUTES · 12 MEETINGS THIS WEEK</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 84, lineHeight: 0.96, letterSpacing: '-0.025em', fontWeight: 500 }}>
          What was <em style={{ fontStyle: 'italic', color: v2.accent }}>decided</em>,<br />in order.
        </h1>
        <p className="mt-7 max-w-xl text-[16px] leading-relaxed" style={{ color: v2.inkSoft }}>
          Oscar listens to your meetings and writes back what mattered — decisions, actions, follow-ups. Publish the whole thing or just the parts that move work forward.
        </p>
      </section>
      <section className="px-14 pb-20" style={{ borderTop: `1px solid ${v2.rule}` }}>
        {meetings.map((m, i) => (
          <article key={i} className="grid grid-cols-12 gap-10 py-10" style={{ borderBottom: `1px solid ${v2.rule}` }}>
            <div className="col-span-2">
              <V2Mono style={{ fontSize: 13, color: v2.ink }}>{m.date}</V2Mono>
              <div className="mt-1.5"><V2Source name="MINUTES" kind={m.dur} /></div>
              <div className="mt-7 space-y-1.5">
                <div className="flex items-center justify-between" style={{ fontSize: 11, color: v2.inkSoft }}><span>Decisions</span><V2Mono style={{ color: v2.accent }}>{m.decisions}</V2Mono></div>
                <div className="flex items-center justify-between" style={{ fontSize: 11, color: v2.inkSoft }}><span>Actions</span><V2Mono>{m.actions}</V2Mono></div>
                <div className="flex items-center justify-between" style={{ fontSize: 11, color: v2.inkSoft }}><span>Attendees</span><V2Mono>{m.attendees.length}</V2Mono></div>
              </div>
            </div>
            <div className="col-span-10">
              <h2 style={{ fontFamily: v2Serif, fontSize: 32, lineHeight: 1.1, letterSpacing: '-0.015em', fontWeight: 500, maxWidth: 760 }}>{m.title}</h2>
              <p className="mt-4 text-[15px] leading-relaxed" style={{ color: v2.inkSoft, maxWidth: 720 }}>{m.summary}</p>
              <div className="mt-5 flex items-center gap-5">
                {m.attendees.slice(0, 5).map((a, j) => (
                  <span key={j} className="flex items-center gap-2 text-[12px]" style={{ color: v2.inkSoft }}>
                    <span style={{ display: 'inline-block', height: 22, width: 22, borderRadius: 999, background: v2.cream2, color: v2.ink, fontFamily: v2Serif, fontWeight: 500, fontSize: 12, textAlign: 'center', lineHeight: '22px' }}>{a[0]}</span>
                    {a}
                  </span>
                ))}
                {m.attendees.length > 5 && <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>+{m.attendees.length - 5}</V2Mono>}
                <span style={{ marginLeft: 'auto', fontSize: 13, color: v2.accent }}>Continue →</span>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

// ═══ WEB · MINUTES DETAIL ════════════════════════════════════════════════
function V2WebMinutesDetail() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <header className="flex items-center justify-between px-14 py-6" style={{ borderBottom: `1px solid ${v2.rule}` }}>
        <div className="flex items-center gap-7">
          <V2Wordmark />
          <V2Caps>← BACK TO MINUTES</V2Caps>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-[12px] rounded-full px-3.5 py-1.5" style={{ color: v2.inkSoft, border: `1px solid ${v2.rule}` }}>Export</button>
          <button className="text-[12px] rounded-full px-3.5 py-1.5" style={{ color: v2.inkSoft, border: `1px solid ${v2.rule}` }}>Share</button>
          <button className="text-[12px] rounded-full px-3.5 py-1.5" style={{ background: v2.ink, color: v2.cream }}>Post to Slack</button>
        </div>
      </header>

      <article className="px-14 py-14">
        <V2Caps>STANDUP · MAY 20 · 13:42 · 27 MIN · 5 ATTENDEES</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 60, lineHeight: 1.0, letterSpacing: '-0.025em', fontWeight: 500, maxWidth: 980 }}>
          North stars for the quarter — and <em style={{ fontStyle: 'italic', color: v2.accent }}>who&rsquo;s carrying</em> what.
        </h1>

        <div className="mt-8 flex items-center gap-5 flex-wrap">
          {['Souvik Deb', 'Mira Patel', 'Roshni Jha', 'Komal Ahire', 'Sanjna Panwar'].map((a, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span style={{ display: 'inline-block', height: 28, width: 28, borderRadius: 999, background: v2.cream2, color: v2.ink, fontFamily: v2Serif, fontWeight: 500, fontSize: 13, textAlign: 'center', lineHeight: '28px' }}>{a[0]}</span>
              <span style={{ fontSize: 13, color: v2.ink }}>{a}</span>
            </div>
          ))}
        </div>

        <div className="mt-12 grid grid-cols-12 gap-10">
          <div className="col-span-4 pr-2">
            <V2Caps color={v2.accent}>DECISIONS · 3</V2Caps>
            <ol className="mt-5 space-y-5">
              {[
                'Souvik picks up the desktop pill polish for the next two weeks. Settings popover lands by Friday.',
                'Mira drives the Scribble editor redesign — mode toolbar, AI feedback bar, mobile pass.',
                'Standup format shifts to async on Mondays. Live sync on Tuesdays and Thursdays only.',
              ].map((d, i) => (
                <li key={i} className="flex gap-3">
                  <V2Mono style={{ fontSize: 11, color: v2.accent }}>0{i + 1}</V2Mono>
                  <span style={{ fontFamily: v2Serif, fontSize: 17, lineHeight: 1.45, color: v2.ink }}>{d}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="col-span-5" style={{ borderLeft: `1px solid ${v2.rule}`, paddingLeft: 30 }}>
            <V2Caps>ACTIONS · 7</V2Caps>
            <ul className="mt-5 space-y-4">
              {[
                ['Mira',   'Settings popover spec by Wednesday'],
                ['Roshni', 'Pull pricing analytics for the last 30 days'],
                ['Komal',  'Spec the team plan — start with Minutes sharing'],
                ['Sanjna', 'Move standups to async on Notion'],
                ['Souvik', 'Ship the pill settings popover'],
                ['Mira',   'Mode toolbar spec by Friday'],
                ['Komal',  'Prep the board update doc'],
              ].map(([owner, task], i) => (
                <li key={i} className="flex items-start gap-3 pb-3" style={{ borderBottom: `1px solid ${v2.rule}` }}>
                  <span style={{ display: 'inline-block', height: 22, width: 22, borderRadius: 999, background: v2.accentSoft, color: v2.ink, fontFamily: v2Serif, fontSize: 11, textAlign: 'center', lineHeight: '22px', fontWeight: 500, marginTop: 2 }}>{owner[0]}</span>
                  <div>
                    <V2Mono style={{ fontSize: 10, color: v2.inkFaint, letterSpacing: '0.16em' }}>{owner.toUpperCase()}</V2Mono>
                    <div style={{ fontSize: 14, color: v2.ink, marginTop: 2, lineHeight: 1.4 }}>{task}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <aside className="col-span-3" style={{ borderLeft: `1px solid ${v2.rule}`, paddingLeft: 30 }}>
            <V2Caps>FOLLOW-UPS</V2Caps>
            <ul className="mt-5 space-y-4 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
              <li>· Hinglish edge cases — Sanjna collecting examples</li>
              <li>· Linear integration — scope before next sprint</li>
              <li>· Pricing page rewrite — after Komal&rsquo;s analytics review</li>
            </ul>
            <div className="mt-10 rounded-md p-4" style={{ background: v2.cream2 }}>
              <V2Caps color={v2.accent}>ASK OSCAR</V2Caps>
              <div className="mt-3 space-y-2 text-[12px]" style={{ color: v2.ink }}>
                <div>→ Draft a Slack post</div>
                <div>→ Email actions to owners</div>
                <div>→ Make a one-pager</div>
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-16 pt-10" style={{ borderTop: `1px solid ${v2.rule}` }}>
          <V2Caps>FULL TRANSCRIPT · CONTINUE BELOW</V2Caps>
          <div className="mt-5 space-y-6 max-w-3xl" style={{ fontFamily: v2Serif, fontSize: 17, lineHeight: 1.6, color: v2.ink }}>
            <div>
              <V2Mono style={{ fontSize: 10, color: v2.inkFaint, letterSpacing: '0.16em' }}>SOUVIK · 13:42:08</V2Mono>
              <p className="mt-1">OK so let&rsquo;s do the quick round and then I want to spend most of this hour on the quarter. Mira, you go first.</p>
            </div>
            <div>
              <V2Mono style={{ fontSize: 10, color: v2.inkFaint, letterSpacing: '0.16em' }}>MIRA · 13:42:31</V2Mono>
              <p className="mt-1">Yeah so this week I&rsquo;m wrapping the Scribble mode toolbar. Spec is in good shape, just need final sign-off on the icon for the AI bar — I&rsquo;ll send it after this.</p>
            </div>
            <div>
              <V2Mono style={{ fontSize: 10, color: v2.inkFaint, letterSpacing: '0.16em' }}>ROSHNI · 13:43:18</V2Mono>
              <p className="mt-1">On my side, the pricing analytics pull is happening today. Will share before EOD so we can talk through it tomorrow.</p>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

// ═══ WEB · SETTINGS (ACCOUNT) ════════════════════════════════════════════
function V2WebSettings() {
  const sections = [
    { id: 'account',  label: 'Account',         sub: 'You', active: true },
    { id: 'billing',  label: 'Plans & billing', sub: 'Pro · annual' },
    { id: 'vocab',    label: 'Vocabulary',      sub: '48 words' },
    { id: 'folders',  label: 'Folders',         sub: '4 folders' },
    { id: 'privacy',  label: 'Data & privacy',  sub: 'Export · delete' },
  ];
  function Row({ label, value }) {
    return (
      <div className="flex items-baseline justify-between py-4" style={{ borderBottom: `1px solid ${v2.rule}` }}>
        <V2Caps>{label}</V2Caps>
        <span style={{ fontFamily: v2Sans, fontSize: 15, color: v2.ink }}>{value}</span>
      </div>
    );
  }
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2WebHeader active="SETTINGS" />
      <div className="grid grid-cols-12" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <aside className="col-span-3 px-12 py-14" style={{ borderRight: `1px solid ${v2.rule}` }}>
          <V2Caps>SETTINGS</V2Caps>
          <nav className="mt-7 space-y-6">
            {sections.map(s => (
              <div key={s.id} className="flex items-start justify-between" style={{ borderLeft: s.active ? `2px solid ${v2.accent}` : '2px solid transparent', paddingLeft: 14 }}>
                <div>
                  <div style={{ fontFamily: v2Serif, fontSize: 19, fontWeight: 500, color: s.active ? v2.ink : v2.inkSoft, letterSpacing: '-0.01em' }}>{s.label}</div>
                  <div className="mt-0.5"><V2Caps>{s.sub.toUpperCase()}</V2Caps></div>
                </div>
              </div>
            ))}
          </nav>
        </aside>
        <main className="col-span-9 px-14 py-14">
          <V2Caps>SETTINGS · ACCOUNT</V2Caps>
          <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 60, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
            You, on <em style={{ fontStyle: 'italic', color: v2.accent }}>Oscar</em>.
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>
            Your identity, voice profile, and how Oscar shows up when it pastes for you.
          </p>

          <section className="mt-14 grid grid-cols-12 gap-10" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 32 }}>
            <div className="col-span-3"><V2Caps>IDENTITY</V2Caps></div>
            <div className="col-span-9">
              <Row label="DISPLAY NAME"  value="Souvik Deb" />
              <Row label="EMAIL"         value="souvik@navgurukul.org" />
              <Row label="TIME ZONE"     value="Asia / Kolkata · IST" />
              <Row label="LANGUAGE"      value="English · with Hinglish formatter" />
            </div>
          </section>

          <section className="mt-14 grid grid-cols-12 gap-10" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 32 }}>
            <div className="col-span-3"><V2Caps>VOICE PROFILE</V2Caps></div>
            <div className="col-span-9">
              <Row label="AUTO-CLEANUP"            value="On · Gemini removes filler, fixes formatting" />
              <Row label="CONTEXT-AWARE DICTATION" value="On · adapts per active app" />
              <Row label="PROFANITY"               value="Filtered" />
              <Row label="VOICE SAMPLE"            value="Recorded · 28 sec" />
            </div>
          </section>

          <section className="mt-14 grid grid-cols-12 gap-10" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 32 }}>
            <div className="col-span-3"><V2Caps>SESSIONS</V2Caps></div>
            <div className="col-span-9">
              {[
                ['MacBook Pro · current', 'this device · Mumbai', true],
                ['iPhone 15',             'Mumbai · 2 hours ago', false],
                ['Web · Chrome',          'Mumbai · yesterday',   false],
              ].map(([d, m, here], i) => (
                <div key={i} className="flex items-center justify-between py-4" style={{ borderBottom: `1px solid ${v2.rule}` }}>
                  <div>
                    <div style={{ fontSize: 14, color: v2.ink }}>{d}</div>
                    <V2Caps>{m.toUpperCase()}</V2Caps>
                  </div>
                  {here
                    ? <V2Mono style={{ fontSize: 11, color: v2.accent, letterSpacing: '0.14em' }}>HERE</V2Mono>
                    : <button className="text-[12px]" style={{ color: v2.inkSoft }}>Sign out</button>}
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

// ═══ WEB · LANDING ═══════════════════════════════════════════════════════
function V2WebLanding() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <header className="flex items-center justify-between px-14 py-7">
        <V2Wordmark />
        <nav className="flex items-center gap-9">
          <V2Caps>PRODUCT</V2Caps>
          <V2Caps>PRICING</V2Caps>
          <V2Caps>BLOG</V2Caps>
          <V2Caps>SIGN IN</V2Caps>
        </nav>
        <button className="rounded-full px-5 py-2.5 text-[13px] font-medium" style={{ background: v2.ink, color: v2.cream }}>Get Oscar</button>
      </header>

      <section className="px-14 pt-32 pb-24 text-center">
        <V2Caps>VOICE-FIRST WRITING · FOR PEOPLE WHO TYPE TOO MUCH</V2Caps>
        <h1 className="mt-6 mx-auto" style={{ fontFamily: v2Serif, fontSize: 132, lineHeight: 0.93, letterSpacing: '-0.035em', fontWeight: 500, maxWidth: 1100 }}>
          You talk.<br />
          Oscar <em style={{ fontStyle: 'italic', color: v2.accent }}>listens</em>,<br />
          shapes it,<br />
          hands it back.
        </h1>
        <p className="mt-12 mx-auto max-w-xl text-[17px] leading-relaxed" style={{ color: v2.inkSoft }}>
          A dictation tool that knows what app you&rsquo;re in and writes the way that app deserves. Slack reads like Slack. Code reads like code. Letters read like letters.
        </p>
        <div className="mt-10 flex items-center justify-center gap-5">
          <button className="inline-flex items-center gap-3 rounded-full px-6 py-3 text-[14px] font-medium" style={{ background: v2.ink, color: v2.cream }}>
            <span className="inline-block rounded-full" style={{ height: 7, width: 7, background: v2.accent }} />
            Try Oscar free
          </button>
          <button className="text-[14px]" style={{ color: v2.inkSoft }}>· or watch the 90-second tour</button>
        </div>

        <div className="mt-20 inline-flex items-center gap-3 rounded-full" style={{ background: v2.ink, color: v2.cream, padding: '14px 22px', boxShadow: '0 12px 32px rgba(184,98,61,0.18)' }}>
          <span className="inline-block rounded-full" style={{ height: 8, width: 8, background: v2.accent, boxShadow: `0 0 14px ${v2.accent}` }} />
          <span className="inline-flex items-end gap-0.5" style={{ height: 14 }}>
            {[3, 7, 5, 10, 4, 8, 6, 9, 5, 7, 4, 8].map((h, i) => (
              <span key={i} className="rounded-full" style={{ background: v2.accent, width: 2, height: h }} />
            ))}
          </span>
          <span style={{ fontSize: 13, color: v2.cream2 }}>· listening · 0:08</span>
        </div>
      </section>

      <section className="px-14 py-24" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <V2Caps>THREE WAYS TO LISTEN</V2Caps>
        <div className="mt-10 grid grid-cols-12 gap-12">
          {[
            ['01', 'Stream',   'Dictate into anything.',         'Hold Ctrl + Space anywhere. Oscar types cleaned text directly into the app you’re in — Slack, Notion, Cursor, Gmail, your terminal.'],
            ['02', 'Minutes',  'Meeting notes, automatic.',      'Click record before any call. Oscar captures the whole thing and writes back what mattered — decisions, actions, follow-ups.'],
            ['03', 'Scribble', 'Voice notes, organized.',        'Long-form thinking out loud. Oscar shapes your ramble into a Scribble — TL;DR, structure, the parts worth keeping.'],
          ].map(([n, tag, title, body]) => (
            <article key={n} className="col-span-4">
              <div className="flex items-baseline gap-3">
                <V2Mono style={{ fontSize: 12, color: v2.accent, letterSpacing: '0.16em' }}>{n}</V2Mono>
                <V2Caps>{tag.toUpperCase()}</V2Caps>
              </div>
              <h3 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 36, lineHeight: 1.05, letterSpacing: '-0.02em', fontWeight: 500 }}>{title}</h3>
              <p className="mt-4 text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-14 py-24" style={{ borderTop: `1px solid ${v2.rule}`, background: v2.cream2 }}>
        <V2Caps>WHAT PEOPLE SAY</V2Caps>
        <div className="mt-10 grid grid-cols-12 gap-12">
          {[
            ['It’s the only writing tool I open before I start writing.', 'MIRA PATEL · DESIGNER'],
            ['I haven’t typed a Slack message in three weeks.', 'ROSHNI JHA · PM'],
            ['Oscar caught a detail in a meeting that I missed live.', 'SOUVIK DEB · FOUNDER'],
          ].map(([quote, by], i) => (
            <blockquote key={i} className="col-span-4">
              <p style={{ fontFamily: v2Serif, fontSize: 24, lineHeight: 1.32, color: v2.ink, letterSpacing: '-0.005em' }}>&ldquo;{quote}&rdquo;</p>
              <div className="mt-4"><V2Caps>{by}</V2Caps></div>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="px-14 py-32 text-center" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <h2 style={{ fontFamily: v2Serif, fontSize: 72, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
          Try Oscar <em style={{ fontStyle: 'italic', color: v2.accent }}>today</em>.
        </h2>
        <button className="mt-9 rounded-full px-7 py-3.5 text-[15px] font-medium" style={{ background: v2.ink, color: v2.cream }}>Get Oscar — it&rsquo;s free</button>
      </section>

      <footer className="px-14 py-12 flex items-center justify-between" style={{ borderTop: `1px solid ${v2.rule}` }}>
        <V2Wordmark />
        <V2Caps>© NAVGURUKUL · 2026</V2Caps>
      </footer>
    </div>
  );
}

// ═══ WEB · AUTH ══════════════════════════════════════════════════════════
function V2WebAuth() {
  return (
    <div className="grid grid-cols-12" style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <div className="col-span-6 px-16 py-12 flex flex-col">
        <V2Wordmark />
        <div className="flex-1 flex flex-col justify-center" style={{ maxWidth: 460 }}>
          <V2Caps>SIGN IN · WELCOME BACK</V2Caps>
          <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 56, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
            Pick up where<br />you <em style={{ fontStyle: 'italic', color: v2.accent }}>left off</em>.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>
            Continue with Google to sync your Scribbles, vocabulary, and Minutes across web and desktop.
          </p>
          <button className="mt-9 inline-flex items-center justify-center gap-3 rounded-full px-6 py-4 text-[14px] font-medium" style={{ background: v2.ink, color: v2.cream }}>
            <svg width="16" height="16" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92a8.78 8.78 0 0 0 2.68-6.61z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26a5.4 5.4 0 0 1-3.05.86c-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0a9 9 0 0 0-8.04 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" />
            </svg>
            Continue with Google
          </button>
          <p className="mt-4 text-center text-[12px]" style={{ color: v2.inkFaint }}>No account yet? Same button — we&rsquo;ll create one for you.</p>

          <div className="mt-10 pt-6" style={{ borderTop: `1px solid ${v2.rule}` }}>
            <V2Caps>OR · SIGN IN WITH EMAIL</V2Caps>
            <div className="mt-3 flex items-center gap-3">
              <input placeholder="you@work.com" className="flex-1 bg-transparent outline-none py-3 text-[14px]" style={{ borderBottom: `1px solid ${v2.ink}`, color: v2.ink, fontFamily: v2Sans }} />
              <button className="text-[13px]" style={{ color: v2.accent }}>Send a link →</button>
            </div>
          </div>
        </div>
        <V2Caps>BY SIGNING IN YOU AGREE TO THE TERMS</V2Caps>
      </div>

      <div className="col-span-6 px-16 py-12 flex flex-col" style={{ background: '#0f0d0a', color: v2.cream }}>
        <V2Caps color="#7a7670">A QUIET PROMISE</V2Caps>
        <div className="flex-1 flex flex-col justify-center" style={{ maxWidth: 520 }}>
          <p style={{ fontFamily: v2Serif, fontSize: 44, lineHeight: 1.12, letterSpacing: '-0.02em', color: v2.cream, fontWeight: 500 }}>
            &ldquo;The fastest writing tool I&rsquo;ve owned is the one I never have to <em style={{ fontStyle: 'italic', color: v2.accent }}>type with</em>.&rdquo;
          </p>
          <div className="mt-9 flex items-center gap-3">
            <div style={{ height: 36, width: 36, borderRadius: 999, background: v2.accent }} />
            <div>
              <div style={{ fontFamily: v2Serif, fontSize: 17, color: v2.cream }}>Mira Patel</div>
              <V2Caps color="#7a7670">DESIGNER · OSCAR USER SINCE 2025</V2Caps>
            </div>
          </div>
        </div>
        <V2Caps color="#7a7670">OSCAR · STREAM · MINUTES · SCRIBBLE</V2Caps>
      </div>
    </div>
  );
}

// ═══ DESKTOP · SCRIBBLE TAB ══════════════════════════════════════════════
function V2DesktopScribble() {
  const items = [
    { date: 'TUE · 14:08', source: 'SLACK',    title: 'Status update — pill polish',         preview: '"Wrapping the desktop pill polish today."',          dur: '0:42', open: true },
    { date: 'TUE · 12:18', source: 'NOTION',   title: 'Pricing thoughts on tiers',           preview: '"Two tiers feels right. Free needs a real limit."',  dur: '1:08' },
    { date: 'TUE · 11:45', source: 'CURSOR',   title: 'Refactor note for processItems',      preview: 'Refactor processItems for performance.',             dur: '0:35' },
    { date: 'TUE · 10:02', source: 'GMAIL',    title: 'Reply to Roshni on the deck',         preview: '"Sending the deck and Loom by EOD."',                dur: '0:22' },
    { date: 'TUE · 08:14', source: 'VOICE',    title: 'Morning intention',                   preview: 'Two things matter today.',                           dur: '0:58' },
    { date: 'MON · 17:21', source: 'SCRIBBLE', title: 'Pricing experiments — what we learned', preview: '4 experiments. Two won, two didn’t.',         dur: '12:04' },
  ];
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <V2WinChrome title="OSCAR · SCRIBBLES" />
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        <V2DeskSidebar active="scribble" />
        <div className="col-span-4 overflow-auto" style={{ borderRight: `1px solid ${v2.rule}` }}>
          <div className="px-6 pt-6 pb-5" style={{ borderBottom: `1px solid ${v2.rule}` }}>
            <V2Caps>SCRIBBLES · 86</V2Caps>
            <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.05 }}>Everything you said.</h1>
            <div className="mt-4 flex items-center gap-2.5 rounded-full px-3 py-2" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
              <V2Mono style={{ fontSize: 10, color: v2.inkFaint }}>SEARCH</V2Mono>
              <span style={{ fontSize: 13, color: v2.inkFaint }}>Find by what you said</span>
            </div>
          </div>
          {items.map((s, i) => (
            <div key={i} className="px-6 py-4 cursor-default" style={{ borderBottom: `1px solid ${v2.rule}`, background: s.open ? v2.cream2 : 'transparent' }}>
              <div className="flex items-center justify-between">
                <V2Mono style={{ fontSize: 10, color: v2.ink, letterSpacing: '0.04em' }}>{s.date}</V2Mono>
                <V2Mono style={{ fontSize: 10, color: s.open ? v2.accent : v2.inkFaint, letterSpacing: '0.16em' }}>{s.source}</V2Mono>
              </div>
              <h3 className="mt-1.5" style={{ fontFamily: v2Serif, fontSize: 16, fontWeight: 500, color: v2.ink, letterSpacing: '-0.005em', lineHeight: 1.2 }}>{s.title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed" style={{ color: v2.inkSoft }}>{s.preview}</p>
              <V2Mono style={{ fontSize: 10, color: v2.inkFaint, marginTop: 4, display: 'inline-block' }}>{s.dur}</V2Mono>
            </div>
          ))}
        </div>

        <div className="col-span-5 overflow-auto">
          <div className="px-7 pt-8 pb-6">
            <V2Caps>SLACK · MAY 20 · 14:08 · 0:42</V2Caps>
            <h1 className="mt-2.5" style={{ fontFamily: v2Serif, fontSize: 30, lineHeight: 1.05, letterSpacing: '-0.02em', fontWeight: 500 }}>
              Status update — pill polish<br />and the verifier.
            </h1>
            <div className="mt-5 flex items-center gap-3">
              <button className="inline-flex items-center justify-center rounded-full" style={{ height: 28, width: 28, background: v2.ink, color: v2.cream }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l16 9-16 9V3z" /></svg>
              </button>
              <div className="flex-1 flex items-center gap-0.5" style={{ height: 18 }}>
                {Array.from({ length: 40 }).map((_, i) => {
                  const h = 3 + Math.abs(Math.sin(i * 0.5)) * 12;
                  return <span key={i} className="rounded-full" style={{ width: 2, height: h, background: i < 8 ? v2.accent : v2.ruleHard }} />;
                })}
              </div>
              <V2Mono style={{ fontSize: 10, color: v2.inkFaint }}>0:08 / 0:42</V2Mono>
            </div>

            <p className="mt-7" style={{ fontFamily: v2Serif, fontSize: 17, lineHeight: 1.65, color: v2.ink }}>
              &ldquo;Wrapping the desktop pill polish today. Settings popover is in. Verifier is happy — let&rsquo;s ship this week.&rdquo;
            </p>

            <div className="mt-8 pt-5" style={{ borderTop: `1px solid ${v2.rule}` }}>
              <V2Caps color={v2.accent}>OSCAR&rsquo;S EDIT ↓</V2Caps>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>
                Three filler words removed. Formatted as a Slack status. Ready to paste into the active channel.
              </p>
            </div>

            <div className="mt-7 flex items-center gap-2">
              <button className="text-[11px] rounded-full px-3 py-1.5" style={{ background: v2.ink, color: v2.cream }}>Copy clean</button>
              <button className="text-[11px] rounded-full px-3 py-1.5" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Copy raw</button>
              <button className="text-[11px] rounded-full px-3 py-1.5" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Share</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ DESKTOP · MINUTES TAB ═══════════════════════════════════════════════
function V2DesktopMinutes() {
  const meetings = [
    { d: 'TUE · 13:42', t: 'Standup — north stars',          dur: '27m', n: 5, dec: 3, act: 7 },
    { d: 'MON · 11:00', t: 'Roshni Jha · pricing review',    dur: '45m', n: 3, dec: 1, act: 3 },
    { d: 'FRI · 16:00', t: 'Office hours · Mira & Souvik',   dur: '22m', n: 2, dec: 2, act: 4 },
    { d: 'THU · 09:30', t: 'Quarterly planning · marketing', dur: '34m', n: 3, dec: 4, act: 11 },
    { d: 'WED · 14:00', t: 'Engineering sync · phase 6',     dur: '52m', n: 6, dec: 2, act: 9 },
  ];
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <V2WinChrome title="OSCAR · MINUTES" />
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        <V2DeskSidebar active="minutes" />
        <main className="col-span-9 overflow-auto">
          <div className="px-9 pt-8 pb-6" style={{ borderBottom: `1px solid ${v2.rule}` }}>
            <V2Caps>MINUTES · 12 THIS WEEK</V2Caps>
            <h1 className="mt-1.5" style={{ fontFamily: v2Serif, fontSize: 36, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 500 }}>
              What was <em style={{ fontStyle: 'italic', color: v2.accent }}>decided</em>.
            </h1>
          </div>
          <div className="px-9 py-2">
            {meetings.map((m, i) => (
              <article key={i} className="grid grid-cols-12 gap-4 py-5" style={{ borderBottom: `1px solid ${v2.rule}` }}>
                <div className="col-span-3">
                  <V2Mono style={{ fontSize: 12, color: v2.ink }}>{m.d}</V2Mono>
                  <div className="mt-0.5"><V2Source name="MINUTES" kind={m.dur} /></div>
                </div>
                <div className="col-span-7">
                  <h3 style={{ fontFamily: v2Serif, fontSize: 18, fontWeight: 500, color: v2.ink, letterSpacing: '-0.005em', lineHeight: 1.2 }}>{m.t}</h3>
                  <div className="mt-1.5 flex items-center gap-4 text-[11px]" style={{ color: v2.inkSoft }}>
                    <span>{m.n} attendees</span>
                    <span style={{ color: v2.accent }}>{m.dec} decisions</span>
                    <span>{m.act} actions</span>
                  </div>
                </div>
                <div className="col-span-2 text-right"><V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>continue →</V2Mono></div>
              </article>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

// ═══ DESKTOP · SETTINGS ══════════════════════════════════════════════════
function V2DesktopSettings() {
  const tabs = ['General', 'Account', 'Vocabulary', 'Folders', 'Plans & billing', 'Data & privacy'];
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <V2WinChrome title="OSCAR · SETTINGS" />
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        <V2DeskSidebar active="settings" />
        <main className="col-span-9 grid grid-cols-12 overflow-hidden">
          <div className="col-span-3 px-6 py-7" style={{ borderRight: `1px solid ${v2.rule}` }}>
            <V2Caps>SETTINGS</V2Caps>
            <div className="mt-5 space-y-3">
              {tabs.map((t, i) => (
                <div key={t} className="flex items-center gap-2" style={{
                  borderLeft: i === 0 ? `2px solid ${v2.accent}` : '2px solid transparent',
                  paddingLeft: 10,
                  fontFamily: v2Serif,
                  fontSize: 16, fontWeight: 500,
                  color: i === 0 ? v2.ink : v2.inkSoft,
                  letterSpacing: '-0.005em',
                  paddingTop: 4, paddingBottom: 4,
                }}>
                  {t}
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-9 overflow-auto px-9 py-9">
            <V2Caps>SETTINGS · GENERAL</V2Caps>
            <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 36, lineHeight: 1, letterSpacing: '-0.02em', fontWeight: 500 }}>
              How Oscar <em style={{ fontStyle: 'italic', color: v2.accent }}>behaves</em>.
            </h1>

            <div className="mt-8">
              {[
                ['Global hotkey',            'Ctrl + Space',  'Hold to listen. Tap to start recording.'],
                ['Auto-cleanup',             'On',            'Remove filler words. Fix punctuation. Format for the active app.'],
                ['Context-aware dictation',  'On · context-v1', 'Adapt the output to Slack, Notion, Cursor, Gmail.'],
                ['Sound effects',            'Off',           'Subtle chime when recording starts and stops.'],
                ['Run at login',             'On',            'Oscar starts automatically when you sign in.'],
                ['Pill position',            'Bottom right',  'Where the dictation pill lives at rest.'],
              ].map(([label, value, desc], i) => (
                <div key={i} className="grid grid-cols-12 gap-5 py-4 items-baseline" style={{ borderBottom: `1px solid ${v2.rule}` }}>
                  <div className="col-span-4">
                    <div style={{ fontSize: 14, color: v2.ink, fontWeight: 500 }}>{label}</div>
                    <div className="mt-0.5 text-[12px] leading-relaxed" style={{ color: v2.inkSoft }}>{desc}</div>
                  </div>
                  <div className="col-span-8" style={{ fontFamily: v2Mono, fontSize: 12, color: value === 'Off' ? v2.inkFaint : v2.accent }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ═══ MOBILE · LIBRARY ════════════════════════════════════════════════════
function V2MobileLibrary() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%', position: 'relative', paddingBottom: 110 }}>
      <div className="px-5 pt-7 flex items-center justify-between">
        <V2Wordmark />
        <V2Avatar size={30} />
      </div>
      <div className="px-5 pt-8">
        <V2Caps>YOUR LIBRARY</V2Caps>
        <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 36, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
          86 Scribbles,<br /><em style={{ fontStyle: 'italic', color: v2.accent }}>kept</em>.
        </h1>
        <div className="mt-5 rounded-full flex items-center gap-2.5 px-4 py-2.5" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
          <V2Mono style={{ fontSize: 10, color: v2.inkFaint }}>SEARCH</V2Mono>
          <span style={{ fontSize: 13, color: v2.inkFaint }}>Find by what you said</span>
        </div>
      </div>
      <div className="px-5 mt-7 flex items-center gap-5 pb-3 overflow-x-auto" style={{ borderBottom: `1px solid ${v2.rule}` }}>
        <span style={{ fontSize: 13, color: v2.ink, borderBottom: `1px solid ${v2.ink}`, paddingBottom: 6, whiteSpace: 'nowrap' }}>All</span>
        <span style={{ fontSize: 13, color: v2.inkSoft, paddingBottom: 6, whiteSpace: 'nowrap' }}>Pricing</span>
        <span style={{ fontSize: 13, color: v2.inkSoft, paddingBottom: 6, whiteSpace: 'nowrap' }}>Engineering</span>
        <span style={{ fontSize: 13, color: v2.inkSoft, paddingBottom: 6, whiteSpace: 'nowrap' }}>Standup</span>
        <span style={{ fontSize: 13, color: v2.inkSoft, paddingBottom: 6, whiteSpace: 'nowrap' }}>Inbox</span>
      </div>
      <div className="px-5 pt-2">
        {[
          { d: 'TUE · 14:08', s: 'SLACK',    t: 'Status update — pill polish',         p: 'Wrapping the desktop pill polish today.', dur: '0:42' },
          { d: 'TUE · 12:18', s: 'NOTION',   t: 'Pricing thoughts on tiers',           p: 'Two tiers feels right. Free needs a real limit.', dur: '1:08' },
          { d: 'TUE · 11:45', s: 'CURSOR',   t: 'Refactor note for processItems',      p: 'Refactor processItems for performance.', dur: '0:35' },
          { d: 'TUE · 10:02', s: 'GMAIL',    t: 'Reply to Roshni on the deck',         p: 'Sending the deck and Loom by EOD.', dur: '0:22' },
          { d: 'MON · 17:21', s: 'SCRIBBLE', t: 'Pricing experiments',                 p: '4 experiments. Two won, two didn’t.', dur: '12:04' },
          { d: 'MON · 11:00', s: 'MINUTES',  t: 'Pricing review with Roshni',          p: 'Team plan with shared Minutes.', dur: '44:18' },
        ].map((s, i) => (
          <div key={i} className="py-5" style={{ borderBottom: `1px solid ${v2.rule}` }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <V2Mono style={{ fontSize: 11, color: v2.ink }}>{s.d}</V2Mono>
                <V2Caps>{s.s}</V2Caps>
              </div>
              <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>{s.dur}</V2Mono>
            </div>
            <h3 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 17, lineHeight: 1.2, fontWeight: 500, color: v2.ink, letterSpacing: '-0.005em' }}>{s.t}</h3>
            <p className="mt-1 text-[12px] leading-relaxed" style={{ color: v2.inkSoft }}>{s.p}</p>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>
        <div className="rounded-full px-5 py-3 inline-flex items-center gap-2.5" style={{ background: v2.ink, color: v2.cream, boxShadow: '0 8px 28px rgba(0,0,0,0.18)' }}>
          <span className="inline-block rounded-full" style={{ height: 7, width: 7, background: v2.accent }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Tap & hold to listen</span>
        </div>
      </div>
    </div>
  );
}

// ═══ MOBILE · EDITOR ═════════════════════════════════════════════════════
function V2MobileEditor() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <div className="px-5 pt-7 flex items-center justify-between">
        <V2Caps>← BACK</V2Caps>
        <V2Caps>SHARE</V2Caps>
      </div>
      <article className="px-5 pt-8 pb-24">
        <V2Caps>SCRIBBLE · MAY 18 · 13:42 · 12 MIN</V2Caps>
        <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 30, lineHeight: 1.02, letterSpacing: '-0.025em', fontWeight: 500 }}>
          Pricing experiments —<br />what we <em style={{ fontStyle: 'italic', color: v2.accent }}>learned</em>.
        </h1>

        <div className="mt-6 flex items-center gap-3">
          <button className="inline-flex items-center justify-center rounded-full" style={{ height: 32, width: 32, background: v2.ink, color: v2.cream }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l16 9-16 9V3z" /></svg>
          </button>
          <div className="flex-1 flex items-center gap-0.5" style={{ height: 18 }}>
            {Array.from({ length: 30 }).map((_, i) => {
              const h = 3 + Math.abs(Math.sin(i * 0.45)) * 13;
              return <span key={i} className="rounded-full" style={{ width: 2, height: h, background: i < 8 ? v2.accent : v2.ruleHard }} />;
            })}
          </div>
          <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>2:18</V2Mono>
        </div>

        <div className="mt-8 rounded-md p-5" style={{ background: v2.cream2 }}>
          <V2Caps color={v2.accent}>OSCAR&rsquo;S MARGIN</V2Caps>
          <p className="mt-2" style={{ fontFamily: v2Serif, fontSize: 19, lineHeight: 1.35, color: v2.ink, letterSpacing: '-0.005em' }}>
            4 experiments. <em style={{ fontStyle: 'italic', color: v2.accent }}>Two won.</em> Push them harder next month.
          </p>
          <div className="mt-5">
            <V2Caps>WHAT WORKED</V2Caps>
            <ul className="mt-2 space-y-1.5 text-[13px]" style={{ color: v2.inkSoft }}>
              <li>· &ldquo;For teams&rdquo; headline · 1.4% → 2.1%</li>
              <li>· Annual save 17% → 20% lifted ratio +4pt</li>
            </ul>
          </div>
          <div className="mt-4">
            <V2Caps>NEXT MONTH</V2Caps>
            <ul className="mt-2 space-y-1.5 text-[13px]" style={{ color: v2.inkSoft }}>
              <li>· Test 14-day trial (up from 7)</li>
              <li>· Roll &ldquo;for teams&rdquo; copy site-wide</li>
              <li>· Push annual save to 22%</li>
            </ul>
          </div>
        </div>

        <div className="mt-8">
          <V2Caps>YOUR VOICE · UNEDITED</V2Caps>
          <div className="mt-3 space-y-4" style={{ fontFamily: v2Serif, fontSize: 17, lineHeight: 1.55, color: v2.ink }}>
            <p>OK so the big thing from the last month is that we ran four pricing experiments and only two of them actually moved a metric we care about.</p>
            <p>The first one was the team plan landing page where we just said &ldquo;for teams&rdquo; instead of listing seats. That worked.</p>
            <p>The second was the annual save percentage. We bumped it from 17 to 20 and saw the annual ratio go up by about 4 points.</p>
          </div>
        </div>
      </article>
    </div>
  );
}

Object.assign(window, {
  V2WebHeader, V2WinChrome, V2DeskSidebar,
  V2WebLibrary, V2WebMinutesList, V2WebMinutesDetail, V2WebSettings, V2WebLanding, V2WebAuth,
  V2DesktopScribble, V2DesktopMinutes, V2DesktopSettings,
  V2MobileLibrary, V2MobileEditor,
});
