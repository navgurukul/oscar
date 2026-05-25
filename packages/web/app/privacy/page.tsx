import { V2LegalLayout } from "@/components/v2/V2LegalLayout";

const TOC = [
  "What we collect",
  "Third-party services",
  "Use of information",
  "Retention, deletion, export",
  "Security",
  "Children",
  "Contact",
];

export default function PrivacyPolicyPage() {
  return (
    <V2LegalLayout
      active="PRIVACY"
      eyebrow="LEGAL · PRIVACY POLICY · LAST UPDATED FEB 22, 2026"
      title={
        <>
          What we <em style={{ fontStyle: "italic", color: "#b8623d" }}>do</em> with your voice.
        </>
      }
      lead={
        <>
          Oscar is a voice tool. We take that responsibility seriously. The short version:{" "}
          <strong>we keep what makes the product work, and nothing else</strong>.
        </>
      }
      toc={TOC}
    >
      <section id="what-we-collect">
        <h2>What we collect</h2>
        <ul>
          <li>
            <h3>Personal information</h3>
            <p>
              When you register, Oscar collects a valid email address and, if you sign in via Google or
              another OAuth provider, your name and profile picture as shared by that provider. We
              request only the minimum permissions needed.
            </p>
          </li>
          <li>
            <h3>Voice and content</h3>
            <p>
              When you record, audio is processed in real time to generate a transcript. Oscar does not
              permanently store audio recordings on our servers. The audio is discarded as soon as
              transcription is complete. Only the resulting text is saved to your account.
            </p>
          </li>
          <li>
            <h3>Payment</h3>
            <p>
              Oscar does not directly collect payment information. Payments are processed through
              Razorpay. Billing metadata (method type, address, amount) may be visible to Oscar via
              Razorpay&rsquo;s tools. Full card details are never stored on our servers.
            </p>
          </li>
          <li>
            <h3>Usage</h3>
            <p>
              Oscar collects basic usage data — recording count, duration, feature interactions — to
              understand how the product is used and improve it.
            </p>
          </li>
        </ul>
      </section>

      <section id="third-party-services">
        <h2>Third-party services</h2>
        <ul>
          <li>
            <h3>Google Gemini</h3>
            <p>
              For processing voice recordings and formatting the resulting text, Oscar uses the Google
              Gemini API. Transcribed text is transmitted to Google&rsquo;s servers during processing.
              On the paid tier, your data is not used to train Google&rsquo;s models.
            </p>
          </li>
          <li>
            <h3>Supabase</h3>
            <p>
              For authentication, database, and file storage, Oscar uses Supabase. Account data and
              Scribbles are stored on Supabase&rsquo;s servers, which encrypt data at rest.
            </p>
          </li>
          <li>
            <h3>Razorpay</h3>
            <p>
              For payment processing and subscription management, Oscar uses Razorpay. Their privacy
              policy governs how they handle your billing information.
            </p>
          </li>
          <li>
            <h3>Cookies and storage</h3>
            <p>
              Oscar sets cookies for authentication and essential platform functionality — a session ID,
              a signature to prevent tampering, and a user identifier. Local storage holds app
              preferences.
            </p>
          </li>
        </ul>
      </section>

      <section id="use-of-information">
        <h2>Use of information</h2>
        <p>
          The information collected is used solely to provide the services you have subscribed to and
          to improve your experience. We do not sell your personal data. We do not display
          advertisements. Non-essential communications can be opted out of at any time.
        </p>
      </section>

      <section id="retention-deletion-export">
        <h2>Retention, deletion, export</h2>
        <p>
          Scribbles you create stay until you delete them or close your account. Audio from recordings
          is discarded immediately after transcription — we do not retain audio files. Account deletion
          triggers a 30-day soft-delete, after which everything is purged from databases and backups.
        </p>
      </section>

      <section id="security">
        <h2>Security</h2>
        <p>
          We implement encryption at rest, secure authentication, and restricted access controls. In
          the event of a breach that materially affects your personal information, we will notify you
          promptly. No method of transmission over the Internet is 100% secure, but we work
          continuously to safeguard your data.
        </p>
      </section>

      <section id="children">
        <h2>Children</h2>
        <p>
          Our service is not intended for children under 13. We do not knowingly collect data from
          children under 13.
        </p>
      </section>

      <section id="contact">
        <h2>Contact</h2>
        <p>
          If you have questions about this Privacy Policy, contact us through the settings page or at
          the contact information provided in our application.
        </p>
      </section>
    </V2LegalLayout>
  );
}
