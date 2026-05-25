// oscar-v2-screens4.jsx — Wave 4: filling the seven codebase gaps.
//   /auth/post-callback · /download · /terms · /refund-policy ·
//   /settings/organization/{analytics, audit, billing}
//
// Same warm cream / ink / terracotta system. Editorial spacing.
// Original designs — no third-party UI tropes; tone matches v1-v3.

const v2          = window.v2;
const v2Sans      = window.v2Sans;
const v2Serif     = window.v2Serif;
const v2Mono      = window.v2Mono;
const V2Mono      = window.V2Mono;
const V2Caps      = window.V2Caps;
const V2Wordmark  = window.V2Wordmark;
const V2Avatar    = window.V2Avatar;
const V2WebHeader = window.V2WebHeader;

// ─── Local team header (the canonical one isn't exported to window) ──────
function V2TeamHeader4({ active, org = 'NavGurukul · Product' }) {
  return (
    <header className="flex items-center justify-between px-14 py-6" style={{ borderBottom: `1px solid ${v2.rule}` }}>
      <div className="flex items-center gap-6">
        <V2Wordmark />
        <div className="flex items-center gap-2.5 rounded-full pl-2 pr-3 py-1" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
          <div style={{ height: 22, width: 22, borderRadius: 5, background: v2.accent, color: v2.cream, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: v2Serif, fontWeight: 500, fontSize: 12 }}>N</div>
          <span style={{ fontSize: 13, color: v2.ink, fontWeight: 500 }}>{org}</span>
          <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>↓</V2Mono>
        </div>
      </div>
      <nav className="flex items-center gap-8">
        {['FEED', 'DOCS', 'MEMBERS', 'SETTINGS'].map(label =>
          label === active
            ? <span key={label} style={{ fontFamily: v2Mono, fontSize: 11, letterSpacing: '0.18em', color: v2.ink, borderBottom: `1px solid ${v2.ink}`, paddingBottom: 2 }}>{label}</span>
            : <V2Caps key={label}>{label}</V2Caps>
        )}
      </nav>
      <div className="flex items-center gap-3">
        <V2Caps>YOU · SOUVIK</V2Caps>
        <V2Avatar size={32} />
      </div>
    </header>
  );
}

// ─── Org settings shell ──────────────────────────────────────────────────
// Expanded sidebar — Billing, Analytics, Audit now slot in as siblings of
// Details / Members / Invites.
function V2OrgSettingsShell({ active, eyebrow, title, lead, children }) {
  const sections = [
    { id: 'details',      label: 'Details',       sub: 'Identity · mark' },
    { id: 'members',      label: 'Members & roles', sub: '12 members' },
    { id: 'invites',      label: 'Invites',       sub: '3 pending' },
    { id: 'billing',      label: 'Billing',       sub: 'Pro · workspace' },
    { id: 'analytics',    label: 'Analytics',     sub: 'Usage · members' },
    { id: 'audit',        label: 'Audit log',     sub: 'Shares · access' },
    { id: 'integrations', label: 'Integrations',  sub: 'Slack · Notion' },
    { id: 'sso',          label: 'SSO',           sub: 'Coming soon' },
  ];
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <V2TeamHeader4 active="SETTINGS" />
      <div className="grid grid-cols-12 px-14 py-14 gap-10">
        <aside className="col-span-3">
          <V2Caps>ORG SETTINGS</V2Caps>
          <nav className="mt-5 space-y-4">
            {sections.map((s) => (
              <div key={s.id} style={{ borderLeft: s.id === active ? `2px solid ${v2.accent}` : '2px solid transparent', paddingLeft: 14 }}>
                <div style={{ fontFamily: v2Serif, fontSize: 18, fontWeight: 500, color: s.id === active ? v2.ink : v2.inkSoft, letterSpacing: '-0.005em' }}>{s.label}</div>
                <div className="mt-0.5"><V2Caps>{s.sub.toUpperCase()}</V2Caps></div>
              </div>
            ))}
          </nav>
        </aside>
        <main className="col-span-9">
          <V2Caps>{eyebrow.toUpperCase()}</V2Caps>
          <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 52, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>{title}</h1>
          {lead && <p className="mt-5 max-w-xl text-[15px] leading-relaxed" style={{ color: v2.inkSoft }}>{lead}</p>}
          <div className={lead ? 'mt-12' : 'mt-10'}>{children}</div>
        </main>
      </div>
    </div>
  );
}

// ─── Legal shell ─────────────────────────────────────────────────────────
function V2LegalShell({ active, eyebrow, title, lead, toc, children }) {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <header className="flex items-center justify-between px-14 py-7" style={{ borderBottom: `1px solid ${v2.rule}` }}>
        <V2Wordmark />
        <nav className="flex items-center gap-8">
          {['PRIVACY', 'TERMS', 'REFUNDS'].map((label) =>
            label === active
              ? <span key={label} style={{ fontFamily: v2Mono, fontSize: 11, letterSpacing: '0.18em', color: v2.ink, borderBottom: `1px solid ${v2.ink}`, paddingBottom: 2 }}>{label}</span>
              : <V2Caps key={label}>{label}</V2Caps>
          )}
        </nav>
      </header>

      <article className="mx-auto px-14 py-16 grid grid-cols-12 gap-14" style={{ maxWidth: 1180 }}>
        <aside className="col-span-3">
          <div style={{ position: 'sticky', top: 60 }}>
            <V2Caps>ON THIS PAGE</V2Caps>
            <nav className="mt-4 space-y-2.5 text-[13px]" style={{ color: v2.inkSoft }}>
              {toc.map((t, i) => (
                <div key={i} style={{ color: i === 0 ? v2.ink : v2.inkSoft, fontWeight: i === 0 ? 500 : 400 }}>{i === 0 && '→ '}{t}</div>
              ))}
            </nav>
            <div className="mt-9" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 18 }}>
              <V2Caps>QUESTIONS</V2Caps>
              <p className="mt-3 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>Settings → Help, or write to <span style={{ color: v2.ink }}>hello@oscar.so</span>.</p>
            </div>
          </div>
        </aside>

        <main className="col-span-9" style={{ maxWidth: 760 }}>
          <V2Caps>{eyebrow.toUpperCase()}</V2Caps>
          <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 72, lineHeight: 0.96, letterSpacing: '-0.025em', fontWeight: 500 }}>{title}</h1>
          {lead && <p className="mt-7 text-[20px] leading-relaxed" style={{ color: v2.ink, fontFamily: v2Serif }}>{lead}</p>}
          <div className="mt-12 space-y-12">{children}</div>
        </main>
      </article>
    </div>
  );
}

