const Privacy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">&larr; Back to StyleOS</a>
        <h1 className="text-3xl font-bold mt-6 mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: April 9, 2026</p>

        <div className="space-y-8 leading-relaxed text-foreground/90">
          <p>
            This Privacy Policy explains how StyleOS ("we," "us," or "our") collects, uses, and protects your information when you use the StyleOS application and website (the "Service"). By using the Service you agree to this policy.
          </p>

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
            <p className="mb-3"><strong>Account information.</strong> When you create an account we collect your email address and any profile information you choose to provide. Authentication is provided by Supabase.</p>
            <p className="mb-3"><strong>Body measurement data.</strong> To generate personalized sizing and styling recommendations, the Service captures body measurements derived from photos you take with your device camera. These measurements are stored against your account.</p>
            <p className="mb-3"><strong>Clothing images.</strong> You may upload photos of clothing items into your digital closet. These images are used to power virtual try-on, outfit recommendations, and styling features.</p>
            <p className="mb-3"><strong>Virtual try-on images.</strong> When you use the virtual try-on feature, full-body photos and clothing images are processed to generate try-on previews.</p>
            <p><strong>Usage data.</strong> We may collect anonymized data about how you interact with the Service (features used, errors encountered) to improve product quality.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Camera and Photo Library Access</h2>
            <p className="mb-3">StyleOS requests permission to access your device's camera and photo library:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Camera</strong> â used to capture body measurement photos and clothing item photos.</li>
              <li><strong>Photo Library</strong> â used to import existing clothing item images into your digital closet.</li>
            </ul>
            <p className="mt-3">You can revoke either permission at any time in your device's system settings. Revoking permissions may limit certain features of the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide and maintain the Service</li>
              <li>To generate personalized outfit recommendations and virtual try-on previews</li>
              <li>To save your digital wardrobe and lookbook entries</li>
              <li>To improve the Service and develop new features</li>
              <li>To communicate with you about your account or service updates</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Third-Party Services</h2>
            <p className="mb-3">StyleOS relies on the following third-party services to operate:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Supabase</strong> (database and authentication) â stores your account, wardrobe items, and lookbook data.</li>
              <li><strong>Google Cloud Vertex AI</strong> (virtual try-on) â processes body and clothing images to generate try-on previews. Images sent for processing are subject to Google's data handling policies.</li>
              <li><strong>Vercel</strong> (hosting) â serves the application.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Sharing</h2>
            <p>We do not sell your personal data. We share data only with the third-party services listed above, and only as necessary to provide the Service. We may disclose information if required by law or to protect our legal rights.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
            <p>We retain your account data, wardrobe images, and lookbook entries for as long as your account is active. You can delete individual items at any time from within the app. To request full account deletion, contact us at the email below.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Children's Privacy</h2>
            <p>StyleOS is not intended for children under 13. We do not knowingly collect information from children under 13. If we learn that we have collected information from a child under 13, we will delete it.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Your Rights</h2>
            <p className="mb-3">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction or deletion of your data</li>
              <li>Object to or restrict certain processing</li>
              <li>Withdraw consent where consent is the legal basis for processing</li>
              <li>Lodge a complaint with a data protection authority</li>
            </ul>
            <p className="mt-3">To exercise these rights, contact us at the email below.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Security</h2>
            <p>We use industry-standard measures to protect your data, including encryption in transit (HTTPS) and authentication via Supabase. However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Changes To This Policy</h2>
            <p>We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated "Last updated" date.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
            <p>If you have questions about this Privacy Policy or how your data is handled, please contact us at:</p>
            <p className="mt-3">
              StyleOS<br />
              Email: <a href="mailto:omdevsoni@gofynd.com" className="text-primary hover:underline">omdevsoni@gofynd.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
