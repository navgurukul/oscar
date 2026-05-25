import { V2LegalLayout } from "@/components/v2/V2LegalLayout";

const TOC = [
  "Your account",
  "Payment & billing",
  "Cancellation & refunds",
  "Fair use",
  "Your content",
  "Acceptable use",
  "Our IP",
  "AI-generated content",
  "Service availability",
  "Liability",
  "Termination",
  "Changes",
  "Governing law",
  "Questions",
];

export default function TermsPage() {
  return (
    <V2LegalLayout
      active="TERMS"
      eyebrow="LEGAL · TERMS OF SERVICE · LAST UPDATED FEB 22, 2026"
      title={
        <>
          The agreement, in <em style={{ fontStyle: "italic", color: "#b8623d" }}>plain English</em>.
        </>
      }
      lead={
        <>
          Thank you for using Oscar. By using Oscar in any way, you agree to these Terms. If you
          don&rsquo;t agree, please don&rsquo;t use it. There may be times we don&rsquo;t enforce a
          particular right — that doesn&rsquo;t mean we&rsquo;ve waived it.
        </>
      }
      toc={TOC}
    >
      <section id="your-account">
        <h2>Your account</h2>
        <p>
          You need an account to use Oscar. Provide accurate information and keep it up to date. You
          are responsible for the security of your account — do not share it. You must be of legal age
          to form a binding contract in your country, or have obtained your parent or guardian&rsquo;s
          permission. Minimum age 13.
        </p>
      </section>

      <section id="payment-billing">
        <h2>Payment &amp; billing</h2>
        <p>
          Subscriptions are billed in advance on a recurring basis. Prices are listed in INR and USD.
          By subscribing, you authorize recurring charges to your payment method. Your subscription
          renews automatically unless you cancel. We notify you at least 30 days before any price
          change.
        </p>
        <p>
          Upgrading from Free to Pro starts your billing cycle on the day of upgrade. Fees are
          exclusive of taxes; where required, we collect and remit on your behalf.
        </p>
      </section>

      <section id="cancellation-refunds">
        <h2>Cancellation &amp; refunds</h2>
        <p>
          Cancel anytime from settings. Access continues until the end of your current billing period.
          No partial refunds for mid-cycle cancellations. New subscriptions are eligible for a refund
          within 7 days. Technical issues may qualify for prorated refunds.
        </p>
      </section>

      <section id="fair-use">
        <h2>Fair use</h2>
        <p>
          Usage limits are enforced per tier. Excessive or abusive use may result in service
          limitations. We reserve the right to limit your account if usage exceeds typical patterns —
          we&rsquo;ll reach out first except where action is urgent. Commercial use requires a paid
          subscription.
        </p>
      </section>

      <section id="your-content">
        <h2>Your content</h2>
        <p>
          You own what you create. All voice recordings and Scribbles remain yours and are protected
          by applicable IP laws. By using Oscar, you grant us a limited license to process, store, and
          display your content solely to deliver the service.
        </p>
      </section>

      <section id="acceptable-use">
        <h2>Acceptable use</h2>
        <p>
          Use Oscar only for lawful purposes. Don&rsquo;t infringe IP, transmit harmful content,
          attempt to breach security, reverse-engineer the service, or upload malware. Don&rsquo;t
          resell or redistribute it.
        </p>
      </section>

      <section id="our-ip">
        <h2>Our IP</h2>
        <p>
          The service itself — software, features, designs — is owned by Oscar and protected by IP
          laws. You may not copy, modify, or distribute it without written permission.
        </p>
      </section>

      <section id="ai-generated-content">
        <h2>AI-generated content</h2>
        <p>
          AI formatting aims for clean, accurate Scribbles but isn&rsquo;t perfect. Review and verify
          before relying on AI-generated content. We don&rsquo;t guarantee complete accuracy.
        </p>
      </section>

      <section id="service-availability">
        <h2>Service availability</h2>
        <p>
          We work to keep Oscar reliable, but uninterrupted service isn&rsquo;t guaranteed. Maintenance
          is announced when possible. We&rsquo;re not liable for interruptions, including those caused
          by upstream providers.
        </p>
      </section>

      <section id="liability">
        <h2>Liability</h2>
        <p>
          Oscar is provided as-is. We&rsquo;re not liable for indirect or consequential damages — lost
          data, lost revenue, work disruption. If found liable, total liability is capped at amounts
          you paid us in the past 12 months. Keep your own backups of anything important.
        </p>
      </section>

      <section id="termination">
        <h2>Termination</h2>
        <p>
          We may suspend or terminate your account for violations of these Terms, fraudulent activity,
          legal requirements, or self-deletion requests. Where possible, we&rsquo;ll notify you first
          so you can retrieve your data.
        </p>
      </section>

      <section id="changes">
        <h2>Changes</h2>
        <p>
          We may update these Terms. Material changes are announced via email or in-app, and the date
          at the top is refreshed. Continuing to use Oscar after changes means you accept them.
        </p>
      </section>

      <section id="governing-law">
        <h2>Governing law</h2>
        <p>These Terms are governed by the laws of India. Disputes will be resolved in Indian courts.</p>
      </section>

      <section id="questions">
        <h2>Questions</h2>
        <p>
          Contact us through the settings page or at the contact information provided in our
          application.
        </p>
      </section>
    </V2LegalLayout>
  );
}
