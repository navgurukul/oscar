export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen py-16 px-4 mt-16">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-gray-400">Last updated: February 22, 2026</p>
        </div>

        <div className="space-y-8 text-gray-300">
          <p className="mb-8 text-base leading-relaxed">
            Welcome to OSCAR (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your privacy. This Privacy Policy explains what is collected, how it is used, and with whom it is shared when you use our voice note application. It may be revised from time to time. We will notify you of any changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.
          </p>

          <section>
            <h2 className="text-2xl font-bold text-white mb-6">
              Information We Collect
            </h2>
            
            <ul className="space-y-5 list-disc pl-6">
              <li className="mb-4">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Personal Information
                </h3>
                <p className="ml-6 text-base leading-relaxed">
                  When you register, OSCAR only collects a valid email address and, if you sign in via Google or another OAuth provider, your name and profile picture as shared by that provider. We request only the minimum permissions needed — your name and email address.
                </p>
              </li>

              <li className="mb-4">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Voice and Content Data
                </h3>
                <p className="ml-6 text-base leading-relaxed">
                  When you record a voice note, your audio is processed in real-time to generate a text transcription. OSCAR does not permanently store your audio recordings on our servers. The audio is discarded as soon as transcription is complete. Only the resulting transcribed and formatted text is saved to your account.
                </p>
              </li>

              <li className="mb-4">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Payment Information
                </h3>
                <p className="ml-6 text-base leading-relaxed">
                  OSCAR does not directly collect payment information. Payments are processed through Razorpay (www.razorpay.com). As a result of this integration, some billing details such as your payment method type, billing address, and transaction amount may be visible to OSCAR through Razorpay&apos;s tools. Your full card details are never stored on our servers.
                </p>
              </li>

              <li>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Usage Data
                </h3>
                <p className="ml-6 text-base leading-relaxed">
                  OSCAR also collects basic usage data such as recording count, duration, and feature interactions. This helps us understand how the product is being used and improve it over time.
                </p>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-6">
              Third-Party Services
            </h2>
            
            <ul className="space-y-5 list-disc pl-6">
              <li className="mb-4">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Groq
                </h3>
                <p className="ml-6 text-base leading-relaxed">
                  For processing your voice recordings and formatting the resulting text, OSCAR uses APIs provided by Groq. As a result, your transcribed text is transmitted to Groq&apos;s servers during processing. Groq is a US-based company providing fast AI inference. Your data is not used to train their models. Further information can be found on the Groq website. By using OSCAR, you consent to this transfer.
                </p>
              </li>

              <li className="mb-4">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Supabase
                </h3>
                <p className="ml-6 text-base leading-relaxed">
                  For authentication, database, and file storage, OSCAR uses Supabase (www.supabase.com). Your account data and notes are stored on Supabase&apos;s servers, which encrypt data at rest.
                </p>
              </li>

              <li className="mb-4">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Razorpay
                </h3>
                <p className="ml-6 text-base leading-relaxed">
                  For payment processing and subscription management, OSCAR uses Razorpay (www.razorpay.com). Their privacy policy governs how they handle your billing information.
                </p>
              </li>

              <li>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Cookies and Storage
                </h3>
                <p className="ml-6 text-base leading-relaxed">
                  OSCAR sets cookies for authentication purposes and to enable essential platform functionality — specifically a session ID cookie, a session signature cookie to prevent tampering, and a cookie to identify the current logged-in user. OSCAR also uses browser local storage to save your app preferences.
                </p>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-6">
              Use of Information
            </h2>
            <p className="text-base leading-relaxed">
              The information collected is used solely to provide you the services you have subscribed to on OSCAR and to continually improve your experience. We do not sell your personal data to third parties. We do not display advertisements. If we send you any non-essential communications, you may opt out at any time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-6">
              Data Retention, Deletion, and Export
            </h2>
            
            <div className="space-y-4">
              <p className="text-base leading-relaxed">
                All notes created by you and stored on our servers will be retained for as long as your account remains active. Audio from your recordings is automatically discarded from our servers immediately after transcription — we do not retain your audio files.
              </p>
              
              <p className="text-base leading-relaxed">
                All content you create on OSCAR is private and not visible to other users. However, data stored on our servers is accessible to OSCAR&apos;s operators for the purposes of support and service maintenance.
              </p>
              
              <p className="text-base leading-relaxed">
                If you would like to export your notes and data, you can do so from the settings page of your account.
              </p>
              
              <p className="text-base leading-relaxed">
                If you would like to delete your account and associated data, you can do so from your account settings.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-6">
              Security
            </h2>
            <p className="text-base leading-relaxed">
              We implement appropriate technical and organizational measures to protect your data, including encryption at rest, secure authentication, and restricted access controls. In the event of a data breach that materially affects your personal information, we will notify you promptly. No method of transmission over the Internet is 100% secure, but we take your data seriously and work continuously to safeguard it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-6">
              Children&apos;s Privacy
            </h2>
            <p className="text-base leading-relaxed">
              Our service is not intended for children under 13. We do not knowingly collect data from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-6">
              Contact Us
            </h2>
            <p className="text-base leading-relaxed">
              If you have questions about this Privacy Policy, please contact us through the settings page or at the contact information provided in our application.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
