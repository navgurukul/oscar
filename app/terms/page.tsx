export default function TermsPage() {
  return (
    <main className="min-h-screen py-16 px-4 mt-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
          Terms of Service
        </h1>
        <p className="text-gray-400 mb-8">Last updated: February 22, 2025</p>

        <div className="space-y-8 text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using OSCAR (&quot;the Service&quot;), you agree
              to be bound by these Terms of Service (&quot;Terms&quot;). If you
              do not agree to these Terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              2. Description of Service
            </h2>
            <p>
              OSCAR is a voice note application that uses AI to convert voice
              recordings into formatted, organized text notes. The Service
              includes:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Voice recording and transcription</li>
              <li>AI-powered text formatting and organization</li>
              <li>Note management and storage</li>
              <li>Translation and format transformation features</li>
              <li>Custom vocabulary management</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              3. Account Registration
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>You must create an account to use the Service</li>
              <li>You must provide accurate and complete information</li>
              <li>You are responsible for maintaining account security</li>
              <li>You must be at least 13 years old to use the Service</li>
              <li>One account per user; no account sharing</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              4. Subscription Plans and Pricing
            </h2>
            <h3 className="text-xl font-semibold text-white mb-3">
              4.1 Free Plan
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>5 recordings per month</li>
              <li>10 saved notes maximum</li>
              <li>10 vocabulary entries maximum</li>
              <li>Standard AI processing</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-4">
              4.2 Pro Plan
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Unlimited recordings</li>
              <li>Unlimited saved notes</li>
              <li>Unlimited vocabulary entries</li>
              <li>Priority AI processing</li>
              <li>Priority customer support</li>
              <li>Available as monthly or yearly subscription</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-4">
              4.3 Payment Terms
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Subscriptions are billed in advance on a recurring basis</li>
              <li>Prices are listed in INR and USD</li>
              <li>You authorize recurring charges to your payment method</li>
              <li>Subscription automatically renews unless cancelled</li>
              <li>Price changes will be notified 30 days in advance</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              5. Usage Limits and Fair Use
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Usage limits are enforced based on your subscription tier</li>
              <li>
                Excessive or abusive use may result in service limitations
              </li>
              <li>
                We reserve the right to implement additional fair use policies
              </li>
              <li>Commercial use requires a Pro subscription</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              6. Cancellation and Refunds
            </h2>
            <h3 className="text-xl font-semibold text-white mb-3">
              6.1 Cancellation
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>You may cancel your subscription at any time</li>
              <li>
                Cancellation takes effect at the end of your current billing
                period
              </li>
              <li>You retain access until the period end date</li>
              <li>No partial month refunds for mid-cycle cancellations</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-4">
              6.2 Refunds
            </h3>
            <p className="mb-3">
              See our Refund Policy for detailed information. Summary:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>7-day refund window for new subscriptions</li>
              <li>Technical issues may qualify for prorated refunds</li>
              <li>Refund requests must be submitted through proper channels</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              7. Acceptable Use Policy
            </h2>
            <p className="mb-4">You agree NOT to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the Service for illegal purposes</li>
              <li>Violate any laws or regulations</li>
              <li>Infringe on intellectual property rights</li>
              <li>Transmit harmful, offensive, or inappropriate content</li>
              <li>
                Attempt to breach security or access others&apos; accounts
              </li>
              <li>Reverse engineer or copy the Service</li>
              <li>Use automated tools to abuse the Service</li>
              <li>Resell or redistribute the Service</li>
              <li>Upload malware or malicious code</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              8. Intellectual Property Rights
            </h2>
            <h3 className="text-xl font-semibold text-white mb-3">
              8.1 Your Content
            </h3>
            <p>
              You retain all rights to your voice recordings and notes. By using
              the Service, you grant us a license to process, store, and display
              your content solely to provide the Service.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3 mt-4">
              8.2 Our Rights
            </h3>
            <p>
              The Service, including all software, features, and designs, is
              owned by OSCAR and protected by intellectual property laws. You
              may not copy, modify, or distribute our intellectual property.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              9. AI-Generated Content Disclaimer
            </h2>
            <p>
              Our AI formatting service aims to improve your notes but may
              occasionally produce errors. You are responsible for reviewing and
              verifying all AI-generated content. We do not guarantee perfect
              accuracy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              10. Service Availability
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                We strive for high availability but do not guarantee
                uninterrupted service
              </li>
              <li>Scheduled maintenance will be announced when possible</li>
              <li>We are not liable for service interruptions</li>
              <li>Third-party service outages may affect functionality</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              11. Limitation of Liability
            </h2>
            <p className="mb-4">TO THE MAXIMUM EXTENT PERMITTED BY LAW:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                The Service is provided &quot;AS IS&quot; without warranties
              </li>
              <li>
                We are not liable for indirect, incidental, or consequential
                damages
              </li>
              <li>
                Our total liability is limited to the amount you paid in the
                past 12 months
              </li>
              <li>We are not responsible for data loss (maintain backups)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              12. Indemnification
            </h2>
            <p>
              You agree to indemnify and hold OSCAR harmless from any claims,
              damages, or expenses arising from your use of the Service or
              violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              13. Account Termination
            </h2>
            <p className="mb-4">We may suspend or terminate your account if:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You violate these Terms</li>
              <li>Your account is used for fraudulent activity</li>
              <li>Required by law</li>
              <li>You request account deletion</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              14. Changes to Terms
            </h2>
            <p>
              We may modify these Terms at any time. Material changes will be
              notified via email or in-app notification. Continued use after
              changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              15. Governing Law
            </h2>
            <p>
              These Terms are governed by the laws of India. Disputes will be
              resolved in the courts of [Your Jurisdiction].
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              16. Contact Information
            </h2>
            <p>
              For questions about these Terms, please contact us through the
              settings page or at the contact information provided in our
              application.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              17. Severability
            </h2>
            <p>
              If any provision of these Terms is found to be unenforceable, the
              remaining provisions will continue in full effect.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