function LegalSection({ h, children }) {
  return (
    <section>
      <h2 style={{ fontFamily: v2Serif, fontSize: 30, fontWeight: 500, letterSpacing: '-0.015em' }}>{h}</h2>
      <div className="mt-3 space-y-3 text-[16px] leading-relaxed" style={{ color: v2.ink }}>{children}</div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · POST-CALLBACK — the brief moment between OAuth handoff and the app
// ═══════════════════════════════════════════════════════════════════════════
function V2WebPostCallback() {
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      <div className="px-14 pt-14 pb-8">
        <V2Caps>/auth/post-callback · TWO STATES</V2Caps>
        <h1 className="mt-2" style={{ fontFamily: v2Serif, fontSize: 56, lineHeight: 0.98, letterSpacing: '-0.025em', fontWeight: 500 }}>
          One moment — finishing your <em style={{ fontStyle: 'italic', color: v2.accent }}>sign-in</em>.
        </h1>
        <p className="mt-4 max-w-xl text-[14px] leading-relaxed" style={{ color: v2.inkSoft }}>
          Supabase has handed us a session. We refresh it, store the cookie, and quietly send you where you were going. Most of the time you blink and it’s over.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6 px-14 pb-14">
        {/* LOADING */}
        <div className="rounded-lg p-10" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
          <V2Caps color={v2.accent}>01 · WORKING · &lt; 1 SEC</V2Caps>
          <div className="mt-7 flex items-center gap-1.5" style={{ height: 16 }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <span key={i} className="rounded-full" style={{ width: 3, height: 6 + (i % 4) * 3, background: i < 5 ? v2.accent : v2.ruleHard }} />
            ))}
          </div>
          <h2 className="mt-7" style={{ fontFamily: v2Serif, fontSize: 32, lineHeight: 1.0, fontWeight: 500, letterSpacing: '-0.015em' }}>
            Restoring your <em style={{ fontStyle: 'italic', color: v2.accent }}>session</em>.
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed" style={{ color: v2.inkSoft, maxWidth: 380 }}>
            Reading the cookie. Refreshing the token. Then sending you to Today — or wherever you were when sign-in interrupted you.
          </p>

          <div className="mt-7 grid grid-cols-2 gap-3">
            {[
              ['SESSION',  'PRESENT'],
              ['REFRESH',  'OK'],
              ['REDIRECT', '→ /streams'],
              ['LATENCY',  '420 MS'],
            ].map(([k, v], i) => (
              <div key={i} className="rounded-md px-3 py-2.5" style={{ background: v2.cream, border: `1px solid ${v2.rule}` }}>
                <V2Caps>{k}</V2Caps>
                <V2Mono style={{ display: 'block', fontSize: 12, color: v2.ink, marginTop: 4 }}>{v}</V2Mono>
              </div>
            ))}
          </div>
        </div>

        {/* ERROR */}
        <div className="rounded-lg p-10" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
          <V2Caps color="#8c2f25">02 · DIDN’T FINALIZE</V2Caps>
          <div className="mt-7">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" stroke="#8c2f25" strokeWidth="1.3" />
              <path d="M12 7v6M12 16v0.5" stroke="#8c2f25" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="mt-6" style={{ fontFamily: v2Serif, fontSize: 32, lineHeight: 1.0, fontWeight: 500, letterSpacing: '-0.015em' }}>
            Couldn’t finish signing you in.
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed" style={{ color: v2.inkSoft, maxWidth: 380 }}>
            We received the handoff but no active session came back. Usually a stale cookie or a slow network — almost always fixed by trying once more.
          </p>
          <div className="mt-6 rounded-md px-4 py-3" style={{ background: v2.cream, border: `1px solid #d6b3a8` }}>
            <V2Caps color="#8c2f25">REPORTED ERROR</V2Caps>
            <V2Mono style={{ display: 'block', fontSize: 12, color: v2.ink, marginTop: 4 }}>No active session after sign-in</V2Mono>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button className="text-[12px] rounded-full px-4 py-2 font-medium" style={{ background: v2.ink, color: v2.cream }}>Back to sign in</button>
            <button className="text-[12px] rounded-full px-4 py-2" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Get help →</button>
          </div>
        </div>
      </div>

      <div className="px-14 pb-14">
        <div className="rounded-md px-5 py-4 flex items-center justify-between" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
          <div className="flex items-center gap-3">
            <V2Caps>UNDER THE HOOD</V2Caps>
            <span style={{ fontSize: 13, color: v2.inkSoft }}>read session → refresh if missing → drop the stored <V2Mono style={{ fontSize: 12 }}>auth_redirect_next</V2Mono> → router.replace</span>
          </div>
          <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>route · packages/web/app/auth/post-callback</V2Mono>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · DOWNLOAD — auto-detect, mac-arch chooser, three-slide showcase
// ═══════════════════════════════════════════════════════════════════════════
function V2WebDownload() {
  const slides = [
    { eyebrow: 'WORKS OFFLINE', big: '100% local', title: 'No internet needed.', body: 'Whisper AI runs entirely on your device. Your voice never leaves your computer.' },
    { eyebrow: 'WORKS EVERYWHERE', big: 'Global shortcut', title: <>Press <V2Mono style={{ background: 'rgba(184,98,61,0.18)', padding: '1px 8px', borderRadius: 4, color: v2.accentSoft }}>Fn</V2Mono> to record.</>, body: 'Start recording from any app, any window. No need to switch contexts.' },
    { eyebrow: 'OPTIONAL CLOUD AI', big: 'AI polish', title: 'Perfect formatting.', body: 'Enable cloud AI to remove filler words, fix grammar, and structure your Scribbles beautifully.' },
  ];
  return (
    <div style={{ background: v2.cream, color: v2.ink, fontFamily: v2Sans, minHeight: '100%' }}>
      {/* shared header so it sits in the marketing surface */}
      <header className="flex items-center justify-between px-14 py-7">
        <V2Wordmark />
        <nav className="flex items-center gap-9">
          <V2Caps>PRODUCT</V2Caps>
          <V2Caps>PRICING</V2Caps>
          <V2Caps>BLOG</V2Caps>
          <V2Caps>SIGN IN</V2Caps>
        </nav>
        <span style={{ fontFamily: v2Mono, fontSize: 11, letterSpacing: '0.18em', color: v2.ink, borderBottom: `1px solid ${v2.ink}`, paddingBottom: 2 }}>DOWNLOAD</span>
      </header>

      {/* live: left = confirmation, right = currently-showing slide */}
      <section className="grid grid-cols-2 px-14 pt-10 pb-14 gap-14" style={{ borderTop: `1px solid ${v2.rule}` }}>
        {/* LEFT — confirmation + arch picker */}
        <div className="flex flex-col" style={{ minHeight: 620 }}>
          <V2Caps color={v2.accent}>DOWNLOAD STARTED · OSCAR 0.5.26</V2Caps>
          <h1 className="mt-3" style={{ fontFamily: v2Serif, fontSize: 76, lineHeight: 0.96, letterSpacing: '-0.025em', fontWeight: 500 }}>
            Oscar is on its <em style={{ fontStyle: 'italic', color: v2.accent }}>way</em>.
          </h1>
          <p className="mt-6 text-[16px] leading-relaxed" style={{ color: v2.inkSoft, maxWidth: 480 }}>
            We detected your machine and started the right build. While you wait, take a look at what makes the desktop app different from the web.
          </p>

          <div className="mt-8 rounded-md px-5 py-4 flex items-center justify-between" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
            <div className="flex items-center gap-3">
              <span style={{ display: 'inline-block', height: 10, width: 10, borderRadius: 999, background: v2.accent }} />
              <div>
                <V2Caps>DETECTED · MAC · APPLE SILICON</V2Caps>
                <V2Mono style={{ display: 'block', fontSize: 12, color: v2.ink, marginTop: 4 }}>OSCAR_0.5.26_aarch64.dmg · 92 MB</V2Mono>
              </div>
            </div>
            <button className="text-[12px] rounded-full px-4 py-2" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Didn’t start? Click again</button>
          </div>

          <div className="mt-7">
            <V2Caps>NOT SURE WHICH MAC YOU HAVE</V2Caps>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-md px-4 py-3.5" style={{ background: v2.cream, border: `1px solid ${v2.accent}` }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 14, color: v2.ink, fontWeight: 500 }}>Apple Silicon</span>
                  <V2Mono style={{ fontSize: 11, color: v2.accent }}>CHOSEN</V2Mono>
                </div>
                <V2Caps>M1 · M2 · M3 · M4</V2Caps>
              </div>
              <div className="rounded-md px-4 py-3.5" style={{ background: v2.cream, border: `1px solid ${v2.rule}` }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 14, color: v2.inkSoft }}>Intel</span>
                  <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>→</V2Mono>
                </div>
                <V2Caps>2019 AND EARLIER</V2Caps>
              </div>
            </div>
            <p className="mt-3 text-[12px]" style={{ color: v2.inkFaint }}>Not sure? <span style={{ color: v2.accent }}>Check your Mac chip →</span></p>
          </div>

          <div className="mt-auto pt-9 grid grid-cols-4 gap-3" style={{ borderTop: `1px solid ${v2.rule}` }}>
            {[
              ['MAC ARM', 'aarch64.dmg'],
              ['MAC X64', 'x64.dmg'],
              ['WINDOWS', 'x64-setup.exe'],
              ['LINUX',   'amd64.AppImage'],
            ].map(([k, v], i) => (
              <div key={i}>
                <V2Caps>{k}</V2Caps>
                <V2Mono style={{ display: 'block', fontSize: 11, color: v2.ink, marginTop: 4 }}>{v}</V2Mono>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — currently-showing showcase slide on dark stage */}
        <div className="rounded-lg overflow-hidden flex flex-col" style={{ background: v2.night, color: v2.cream, minHeight: 620, padding: 48, position: 'relative' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(60% 50% at 30% 30%, rgba(184,98,61,0.18), transparent 70%)' }} />
          <V2Caps color={v2.accentSoft}>SHOWCASE · SLIDE 01 / 03</V2Caps>
          <div className="mt-auto" style={{ position: 'relative' }}>
            <V2Caps color={v2.accentSoft}>{slides[0].eyebrow}</V2Caps>
            <h2 className="mt-4" style={{ fontFamily: v2Serif, fontStyle: 'italic', fontSize: 64, lineHeight: 0.98, letterSpacing: '-0.02em', fontWeight: 500 }}>
              {slides[0].title}
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed" style={{ color: 'rgba(247,244,238,0.7)', maxWidth: 380, fontStyle: 'italic', fontFamily: v2Serif }}>
              {slides[0].body}
            </p>
            <div className="mt-9 flex items-center gap-2">
              <span style={{ height: 6, width: 22, borderRadius: 999, background: v2.cream }} />
              <span style={{ height: 6, width: 6, borderRadius: 999, background: 'rgba(247,244,238,0.3)' }} />
              <span style={{ height: 6, width: 6, borderRadius: 999, background: 'rgba(247,244,238,0.3)' }} />
              <V2Mono style={{ marginLeft: 14, fontSize: 10, color: 'rgba(247,244,238,0.45)', letterSpacing: '0.16em' }}>AUTO · 5s</V2Mono>
            </div>
          </div>
        </div>
      </section>

      {/* All three showcase slides as a strip below */}
      <section className="px-14 pb-20">
        <V2Caps>THE THREE PROMO SLIDES · ROTATE EVERY 5 SECONDS</V2Caps>
        <div className="mt-5 grid grid-cols-3 gap-6">
          {slides.map((s, i) => (
            <div key={i} className="rounded-lg overflow-hidden" style={{ background: v2.night, color: v2.cream, padding: 28, minHeight: 220 }}>
              <V2Caps color={v2.accentSoft}>{s.eyebrow}</V2Caps>
              <div className="mt-4" style={{ fontFamily: v2Serif, fontSize: 28, fontStyle: 'italic', lineHeight: 1.05, fontWeight: 500, letterSpacing: '-0.015em' }}>
                {s.title}
              </div>
              <p className="mt-4 text-[12.5px] leading-relaxed" style={{ color: 'rgba(247,244,238,0.65)' }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · TERMS OF SERVICE
// ═══════════════════════════════════════════════════════════════════════════
function V2WebLegalTerms() {
  const toc = [
    'The agreement', 'Your account', 'Payment and billing',
    'Cancellation', 'Fair use', 'Your content', 'Acceptable use',
    'Our intellectual property', 'AI-generated content',
    'Features and bugs', 'Service availability', 'Liability',
    'Account termination', 'Changes', 'Governing law',
  ];
  return (
    <V2LegalShell
      active="TERMS"
      eyebrow="LEGAL · TERMS OF SERVICE · LAST UPDATED FEB 22, 2026"
      title={<>The agreement, in <em style={{ fontStyle: 'italic', color: v2.accent }}>plain English</em>.</>}
      lead={<>Thank you for using Oscar. By using Oscar in any way, you agree to these Terms. If you don’t agree, please don’t use it. There may be times we don’t enforce a particular right — that doesn’t mean we’ve waived it.</>}
      toc={toc}
    >
      <LegalSection h="Your account">
        <p>You need an account to use Oscar. Provide accurate information and keep it up to date. You’re responsible for keeping your account secure — don’t share credentials. You must be of legal age to enter a binding contract, or have a parent or guardian’s permission. <strong>Minimum 13.</strong></p>
      </LegalSection>

      <LegalSection h="Payment and billing">
        <p>Subscriptions are billed in advance on a recurring basis. Prices are listed in INR and USD. By subscribing you authorize recurring charges. Your subscription renews automatically unless you cancel. We give 30 days notice before any price change.</p>
        <p>Upgrading from Free to Pro starts your billing cycle on the day of upgrade. Fees are exclusive of applicable taxes — where required, we collect and remit them on your behalf.</p>
      </LegalSection>

      <LegalSection h="Cancellation and refunds">
        <p>You can cancel at any time from your account settings. Cancellation takes effect at the end of the current billing period; you retain access until that date. No partial refunds for mid-cycle cancellations.</p>
        <p>New subscriptions are eligible for a refund within 7 days. Technical issues may qualify for prorated refunds. Details live in our <span style={{ color: v2.accent }}>Refund Policy</span>.</p>
      </LegalSection>

      <LegalSection h="Fair use">
        <p>Usage limits depend on your tier. Excessive or abusive use may result in service limits. We’ll reach out before any action unless other users would be affected. Commercial use requires Pro.</p>
      </LegalSection>

      <LegalSection h="Your content">
        <p>You own what you create. Voice recordings and Scribbles remain yours under applicable IP laws. You grant us a limited license to process, store, and display your content <strong>only</strong> to provide the service to you. We don’t claim ownership of anything you create.</p>
      </LegalSection>

      <LegalSection h="Acceptable use">
        <p>Use Oscar lawfully. Don’t violate any laws, infringe IP, transmit harmful or offensive content, attempt to breach security, reverse-engineer the service, use automated tools to abuse it, or resell or redistribute it. Uploading malware is strictly prohibited.</p>
      </LegalSection>

      <LegalSection h="Our intellectual property">
        <p>The service itself — software, features, designs — is owned by Oscar and protected by IP laws. Don’t copy, modify, or distribute any part without written permission.</p>
      </LegalSection>

      <LegalSection h="AI-generated content">
        <p>Our AI formatting aims to produce clean, accurate Scribbles. It isn’t perfect. <strong>Review and verify AI output before relying on it</strong>. We don’t guarantee complete accuracy.</p>
      </LegalSection>

      <LegalSection h="Features and bugs">
        <p>We build with care and test before releasing. No software is bug-free. We track reports and prioritise security and data issues. We make no guarantees the service will meet every requirement, and not every reported bug will get fixed.</p>
      </LegalSection>

      <LegalSection h="Service availability">
        <p>We work to keep Oscar reliable, but cannot guarantee uninterrupted service. Scheduled maintenance will be announced when possible. We aren’t liable for interruptions, including those caused by third-party services we depend on.</p>
      </LegalSection>

      <LegalSection h="Liability">
        <p>The service is provided as-is. We aren’t liable for indirect or consequential damages — lost data, lost revenue, disruption to your work — from your use of Oscar. If we’re ever found liable, our liability is limited to what you paid us in the past 12 months. <strong>Keep your own backups of anything important.</strong></p>
      </LegalSection>

      <LegalSection h="Account termination">
        <p>We may suspend or terminate accounts that violate these Terms, are used for fraud, or as required by law — or if you ask us to. Where possible we’ll notify you first so you can retrieve your data.</p>
      </LegalSection>

      <LegalSection h="Changes">
        <p>We may update these Terms. For material changes we’ll notify you via email or in-app and refresh the date at the top. Continued use means you accept the updated Terms.</p>
      </LegalSection>

      <LegalSection h="Governing law">
        <p>These Terms are governed by the laws of India. Disputes are resolved in the courts of India.</p>
      </LegalSection>

      <div className="rounded-md px-6 py-5 flex items-center justify-between" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
        <div>
          <V2Caps>SEE ALSO</V2Caps>
          <p className="mt-1 text-[14px]" style={{ color: v2.ink }}>Privacy Policy · Refund Policy</p>
        </div>
        <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>route · packages/web/app/terms</V2Mono>
      </div>
    </V2LegalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · REFUND POLICY
// ═══════════════════════════════════════════════════════════════════════════
function V2WebLegalRefund() {
  const toc = [
    '7-day money-back', 'Technical issues', 'Billing errors',
    'Cancellations', 'When refunds aren’t issued', 'Chargebacks',
    'How refunds are processed',
  ];
  return (
    <V2LegalShell
      active="REFUNDS"
      eyebrow="LEGAL · REFUND POLICY · LAST UPDATED FEB 22, 2026"
      title={<>When refunds <em style={{ fontStyle: 'italic', color: v2.accent }}>happen</em>, and when they don’t.</>}
      lead={<>We want you to feel confident subscribing to Oscar. This page is honest about when we issue refunds, so there are no surprises.</>}
      toc={toc}
    >
      <LegalSection h="7-day money-back guarantee">
        <p>If you subscribe to Oscar Pro for the first time and change your mind, you can request a full refund <strong>within 7 days</strong> — no questions asked. New subscribers only. Settings → Billing → Request Refund, or contact support.</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            ['01 · REVIEW',     '≤ 2 business days', 'We confirm eligibility and acknowledge.'],
            ['02 · PROCESS',    '5–7 business days', 'Approved refunds are sent through Razorpay.'],
            ['03 · YOUR BANK',  '+3–5 business days','Timing depends on your bank — usually within a week.'],
          ].map(([k, t, body], i) => (
            <div key={i} className="rounded-md p-4" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
              <V2Caps color={v2.accent}>{k}</V2Caps>
              <V2Mono style={{ display: 'block', fontSize: 12, color: v2.ink, marginTop: 4 }}>{t.toUpperCase()}</V2Mono>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>{body}</p>
            </div>
          ))}
        </div>
      </LegalSection>

      <LegalSection h="Technical issues">
        <p>If something on our end stops you using Oscar — an outage longer than 48 hours, a critical feature failure, or an AI processing failure caused by us — you may be eligible for a prorated refund for the affected period. Tell us right away; we respond within 72 hours.</p>
      </LegalSection>

      <LegalSection h="Billing errors">
        <p>If you’re charged twice for the same period, or charged an amount different from what was shown at checkout, we refund the error immediately on verification. These are <strong>our mistakes</strong>, and we own them.</p>
      </LegalSection>

      <LegalSection h="Cancellations">
        <p>If you cancel outside the 7-day window, no refund for the remaining period — but you keep Pro access until the end of the cycle. No prorated refunds for mid-cycle cancellations. The Free plan has no charges and no refunds apply.</p>
      </LegalSection>

      <LegalSection h="When refunds aren’t issued">
        <ul className="space-y-2 pl-5" style={{ listStyle: 'disc', color: v2.inkSoft }}>
          <li style={{ color: v2.ink }}>Change of mind after the 7-day window</li>
          <li style={{ color: v2.ink }}>Partial use of a billing period</li>
          <li style={{ color: v2.ink }}>Failure to cancel before a renewal date</li>
          <li style={{ color: v2.ink }}>Account termination due to Terms violations</li>
          <li style={{ color: v2.ink }}>Issues caused by third-party services or user error</li>
          <li style={{ color: v2.ink }}>Dissatisfaction with AI formatting quality</li>
          <li style={{ color: v2.ink }}>Unused features or services within your plan</li>
        </ul>
      </LegalSection>

      <LegalSection h="Chargebacks">
        <p>Before initiating a chargeback with your bank, please contact us first — we resolve most billing issues quickly. Chargebacks may result in immediate account suspension. Chargebacks filed after a refund has already been issued may be reported as fraud.</p>
      </LegalSection>

      <LegalSection h="How refunds are processed">
        <p>All refunds go to the original payment method through Razorpay. We can’t refund a different method. Refunds are in the same currency as the original charge — INR for Indian payments, USD for international. We aren’t responsible for exchange-rate fluctuations between purchase and refund.</p>
      </LegalSection>

      {/* QUICK SUMMARY — pulled out as a single editorial card */}
      <aside className="rounded-lg p-7" style={{ background: v2.ink, color: v2.cream }}>
        <V2Caps color={v2.accentSoft}>QUICK SUMMARY · IF YOU READ NOTHING ELSE</V2Caps>
        <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[14px]" style={{ fontFamily: v2Serif }}>
          {[
            'New subscribers: 7-day money-back, no questions',
            'Full refund for billing errors',
            'Prorated refunds for extended technical issues',
            'No refunds for mid-cycle cancellations (after 7 days)',
            'No refunds for Terms violations',
            'Processed in 5–7 business days',
          ].map((line, i) => (
            <li key={i} className="flex items-start gap-2" style={{ color: v2.cream }}>
              <span style={{ color: v2.accent, fontFamily: v2Mono, fontSize: 12, marginTop: 4 }}>·</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </aside>
    </V2LegalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · ORG ANALYTICS — usage for the workspace
// ═══════════════════════════════════════════════════════════════════════════
function V2WebOrgAnalytics() {
  const months = [
    { m: 'DEC ’25', n: 41 },
    { m: 'JAN ’26', n: 58 },
    { m: 'FEB ’26', n: 76 },
    { m: 'MAR ’26', n: 92 },
    { m: 'APR ’26', n: 88 },
    { m: 'MAY ’26', n: 124 },
  ];
  const max = Math.max(...months.map((m) => m.n));
  const members = [
    { n: 'Souvik Deb',    c: 38 },
    { n: 'Mira Patel',    c: 31 },
    { n: 'Roshni Jha',    c: 22 },
    { n: 'Komal Ahire',   c: 19 },
    { n: 'Sanjna Panwar', c: 12 },
    { n: 'Aniket Devkar', c:  2 },
  ];
  const memberMax = Math.max(...members.map((m) => m.c));

  return (
    <V2OrgSettingsShell
      active="analytics"
      eyebrow="ORG SETTINGS · ANALYTICS"
      title={<>What the workspace has been <em style={{ fontStyle: 'italic', color: v2.accent }}>saying</em>.</>}
      lead="Usage across NavGurukul · Product. Owners and admins only. Numbers refresh hourly."
    >
      {/* Stat cards */}
      <section className="grid grid-cols-4 gap-3">
        {[
          ['MEMBERS',          '12', '+1 this month'],
          ['SHARED SCRIBBLES', '84', '+22 this month'],
          ['SHARED MEETINGS',  '37', '+6 this month'],
          ['WORKSPACE DOCS',   '19', '+3 this month'],
        ].map(([k, v, sub], i) => (
          <div key={i} className="rounded-lg p-5" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
            <V2Caps>{k}</V2Caps>
            <div className="mt-3" style={{ fontFamily: v2Serif, fontSize: 44, lineHeight: 1, fontWeight: 500, letterSpacing: '-0.02em', color: v2.ink }}>{v}</div>
            <V2Mono style={{ display: 'block', fontSize: 11, color: v2.accent, marginTop: 6, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{sub}</V2Mono>
          </div>
        ))}
      </section>

      {/* Recordings — last 6 months */}
      <section className="mt-10 grid grid-cols-12 gap-10" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 32 }}>
        <div className="col-span-3">
          <V2Caps>RECORDINGS</V2Caps>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>Across all members. Last six months.</p>
          <p className="mt-5" style={{ fontFamily: v2Serif, fontSize: 18, color: v2.ink, fontStyle: 'italic' }}>+41% MoM.</p>
        </div>
        <div className="col-span-9">
          <div className="flex items-end gap-5" style={{ height: 220 }}>
            {months.map((mo, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <V2Mono style={{ fontSize: 11, color: v2.ink, marginBottom: 6 }}>{mo.n}</V2Mono>
                <div style={{
                  width: '100%',
                  height: `${(mo.n / max) * 100}%`,
                  background: i === months.length - 1 ? v2.accent : v2.inkSoft,
                  borderRadius: '2px 2px 0 0',
                  transition: 'all 0.3s ease',
                }} />
                <V2Caps>{mo.m}</V2Caps>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Per-member scribbles this month */}
      <section className="mt-12 grid grid-cols-12 gap-10" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 32 }}>
        <div className="col-span-3">
          <V2Caps>BY MEMBER · MAY</V2Caps>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: v2.inkSoft }}>Scribbles created this month. Members who never recorded are hidden.</p>
        </div>
        <div className="col-span-9 space-y-3">
          {members.map((m, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="flex items-center gap-3" style={{ width: 200 }}>
                <V2Avatar size={26} />
                <span style={{ fontSize: 14, color: v2.ink }}>{m.n}</span>
              </div>
              <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: v2.rule }}>
                <div style={{ height: '100%', width: `${(m.c / memberMax) * 100}%`, background: v2.accent }} />
              </div>
              <V2Mono style={{ fontSize: 12, color: v2.ink, width: 36, textAlign: 'right' }}>{m.c}</V2Mono>
              <V2Caps>{m.c >= 20 ? 'HEAVY' : m.c >= 10 ? 'STEADY' : 'LIGHT'}</V2Caps>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 grid grid-cols-12 gap-10" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 32 }}>
        <div className="col-span-3"><V2Caps>EXPORT</V2Caps></div>
        <div className="col-span-9 flex items-center gap-3">
          <button className="text-[12px] rounded-full px-4 py-2" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Download CSV</button>
          <button className="text-[12px] rounded-full px-4 py-2" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Email weekly digest</button>
          <V2Mono style={{ fontSize: 11, color: v2.inkFaint, marginLeft: 'auto' }}>route · /settings/organization/analytics</V2Mono>
        </div>
      </section>
    </V2OrgSettingsShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · ORG AUDIT LOG — every share / unshare on workspace content
// ═══════════════════════════════════════════════════════════════════════════
function V2WebOrgAudit() {
  const rows = [
    { dt: 'MAY 21 · 14:08', actor: 'Mira Patel',    action: 'shared',   kind: 'scribble', title: 'Scribble editor — mode toolbar spec' },
    { dt: 'MAY 21 · 13:42', actor: 'Souvik Deb',    action: 'shared',   kind: 'meeting',  title: 'Standup · north stars for the quarter' },
    { dt: 'MAY 21 · 11:00', actor: 'Roshni Jha',    action: 'shared',   kind: 'meeting',  title: 'Pricing review · Roshni × Souvik' },
    { dt: 'MAY 20 · 17:55', actor: 'Komal Ahire',   action: 'unshared', kind: 'scribble', title: 'Team plan spec — first draft' },
    { dt: 'MAY 20 · 16:14', actor: 'Komal Ahire',   action: 'shared',   kind: 'scribble', title: 'Team plan spec — first draft' },
    { dt: 'MAY 20 · 09:42', actor: 'Sanjna Panwar', action: 'shared',   kind: 'scribble', title: 'Brand voice guide v4' },
    { dt: 'MAY 19 · 18:01', actor: 'Mira Patel',    action: 'unshared', kind: 'scribble', title: 'Old onboarding copy (draft 2)' },
    { dt: 'MAY 19 · 12:18', actor: 'Souvik Deb',    action: 'shared',   kind: 'scribble', title: 'Two-tier pricing thoughts' },
    { dt: 'MAY 18 · 15:48', actor: 'Aniket Devkar', action: 'shared',   kind: 'meeting',  title: 'Vibe coding pair · refactor utils' },
    { dt: 'MAY 18 · 11:30', actor: 'Roshni Jha',    action: 'shared',   kind: 'meeting',  title: 'Pricing analytics — 30-day pull' },
    { dt: 'MAY 17 · 10:02', actor: 'Komal Ahire',   action: 'shared',   kind: 'scribble', title: 'Forward to legal — refund policy' },
  ];

  function KindGlyph({ kind }) {
    if (kind === 'meeting') {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="6" width="13" height="12" rx="1.5" stroke={v2.inkSoft} strokeWidth="1.4" />
          <path d="M16 10l5-3v10l-5-3" stroke={v2.inkSoft} strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      );
    }
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M5 4h11l3 3v13H5z" stroke={v2.inkSoft} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M8 10h8M8 14h8M8 18h5" stroke={v2.inkSoft} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <V2OrgSettingsShell
      active="audit"
      eyebrow="ORG SETTINGS · AUDIT LOG"
      title={<>Who shared <em style={{ fontStyle: 'italic', color: v2.accent }}>what</em>, and when.</>}
      lead="Every share / unshare action on Scribbles and Minutes inside NavGurukul · Product. Newest first. Owners and admins only."
    >
      <section className="flex items-center gap-3">
        {['ALL', 'SHARED · 9', 'UNSHARED · 2', 'SCRIBBLES · 8', 'MINUTES · 3'].map((p, i) => (
          <button key={i} className="text-[11px] rounded-full px-3.5 py-1.5" style={{
            border: `1px solid ${i === 0 ? v2.ink : v2.rule}`,
            color: i === 0 ? v2.cream : v2.inkSoft,
            background: i === 0 ? v2.ink : 'transparent',
            fontFamily: v2Mono, letterSpacing: '0.14em',
          }}>{p}</button>
        ))}
        <V2Mono style={{ fontSize: 11, color: v2.inkFaint, marginLeft: 'auto' }}>SHOWING 11 OF 248</V2Mono>
      </section>

      <ul className="mt-7 space-y-px" style={{ borderTop: `1px solid ${v2.rule}` }}>
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-12 gap-4 items-center py-4" style={{ borderBottom: `1px solid ${v2.rule}` }}>
            {/* time */}
            <V2Mono style={{ fontSize: 11, color: v2.ink, gridColumn: 'span 2 / span 2', letterSpacing: '0.06em' }}>{r.dt}</V2Mono>
            {/* actor */}
            <div className="col-span-3 flex items-center gap-2.5">
              <V2Avatar size={22} />
              <span style={{ fontSize: 13, color: v2.ink }}>{r.actor}</span>
            </div>
            {/* action */}
            <div className="col-span-1">
              <V2Mono style={{
                fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase',
                color: r.action === 'shared' ? v2.accent : '#8c2f25',
              }}>{r.action === 'shared' ? '↗ SHARED' : '↙ UNSHARED'}</V2Mono>
            </div>
            {/* target */}
            <div className="col-span-5 flex items-center gap-2.5 min-w-0">
              <KindGlyph kind={r.kind} />
              <span style={{ fontSize: 14, color: v2.ink, fontFamily: v2Serif, fontWeight: 500, letterSpacing: '-0.005em' }} className="truncate">{r.title}</span>
            </div>
            {/* open */}
            <div className="col-span-1 text-right">
              <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>open →</V2Mono>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-7 flex items-center justify-between">
        <V2Mono style={{ fontSize: 11, color: v2.inkFaint }}>Older events archive after 12 months.</V2Mono>
        <button className="text-[12px] rounded-full px-4 py-2" style={{ border: `1px solid ${v2.rule}`, color: v2.inkSoft }}>Load more →</button>
      </div>
    </V2OrgSettingsShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 · ORG BILLING — workspace plan, separate from personal billing
// ═══════════════════════════════════════════════════════════════════════════
function V2WebOrgBilling() {
  const used = 86;
  const limit = 100; // shared free quota across all members
  const pct = Math.min(100, Math.round((used / limit) * 100));

  return (
    <V2OrgSettingsShell
      active="billing"
      eyebrow="ORG SETTINGS · BILLING"
      title={<>The workspace plan, <em style={{ fontStyle: 'italic', color: v2.accent }}>not</em> yours.</>}
      lead="Plan and usage for NavGurukul · Product. Different from your personal Pro — workspace billing covers shared Minutes and the team feed."
    >
      {/* Plan card */}
      <section className="grid grid-cols-12 gap-10" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 32 }}>
        <div className="col-span-3"><V2Caps>CURRENT PLAN</V2Caps></div>
        <div className="col-span-9 rounded-lg p-7" style={{ background: v2.cream2, border: `1px solid ${v2.rule}` }}>
          <div className="flex items-start justify-between">
            <div>
              <V2Caps color={v2.inkFaint}>WORKSPACE · FREE</V2Caps>
              <div className="mt-2 flex items-baseline gap-3">
                <span style={{ fontFamily: v2Serif, fontSize: 48, fontWeight: 500, letterSpacing: '-0.025em' }}>₹0</span>
                <span style={{ fontSize: 13, color: v2.inkSoft }}>· 100 recordings / month, shared across 12 members</span>
              </div>
              <p className="mt-3 text-[13px]" style={{ color: v2.inkSoft, maxWidth: 460 }}>
                You’re on the free workspace plan. Members each have their own personal quota too — this is the shared pool for things saved <em>to</em> the workspace.
              </p>
            </div>
            <button className="text-[12px] rounded-full px-4 py-2 font-medium" style={{ background: v2.accent, color: v2.cream }}>Upgrade workspace →</button>
          </div>

          {/* usage bar */}
          <div className="mt-7">
            <div className="flex items-baseline justify-between mb-2.5">
              <V2Caps>SHARED USAGE · MAY</V2Caps>
              <V2Mono style={{ fontSize: 12, color: v2.ink }}>{used} / {limit} · {pct}%</V2Mono>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 8, background: v2.rule }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct > 80 ? v2.accent : v2.ink, transition: 'all 0.3s ease' }} />
            </div>
            <p className="mt-3 text-[12px]" style={{ color: pct > 80 ? v2.accent : v2.inkSoft }}>
              {pct > 80 ? `Within ${limit - used} of the cap. Heaviest contributor this month: Souvik (38).` : 'Plenty of headroom this month.'}
            </p>
          </div>
        </div>
      </section>

      {/* Pro option */}
      <section className="mt-10 grid grid-cols-12 gap-10" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 32 }}>
        <div className="col-span-3"><V2Caps>UPGRADE</V2Caps></div>
        <div className="col-span-9 rounded-lg p-7" style={{ background: v2.ink, color: v2.cream }}>
          <V2Caps color={v2.accentSoft}>WORKSPACE PRO · PER SEAT</V2Caps>
          <div className="mt-3 flex items-baseline gap-3">
            <span style={{ fontFamily: v2Serif, fontSize: 56, fontWeight: 500, letterSpacing: '-0.025em' }}>₹599</span>
            <span style={{ fontSize: 13, color: 'rgba(247,244,238,0.6)' }}>per seat · billed annually · 12 seats = ₹86,256/yr</span>
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-[14px]">
            {[
              'Unlimited shared Minutes',
              'Shared workspace vocabulary',
              'Posted Minutes → Slack / Notion',
              'Org-wide audit log',
              'Org-wide analytics',
              'SSO (coming soon)',
            ].map((f, i) => (
              <li key={i} className="flex items-start gap-2" style={{ color: v2.cream }}>
                <span style={{ color: v2.accent, fontFamily: v2Mono, fontSize: 12, marginTop: 4 }}>·</span>
                <span style={{ fontFamily: v2Serif, fontSize: 15 }}>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-7 flex items-center gap-3">
            <button className="text-[13px] rounded-full px-5 py-2.5 font-medium" style={{ background: v2.cream, color: v2.ink }}>Upgrade · 12 seats</button>
            <button className="text-[13px] rounded-full px-4 py-2.5" style={{ border: `1px solid rgba(247,244,238,0.25)`, color: 'rgba(247,244,238,0.85)' }}>Talk to us about volume →</button>
          </div>
        </div>
      </section>

      {/* Members & cost preview */}
      <section className="mt-10 grid grid-cols-12 gap-10" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 32 }}>
        <div className="col-span-3"><V2Caps>SEATS</V2Caps></div>
        <div className="col-span-9">
          <div className="flex items-center justify-between py-4" style={{ borderBottom: `1px solid ${v2.rule}` }}>
            <div>
              <div style={{ fontSize: 14, color: v2.ink }}>12 members in workspace</div>
              <V2Caps>3 ACTIVE · 9 LIGHT · 0 INACTIVE</V2Caps>
            </div>
            <V2Mono style={{ fontSize: 12, color: v2.ink }}>₹599 × 12 = ₹7,188 / mo</V2Mono>
          </div>
          <div className="flex items-center justify-between py-4" style={{ borderBottom: `1px solid ${v2.rule}` }}>
            <div>
              <div style={{ fontSize: 14, color: v2.ink }}>Annual save 20%</div>
              <V2Caps>BILLED ONCE A YEAR · NEXT RENEWAL JULY 14</V2Caps>
            </div>
            <V2Mono style={{ fontSize: 12, color: v2.accent }}>– ₹17,251 / yr</V2Mono>
          </div>
          <div className="flex items-baseline justify-between py-4">
            <V2Caps>EFFECTIVE / SEAT / YEAR</V2Caps>
            <span style={{ fontFamily: v2Serif, fontSize: 24, fontWeight: 500, letterSpacing: '-0.015em' }}>₹5,750</span>
          </div>
        </div>
      </section>

      {/* Invoices */}
      <section className="mt-10 grid grid-cols-12 gap-10" style={{ borderTop: `1px solid ${v2.rule}`, paddingTop: 32 }}>
        <div className="col-span-3"><V2Caps>WORKSPACE INVOICES</V2Caps></div>
        <div className="col-span-9">
          {[
            ['MAY 14, 2026', '₹0.00',     'Free · workspace'],
            ['APR 14, 2026', '₹0.00',     'Free · workspace'],
            ['MAR 14, 2026', '₹0.00',     'Free · workspace'],
          ].map(([d, amt, plan], i) => (
            <div key={i} className="grid grid-cols-12 gap-4 py-3 items-center" style={{ borderBottom: `1px solid ${v2.rule}` }}>
              <V2Mono style={{ fontSize: 12, color: v2.ink, gridColumn: 'span 3 / span 3' }}>{d}</V2Mono>
              <span className="col-span-3" style={{ fontSize: 14, color: v2.ink }}>{amt}</span>
              <span className="col-span-4 text-[12px]" style={{ color: v2.inkSoft }}>{plan}</span>
              <button className="col-span-2 text-[12px] text-right" style={{ color: v2.inkFaint }}>Download PDF →</button>
            </div>
          ))}
          <p className="mt-4 text-[12px]" style={{ color: v2.inkFaint }}>No charges yet — you’ll see invoices once the workspace upgrades to Pro.</p>
        </div>
      </section>
    </V2OrgSettingsShell>
  );
}

// ─── Exports ─────────────────────────────────────────────────────────────
Object.assign(window, {
  V2WebPostCallback,
  V2WebDownload,
  V2WebLegalTerms,
  V2WebLegalRefund,
  V2WebOrgAnalytics,
  V2WebOrgAudit,
  V2WebOrgBilling,
});
