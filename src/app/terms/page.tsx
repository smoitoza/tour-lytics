import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service | TourLytics',
  description: 'TourLytics Terms of Service - AI-powered commercial real estate intelligence platform.',
}

export default function TermsPage() {
  return (
    <div className="legal-page">
      <style>{`
        .legal-page {
          min-height: 100vh;
          background: #0a0f1a;
          color: #e2e8f0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .legal-nav {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 900px;
          margin: 0 auto;
        }
        .legal-nav a {
          color: #94a3b8;
          text-decoration: none;
          font-size: 0.875rem;
          transition: color 0.2s;
        }
        .legal-nav a:hover { color: #38bdf8; }
        .legal-brand {
          font-weight: 700;
          font-size: 1.1rem;
          color: #f1f5f9 !important;
          letter-spacing: -0.02em;
        }
        .legal-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 3rem 1.5rem 4rem;
        }
        .legal-title {
          font-size: 2rem;
          font-weight: 700;
          color: #f1f5f9;
          margin-bottom: 0.5rem;
          letter-spacing: -0.02em;
        }
        .legal-subtitle {
          font-size: 0.875rem;
          color: #64748b;
          margin-bottom: 2rem;
        }
        .legal-toc {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 2.5rem;
        }
        .legal-toc-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.75rem;
        }
        .legal-toc a {
          display: block;
          color: #94a3b8;
          text-decoration: none;
          font-size: 0.8125rem;
          padding: 0.25rem 0;
          transition: color 0.2s;
        }
        .legal-toc a:hover { color: #38bdf8; }
        .legal-h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #f1f5f9;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(255,255,255,0.06);
          letter-spacing: -0.01em;
        }
        .legal-h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #cbd5e1;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .legal-p {
          font-size: 0.875rem;
          line-height: 1.7;
          color: #94a3b8;
          margin-bottom: 0.75rem;
        }
        .legal-caps {
          font-size: 0.8125rem;
          line-height: 1.6;
          color: #94a3b8;
          margin-bottom: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.01em;
        }
        .legal-indent {
          font-size: 0.875rem;
          line-height: 1.7;
          color: #94a3b8;
          margin-bottom: 0.5rem;
          padding-left: 1.5rem;
        }
        .legal-list {
          list-style: disc;
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .legal-list li {
          font-size: 0.875rem;
          line-height: 1.7;
          color: #94a3b8;
          margin-bottom: 0.25rem;
        }
        .legal-footer {
          padding: 2rem 0;
          border-top: 1px solid rgba(255,255,255,0.06);
          margin-top: 3rem;
        }
        .legal-footer-inner {
          max-width: 800px;
          margin: 0 auto;
          padding: 0 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .legal-footer a {
          color: #64748b;
          text-decoration: none;
          font-size: 0.75rem;
          transition: color 0.2s;
        }
        .legal-footer a:hover { color: #94a3b8; }
        @media (max-width: 640px) {
          .legal-title { font-size: 1.5rem; }
          .legal-container { padding: 2rem 1rem 3rem; }
        }
      `}</style>

      <nav className="legal-nav">
        <Link href="/" className="legal-brand">TourLytics</Link>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/login">Sign In</Link>
        </div>
      </nav>

      <div className="legal-container">
        <h1 className="legal-title">Terms of Service</h1>
        <p className="legal-subtitle">Effective March 18, 2026 &middot; Chewerlytics LLC (d/b/a &quot;TourLytics&quot;)</p>


        <div className="legal-toc">
          <div className="legal-toc-title">Table of Contents</div>
          <a href="#s1">1. Definitions</a>
          <a href="#s2">2. Account Registration and Access</a>
          <a href="#s3">3. License Grant and Restrictions</a>
          <a href="#s4">4. Customer Data and Content</a>
          <a href="#s5">5. AI-Powered Features -- Important Disclaimers</a>
          <a href="#s6">6. Token-Based Billing and Payments</a>
          <a href="#s7">7. Intellectual Property</a>
          <a href="#s8">8. Confidentiality</a>
          <a href="#s9">9. Warranty Disclaimers</a>
          <a href="#s10">10. Limitation of Liability</a>
          <a href="#s11">11. Indemnification</a>
          <a href="#s12">12. Data Security</a>
          <a href="#s13">13. Term and Termination</a>
          <a href="#s14">14. Acceptable Use Policy</a>
          <a href="#s15">15. Third-Party Services</a>
          <a href="#s16">16. Governing Law and Dispute Resolution</a>
          <a href="#s17">17. Changes to Terms</a>
          <a href="#s18">18. Miscellaneous</a>
          <a href="#s19">19. Contact Information</a>
        </div>

        <h2 className="legal-h2">KEY TERMS SUMMARY</h2>
            <p className="legal-p">This summary is provided for convenience only and does not form part of the legally binding Terms of Service. In the event of any conflict between this summary and the full Terms below, the full Terms shall control.</p>
            <p className="legal-p">What is TourLytics? TourLytics is an AI-powered commercial real estate intelligence platform that helps enterprise CRE teams process broker survey documents, visualize properties on interactive maps, generate tour books, perform financial modeling, and conduct commute studies.</p>
            <p className="legal-p">Who operates TourLytics? TourLytics is operated by Chewerlytics LLC, a California limited liability company doing business as &quot;TourLytics.&quot;</p>
            <p className="legal-p">Your Data Stays Yours. You retain full ownership of all documents, data, and content you upload to the Platform. We only use your data to provide the Service and will not use it to train AI models or share it with third parties.</p>
            <p className="legal-p">AI Outputs Are Not Guaranteed. All AI-generated content -- including parsed building data, financial models, commute studies, and chatbot responses -- is generated by third-party AI models and may contain errors. You must independently verify all outputs before relying on them. TourLytics is not a real estate broker, appraiser, or financial advisor.</p>
            <p className="legal-p">Token-Based Billing. AI actions on the Platform consume tokens. Project Owners are responsible for all token usage within their projects, including usage by invited team members. Consumed tokens are non-refundable.</p>
            <p className="legal-p">Limitation of Liability. Our total liability is capped at the fees you paid us in the twelve (12) months preceding a claim. We are not liable for indirect, consequential, or special damages.</p>
            <p className="legal-p">Arbitration. Disputes are resolved through binding individual arbitration in Santa Barbara County, California, not through court litigation. You waive the right to participate in class actions. You may opt out of arbitration within thirty (30) days of accepting these Terms.</p>
            <p className="legal-p">Governing Law. These Terms are governed by the laws of the State of California.</p>
            <h2 className="legal-h2">1. DEFINITIONS</h2>
            <p className="legal-p">As used in these Terms of Service (&quot;Terms&quot; or &quot;Agreement&quot;), the following terms shall have the meanings set forth below:</p>
            <p className="legal-p">&quot;Affiliate&quot; means any entity that directly or indirectly controls, is controlled by, or is under common control with a party, where &quot;control&quot; means ownership of fifty percent (50%) or more of the voting securities or equivalent ownership interest.</p>
            <p className="legal-p">&quot;AI Features&quot; means all features of the Platform that utilize artificial intelligence or machine learning technologies, including but not limited to document parsing, data extraction, financial modeling, commute analysis, geocoding, and the AI chatbot assistant.</p>
            <p className="legal-p">&quot;Authorized User&quot; means any individual who is authorized by a Customer to access and use the Platform under the Customer&#x27;s account, including team members assigned roles within a Project.</p>
            <p className="legal-p">&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot; means Chewerlytics LLC, a California limited liability company doing business as &quot;TourLytics,&quot; with its principal place of business in the State of California.</p>
            <p className="legal-p">&quot;Confidential Information&quot; means any information disclosed by one party to the other, whether orally, in writing, or electronically, that is designated as confidential, or that a reasonable person would understand to be confidential given the nature of the information and the circumstances of disclosure.</p>
            <p className="legal-p">&quot;Customer,&quot; &quot;you,&quot; or &quot;your&quot; means the individual or legal entity that registers for an account on the Platform and agrees to be bound by these Terms.</p>
            <p className="legal-p">&quot;Customer Content&quot; means all content, data, text, images, annotations, shortlists, tour book configurations, and other materials created by Customer or Authorized Users within the Platform.</p>
            <p className="legal-p">&quot;Customer Data&quot; means all documents, files, data, and information uploaded to the Platform by Customer or any Authorized User, including but not limited to broker survey PDFs, requests for proposals (RFPs), letters of intent (LOIs), financial documents, and any other proprietary materials.</p>
            <p className="legal-p">&quot;Documentation&quot; means the user guides, help documentation, API documentation, tutorials, and other instructional materials made available by Company in connection with the Platform.</p>
            <p className="legal-p">&quot;Order Form&quot; means any ordering document, statement of work, or subscription agreement executed by the parties that references these Terms and specifies the particular Services, pricing, and other commercial terms applicable to an enterprise Customer.</p>
            <p className="legal-p">&quot;Output&quot; means all data, content, analyses, reports, maps, tour books, financial models, commute studies, chatbot responses, and other materials generated by the Platform&#x27;s AI Features in response to Customer Data or Customer Content.</p>
            <p className="legal-p">&quot;Platform&quot; or &quot;Service&quot; means the TourLytics software-as-a-service platform accessible at tour-lytics.com and/or tourlytics.ai, including all related tools, features, APIs, mobile applications, and updates thereto.</p>
            <p className="legal-p">&quot;Project&quot; means a discrete workspace within the Platform created by a Customer, to which Authorized Users may be invited and within which Customer Data is uploaded and processed.</p>
            <p className="legal-p">&quot;Project Owner&quot; means the Customer or Authorized User who creates a Project and bears financial responsibility for all Token consumption and usage fees within that Project.</p>
            <p className="legal-p">&quot;Third-Party Services&quot; means the third-party software, APIs, and services integrated with or used by the Platform, including but not limited to Google Gemini (AI processing), Google Maps (geocoding and mapping), Supabase (database and authentication), Stripe (payment processing), and Vercel (hosting).</p>
            <p className="legal-p">&quot;Tokens&quot; means the unit of value used to access AI Features on the Platform, where one (1) Token equals one U.S. dollar ($1.00) in value. Tokens are consumed when Authorized Users perform AI-powered actions within a Project.</p>
            <h2 className="legal-h2">2. ACCOUNT REGISTRATION AND ACCESS</h2>
            <h3 className="legal-h3">2.1 Eligibility</h3>
            <p className="legal-p">You must be at least eighteen (18) years of age to use the Platform. By registering for an account, you represent and warrant that: (a) you are at least eighteen (18) years of age; (b) you have the legal capacity and authority to enter into a binding agreement; and (c) if you are accepting these Terms on behalf of an organization, you have the authority to bind that organization to these Terms.</p>
            <h3 className="legal-h3">2.2 Account Registration</h3>
            <p className="legal-p">To access the Platform, you must create an account by providing accurate, current, and complete registration information. You agree to promptly update your account information to keep it accurate, current, and complete. Company reserves the right to suspend or terminate any account where the registration information is found to be inaccurate or fraudulent.</p>
            <h3 className="legal-h3">2.3 Account Security</h3>
            <p className="legal-p">You are responsible for maintaining the confidentiality of your account credentials, including your password and any authentication tokens. You agree to: (a) immediately notify Company of any unauthorized use of your account or any other breach of security; (b) ensure that you log out from your account at the end of each session; and (c) not share your account credentials with any third party. Company shall not be liable for any loss or damage arising from your failure to protect your account credentials.</p>
            <h3 className="legal-h3">2.4 Role-Based Access and Project Owner Responsibilities</h3>
            <p className="legal-p">The Platform employs a role-based access control system with the following hierarchy: Owner, Admin, Member, and Viewer. Each role carries different permissions and capabilities within a Project. The Project Owner is responsible for:</p>
            <p className="legal-indent">(a) Managing and overseeing all Authorized User access within their Project(s);</p>
            <p className="legal-indent">(b) All Token consumption and associated fees incurred by Authorized Users within their Project(s);</p>
            <p className="legal-indent">(c) Ensuring that all Authorized Users comply with these Terms;</p>
            <p className="legal-indent">(d) Revoking access for any Authorized User who violates these Terms or who is no longer authorized to access the Project; and</p>
            <p className="legal-indent">(e) All actions taken by Authorized Users within their Project(s), regardless of whether such actions were authorized by the Project Owner.</p>
            <h2 className="legal-h2">3. LICENSE GRANT AND RESTRICTIONS</h2>
            <h3 className="legal-h3">3.1 License Grant</h3>
            <p className="legal-p">Subject to your compliance with these Terms and payment of all applicable fees, Company hereby grants you a limited, non-exclusive, non-transferable, non-sublicensable, revocable license to access and use the Platform solely for your internal business purposes during the term of these Terms. For enterprise Customers, the scope of the license shall be as specified in the applicable Order Form.</p>
            <h3 className="legal-h3">3.2 Restrictions</h3>
            <p className="legal-p">Except as expressly permitted under these Terms or in an applicable Order Form, you shall not, and shall not permit any Authorized User or third party to:</p>
            <p className="legal-indent">(a) Copy, modify, adapt, translate, or create derivative works based on the Platform or any component thereof;</p>
            <p className="legal-indent">(b) Reverse engineer, disassemble, decompile, or otherwise attempt to derive the source code, algorithms, data models, or underlying ideas of the Platform;</p>
            <p className="legal-indent">(c) Sublicense, sell, resell, lease, rent, loan, distribute, or otherwise make the Platform or any Output available to any third party, except as expressly permitted herein;</p>
            <p className="legal-indent">(d) Use the Platform or any Output to build, train, or improve a competing product, service, or database, whether directly or indirectly;</p>
            <p className="legal-indent">(e) Systematically download, collect, aggregate, or compile Output or data from the Platform to create or augment any database, directory, or data set for resale, redistribution, or competitive purposes;</p>
            <p className="legal-indent">(f) Use any automated means, including bots, web crawlers, spiders, or other automated tools, to access, monitor, or copy any content or data from the Platform;</p>
            <p className="legal-indent">(g) Remove, obscure, or alter any proprietary notices, labels, or marks on the Platform or any Output;</p>
            <p className="legal-indent">(h) Use the Platform in violation of any applicable law, regulation, or third-party right;</p>
            <p className="legal-indent">(i) Circumvent, disable, or interfere with any security, access control, or technical protection measures of the Platform;</p>
            <p className="legal-indent">(j) Access the Platform for the purpose of benchmarking or competitive analysis without Company&#x27;s prior written consent; or</p>
            <p className="legal-indent">(k) Redistribute, republish, or commercially exploit any Output, including but not limited to parsed building data, geocoded locations, financial models, or commute analyses, as a standalone data product or service.</p>
            <h3 className="legal-h3">3.3 Reservation of Rights</h3>
            <p className="legal-p">Company reserves all rights not expressly granted to you in these Terms. No implied licenses are granted by these Terms. The Platform is licensed, not sold.</p>
            <h2 className="legal-h2">4. CUSTOMER DATA AND CONTENT</h2>
            <h3 className="legal-h3">4.1 Ownership of Customer Data</h3>
            <p className="legal-p">As between the parties, Customer retains all right, title, and interest in and to Customer Data and Customer Content. Nothing in these Terms shall be construed to transfer any ownership rights in Customer Data or Customer Content to Company.</p>
            <h3 className="legal-h3">4.2 License to Customer Data</h3>
            <p className="legal-p">Customer hereby grants Company a limited, non-exclusive, non-transferable, royalty-free license to access, use, process, transmit, and store Customer Data solely to the extent necessary to provide, maintain, and improve the Service in accordance with these Terms. This license terminates upon the expiration or termination of these Terms, subject to Section 13.5 (Effect of Termination).</p>
            <h3 className="legal-h3">4.3 No Use for AI Training</h3>
            <p className="legal-p">Company will not use Customer Data or Customer Content to train, fine-tune, or improve any artificial intelligence or machine learning models, whether owned by Company or any third party. Company will not share Customer Data with any third party except as strictly necessary to provide the Service (e.g., transmitting document content to AI processing services for the sole purpose of generating Output at Customer&#x27;s direction) or as required by applicable law.</p>
            <h3 className="legal-h3">4.4 Customer Representations Regarding Data</h3>
            <p className="legal-p">Customer represents and warrants that: (a) Customer has all necessary rights, licenses, consents, and permissions to upload, transmit, and process Customer Data on the Platform; (b) Customer Data does not infringe, misappropriate, or violate the intellectual property rights, privacy rights, or any other rights of any third party; and (c) Customer has obtained all necessary authorizations to share any proprietary market data, broker surveys, or other third-party materials that Customer uploads to the Platform.</p>
            <h3 className="legal-h3">4.5 Data Retention and Deletion</h3>
            <p className="legal-p">Company will retain Customer Data for the duration of the active subscription or account term. Upon termination of your account, Company will retain Customer Data for a period of thirty (30) days to allow Customer to export such data (the &quot;Export Period&quot;). Following the Export Period, Company will delete Customer Data from its active systems within a commercially reasonable timeframe, except where retention is required by applicable law or regulation. Notwithstanding the foregoing, copies of Customer Data may persist in backups or disaster recovery systems for up to ninety (90) days following deletion from active systems, after which they will be permanently purged.</p>
            <h3 className="legal-h3">4.6 Customer Responsibility for Backups</h3>
            <p className="legal-p">Customer is solely responsible for maintaining independent backup copies of all Customer Data and Customer Content. Company shall not be liable for any loss, corruption, or destruction of Customer Data or Customer Content, regardless of cause.</p>
            <h2 className="legal-h2">5. AI-POWERED FEATURES -- IMPORTANT DISCLAIMERS</h2>
            <h3 className="legal-h3">5.1 Nature of AI-Generated Output</h3>
            <p className="legal-p">The Platform&#x27;s AI Features, including document parsing, data extraction, financial modeling, commute analysis, geocoding, and the AI chatbot assistant, are powered by third-party artificial intelligence models (including Google Gemini) and automated processing technologies. Customer acknowledges and agrees that:</p>
            <p className="legal-indent">(a) All Output generated by AI Features is produced by automated systems and is inherently probabilistic in nature;</p>
            <p className="legal-indent">(b) Output may contain errors, inaccuracies, omissions, or inconsistencies;</p>
            <p className="legal-indent">(c) Geocoding results are approximate and may not reflect precise property locations;</p>
            <p className="legal-indent">(d) Parsed building data may be incomplete, incorrectly extracted, or misattributed;</p>
            <p className="legal-indent">(e) AI Features may interpret, categorize, or present information differently from how it appears in the source documents; and</p>
            <p className="legal-indent">(f) The performance and accuracy of AI Features may vary depending on the quality, format, and content of Customer Data.</p>
            <h3 className="legal-h3">5.2 Financial Models and Analysis</h3>
            <p className="legal-caps">ALL FINANCIAL MODELS, ANALYSES, PROJECTIONS, AND CALCULATIONS GENERATED BY THE PLATFORM ARE ESTIMATES ONLY AND ARE PROVIDED FOR INFORMATIONAL PURPOSES. SUCH OUTPUT DOES NOT CONSTITUTE AND SHALL NOT BE CONSTRUED AS INVESTMENT ADVICE, TAX ADVICE, FINANCIAL ADVICE, REAL ESTATE APPRAISALS, BROKER OPINIONS OF VALUE, OR PROFESSIONAL GUIDANCE OF ANY KIND. CUSTOMER IS SOLELY RESPONSIBLE FOR VERIFYING ALL FINANCIAL CALCULATIONS AND OBTAINING INDEPENDENT PROFESSIONAL ADVICE BEFORE MAKING ANY INVESTMENT, TRANSACTION, OR BUSINESS DECISION.</p>
            <h3 className="legal-h3">5.3 No Professional Licensure</h3>
            <p className="legal-caps">COMPANY IS NOT A LICENSED REAL ESTATE BROKER, REAL ESTATE APPRAISER, FINANCIAL ADVISOR, INVESTMENT ADVISOR, TAX ADVISOR, OR ANY OTHER TYPE OF LICENSED PROFESSIONAL. THE PLATFORM IS A TECHNOLOGY TOOL THAT ASSISTS CUSTOMERS IN ORGANIZING AND ANALYZING DATA -- IT DOES NOT PROVIDE PROFESSIONAL REAL ESTATE, FINANCIAL, LEGAL, OR TAX ADVICE.</p>
            <h3 className="legal-h3">5.4 Customer Verification Obligation</h3>
            <p className="legal-caps">CUSTOMER IS SOLELY AND EXCLUSIVELY RESPONSIBLE FOR INDEPENDENTLY VERIFYING ALL OUTPUT BEFORE RELYING ON IT FOR ANY PURPOSE, INCLUDING BUT NOT LIMITED TO REAL ESTATE TRANSACTIONS, INVESTMENT DECISIONS, LEASE NEGOTIATIONS, PROPERTY VALUATIONS, FINANCIAL COMMITMENTS, OR ANY OTHER BUSINESS DECISION. OUTPUT SHOULD NOT BE THE SOLE BASIS FOR ANY REAL ESTATE TRANSACTION, INVESTMENT DECISION, OR BUSINESS COMMITMENT.</p>
            <h3 className="legal-h3">5.5 Third-Party AI Model Limitations</h3>
            <p className="legal-p">The AI Features rely on third-party artificial intelligence models that are subject to their own limitations, terms of service, and usage policies. Company does not control the underlying behavior of these models and cannot guarantee their continued availability, accuracy, or performance. Changes to third-party AI models may affect the quality, consistency, or availability of Output without prior notice.</p>
            <h2 className="legal-h2">6. TOKEN-BASED BILLING AND PAYMENTS</h2>
            <h3 className="legal-h3">6.1 Token System</h3>
            <p className="legal-p">The Platform operates on a token-based billing model. All AI-powered actions within the Platform consume Tokens from the applicable Project&#x27;s token pool. One (1) Token equals one U.S. dollar ($1.00) in value. Token consumption rates for specific actions are set forth in the Documentation and are subject to change with reasonable advance notice.</p>
            <h3 className="legal-h3">6.2 Token Purchases</h3>
            <p className="legal-p">Customers may purchase Tokens through the Platform. All Token purchases are processed by Stripe, Inc. (&quot;Stripe&quot;) and are subject to Stripe&#x27;s terms of service and privacy policy, available at stripe.com. Company is not responsible for any errors, failures, or issues arising from Stripe&#x27;s payment processing services. Token pricing is subject to change upon thirty (30) days&#x27; prior written notice to Customer.</p>
            <h3 className="legal-h3">6.3 Project Owner Financial Responsibility</h3>
            <p className="legal-p">The Project Owner bears sole financial responsibility for all Token consumption within their Project(s), including Tokens consumed by any Authorized User invited to the Project, regardless of the Authorized User&#x27;s role. By inviting Authorized Users to a Project, the Project Owner acknowledges and accepts liability for all resulting Token charges.</p>
            <h3 className="legal-h3">6.4 No Refunds</h3>
            <p className="legal-p">All Token purchases are final and non-refundable. Consumed Tokens cannot be restored, credited, or refunded under any circumstances. Unused Tokens that remain in a Project&#x27;s token pool are non-refundable upon account termination, except as may be required by applicable law.</p>
            <h3 className="legal-h3">6.5 Token Expiration</h3>
            <p className="legal-p">Unless otherwise specified in an Order Form, purchased Tokens shall not expire so long as the Customer&#x27;s account remains active and in good standing. Company reserves the right to implement Token expiration policies upon ninety (90) days&#x27; prior written notice.</p>
            <h3 className="legal-h3">6.6 Promotional and Seed Tokens</h3>
            <p className="legal-p">Company may, from time to time, issue promotional, beta, or seed Tokens at no charge. Such Tokens: (a) are provided &quot;as is&quot; with no warranty; (b) are non-transferable between accounts or Projects; (c) may not be redeemed for cash or monetary value; (d) may be subject to expiration dates or usage restrictions as specified at the time of issuance; and (e) may be revoked by Company at any time in its sole discretion.</p>
            <h3 className="legal-h3">6.7 Taxes</h3>
            <p className="legal-p">All fees and charges under these Terms are exclusive of applicable taxes. Customer is responsible for all sales, use, VAT, GST, and other taxes associated with Token purchases and Platform usage, excluding taxes based on Company&#x27;s net income.</p>
            <h2 className="legal-h2">7. INTELLECTUAL PROPERTY</h2>
            <h3 className="legal-h3">7.1 Company Intellectual Property</h3>
            <p className="legal-p">Company retains all right, title, and interest in and to the Platform, including all software, algorithms, models, user interfaces, designs, documentation, trade secrets, trademarks, service marks, trade names, logos, and all other intellectual property rights therein. These Terms do not grant Customer any right, title, or interest in the Platform except for the limited license expressly set forth in Section 3.1.</p>
            <h3 className="legal-h3">7.2 Customer Intellectual Property</h3>
            <p className="legal-p">Customer retains all right, title, and interest in and to Customer Data and Customer Content. Company claims no ownership rights in Customer Data or Customer Content.</p>
            <h3 className="legal-h3">7.3 Output</h3>
            <p className="legal-p">Subject to these Terms, Customer may use Output generated by the Platform for Customer&#x27;s internal business purposes. However, Company makes no representation or warranty that: (a) Output is original or non-infringing; (b) Output does not contain content that is subject to third-party intellectual property rights; or (c) Customer&#x27;s use of Output will not infringe the rights of any third party. Customer assumes all risk associated with the use of Output and is solely responsible for ensuring that such use complies with applicable law and does not infringe any third-party rights.</p>
            <h3 className="legal-h3">7.4 Aggregated and De-Identified Data</h3>
            <p className="legal-p">Notwithstanding anything to the contrary in these Terms, Company may collect, use, and disclose aggregated, anonymized, and de-identified data derived from Customer&#x27;s use of the Platform (&quot;Aggregated Data&quot;) for any lawful business purpose, including but not limited to: (a) improving and enhancing the Platform; (b) performing analytics and benchmarking; (c) generating industry insights; and (d) developing new products and services. Aggregated Data shall not identify Customer, any Authorized User, or any specific property, transaction, or business relationship, and shall not be considered Customer Data or Confidential Information.</p>
            <h3 className="legal-h3">7.5 Feedback</h3>
            <p className="legal-p">If Customer or any Authorized User provides Company with any suggestions, enhancement requests, recommendations, or other feedback regarding the Platform (&quot;Feedback&quot;), Customer hereby assigns to Company all right, title, and interest in and to such Feedback. Company may use, incorporate, and exploit Feedback for any purpose without obligation, restriction, or compensation to Customer.</p>
            <h2 className="legal-h2">8. CONFIDENTIALITY</h2>
            <h3 className="legal-h3">8.1 Confidentiality Obligations</h3>
            <p className="legal-p">Each party (the &quot;Receiving Party&quot;) agrees to: (a) maintain the confidentiality of the other party&#x27;s (the &quot;Disclosing Party&#x27;s&quot;) Confidential Information using at least the same degree of care it uses to protect its own Confidential Information, but in no event less than reasonable care; (b) not disclose Confidential Information to any third party except as expressly permitted herein; and (c) use Confidential Information only for the purposes contemplated by these Terms.</p>
            <h3 className="legal-h3">8.2 Customer Data as Confidential Information</h3>
            <p className="legal-p">All Customer Data shall be treated as Customer&#x27;s Confidential Information, subject to the limited license granted in Section 4.2 and the aggregated data provisions in Section 7.4.</p>
            <h3 className="legal-h3">8.3 Permitted Disclosures</h3>
            <p className="legal-p">A Receiving Party may disclose Confidential Information: (a) to its employees, contractors, and agents who have a need to know and are bound by confidentiality obligations at least as protective as those set forth herein; and (b) as required by applicable law, regulation, or court order, provided that the Receiving Party gives the Disclosing Party prompt written notice of such requirement (to the extent legally permitted) and reasonably cooperates with the Disclosing Party&#x27;s efforts to obtain a protective order or other appropriate remedy.</p>
            <h3 className="legal-h3">8.4 Exceptions</h3>
            <p className="legal-p">Confidential Information does not include information that: (a) is or becomes publicly available through no fault of the Receiving Party; (b) was rightfully known by the Receiving Party prior to disclosure; (c) is independently developed by the Receiving Party without use of or reference to the Disclosing Party&#x27;s Confidential Information; or (d) is rightfully obtained by the Receiving Party from a third party without restriction on disclosure.</p>
            <h2 className="legal-h2">9. WARRANTY DISCLAIMERS</h2>
            <p className="legal-caps">9.1 THE PLATFORM, INCLUDING ALL AI FEATURES, OUTPUT, DOCUMENTATION, AND RELATED SERVICES, IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE. COMPANY HEREBY DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, AND ACCURACY.</p>
            <p className="legal-caps">9.2 WITHOUT LIMITING THE GENERALITY OF THE FOREGOING, COMPANY MAKES NO WARRANTY OR REPRESENTATION THAT: (A) THE PLATFORM WILL MEET YOUR REQUIREMENTS OR EXPECTATIONS; (B) THE PLATFORM WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE; (C) ANY OUTPUT, INCLUDING AI-GENERATED CONTENT, PARSED DATA, FINANCIAL MODELS, COMMUTE ANALYSES, GEOCODING RESULTS, OR CHATBOT RESPONSES, WILL BE ACCURATE, COMPLETE, RELIABLE, OR FIT FOR ANY PURPOSE; (D) ANY DEFECTS IN THE PLATFORM WILL BE CORRECTED; OR (E) THE PLATFORM IS FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.</p>
            <p className="legal-caps">9.3 COMPANY DOES NOT WARRANT THE AVAILABILITY, ACCURACY, OR PERFORMANCE OF ANY THIRD-PARTY SERVICES INTEGRATED WITH THE PLATFORM, INCLUDING GOOGLE MAPS, GOOGLE GEMINI, SUPABASE, STRIPE, OR VERCEL. THE AVAILABILITY AND FUNCTIONALITY OF SUCH THIRD-PARTY SERVICES ARE SUBJECT TO THEIR RESPECTIVE PROVIDERS&#x27; TERMS AND CONDITIONS, AND COMPANY SHALL HAVE NO LIABILITY FOR ANY INTERRUPTION, MODIFICATION, OR DISCONTINUATION OF SUCH THIRD-PARTY SERVICES.</p>
            <p className="legal-caps">9.4 COMPANY DOES NOT WARRANT THAT GEOCODING RESULTS ACCURATELY REFLECT THE PHYSICAL LOCATION OF ANY PROPERTY, THAT DATA EXTRACTED FROM UPLOADED DOCUMENTS IS COMPLETE OR ACCURATE, OR THAT FINANCIAL MODELS REFLECT ACTUAL MARKET CONDITIONS. ALL SUCH OUTPUT IS PROVIDED FOR INFORMATIONAL PURPOSES ONLY AND MUST BE INDEPENDENTLY VERIFIED BY CUSTOMER.</p>
            <p className="legal-caps">9.5 SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OF CERTAIN WARRANTIES. TO THE EXTENT THAT ANY SUCH EXCLUSION IS PROHIBITED BY APPLICABLE LAW, THE SCOPE AND DURATION OF SUCH WARRANTY SHALL BE THE MINIMUM PERMITTED UNDER SUCH LAW.</p>
            <h2 className="legal-h2">10. LIMITATION OF LIABILITY</h2>
            <p className="legal-caps">10.1 EXCLUSION OF DAMAGES. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL COMPANY, ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, LICENSORS, OR SERVICE PROVIDERS BE LIABLE TO CUSTOMER OR ANY THIRD PARTY FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO DAMAGES FOR LOSS OF PROFITS, LOSS OF REVENUE, LOSS OF DATA, LOSS OF BUSINESS OPPORTUNITY, BUSINESS INTERRUPTION, REPUTATIONAL HARM, COST OF PROCUREMENT OF SUBSTITUTE SERVICES, OR ANY OTHER INTANGIBLE LOSSES, ARISING OUT OF OR IN CONNECTION WITH THESE TERMS OR THE USE OF OR INABILITY TO USE THE PLATFORM, REGARDLESS OF THE THEORY OF LIABILITY (WHETHER IN CONTRACT, TORT, STRICT LIABILITY, OR OTHERWISE) AND EVEN IF COMPANY HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
            <p className="legal-caps">10.2 CAP ON LIABILITY. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, COMPANY&#x27;S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR IN CONNECTION WITH THESE TERMS OR THE USE OF OR INABILITY TO USE THE PLATFORM SHALL NOT EXCEED THE TOTAL AMOUNT OF FEES ACTUALLY PAID BY CUSTOMER TO COMPANY IN THE TWELVE (12) MONTH PERIOD IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM. IF CUSTOMER HAS NOT PAID ANY FEES TO COMPANY, COMPANY&#x27;S MAXIMUM AGGREGATE LIABILITY SHALL NOT EXCEED ONE HUNDRED U.S. DOLLARS ($100.00).</p>
            <p className="legal-caps">10.3 APPLICABILITY. THE LIMITATIONS SET FORTH IN SECTIONS 10.1 AND 10.2 SHALL APPLY REGARDLESS OF WHETHER THE ALLEGED LIABILITY IS BASED ON CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY, OR ANY OTHER LEGAL THEORY, AND REGARDLESS OF WHETHER COMPANY HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
            <h3 className="legal-h3">10.4 Carve-Outs</h3>
            <p className="legal-p">The limitations and exclusions set forth in Sections 10.1 and 10.2 shall not apply to: (a) damages arising from a party&#x27;s gross negligence or willful misconduct; (b) a party&#x27;s breach of its confidentiality obligations under Section 8; (c) a party&#x27;s indemnification obligations under Section 11; (d) Customer&#x27;s violation of the license restrictions set forth in Section 3.2; or (e) Customer&#x27;s payment obligations under Section 6.</p>
            <h2 className="legal-h2">11. INDEMNIFICATION</h2>
            <h3 className="legal-h3">11.1 Indemnification by Customer</h3>
            <p className="legal-p">Customer shall defend, indemnify, and hold harmless Company and its Affiliates, officers, directors, employees, agents, and successors and assigns (collectively, &quot;Company Indemnitees&quot;) from and against any and all third-party claims, actions, suits, proceedings, and demands (&quot;Claims&quot;), and all related losses, damages, liabilities, judgments, settlements, costs, and expenses (including reasonable attorneys&#x27; fees) arising out of or in connection with: (a) Customer Data or Customer Content, including any Claim that Customer Data infringes or misappropriates a third party&#x27;s intellectual property rights or violates a third party&#x27;s privacy rights; (b) Customer&#x27;s or any Authorized User&#x27;s use of the Platform in violation of these Terms; (c) Customer&#x27;s violation of applicable law; or (d) any real estate transaction, investment decision, or business decision made by Customer or any third party based in whole or in part on Output generated by the Platform.</p>
            <h3 className="legal-h3">11.2 Indemnification by Company</h3>
            <p className="legal-p">Company shall defend, indemnify, and hold harmless Customer and its Affiliates, officers, directors, employees, and agents (collectively, &quot;Customer Indemnitees&quot;) from and against any Claims and all related losses, damages, liabilities, judgments, settlements, costs, and expenses (including reasonable attorneys&#x27; fees) arising out of a Claim that the Platform, as provided by Company and used in accordance with these Terms, infringes or misappropriates a third party&#x27;s valid United States patent, copyright, or trade secret. Company&#x27;s obligations under this Section 11.2 shall not apply to the extent that the alleged infringement arises from: (i) modifications to the Platform made by Customer or any third party; (ii) use of the Platform in combination with any third-party products, services, or data not provided or approved by Company; (iii) use of the Platform in violation of these Terms; or (iv) Customer Data or Customer Content.</p>
            <h3 className="legal-h3">11.3 Indemnification Procedures</h3>
            <p className="legal-p">The indemnification obligations set forth in this Section 11 are conditioned upon: (a) the indemnified party providing prompt written notice of the Claim to the indemnifying party (provided that failure to provide prompt notice shall not relieve the indemnifying party of its obligations except to the extent it is materially prejudiced thereby); (b) the indemnifying party having sole control over the defense and settlement of the Claim (provided that the indemnifying party shall not settle any Claim in a manner that imposes any obligation or liability on the indemnified party without the indemnified party&#x27;s prior written consent, not to be unreasonably withheld); and (c) the indemnified party providing reasonable cooperation and assistance to the indemnifying party at the indemnifying party&#x27;s expense.</p>
            <h2 className="legal-h2">12. DATA SECURITY</h2>
            <h3 className="legal-h3">12.1 Security Measures</h3>
            <p className="legal-p">Company shall implement and maintain commercially reasonable administrative, technical, and physical security measures designed to protect Customer Data against unauthorized access, acquisition, use, disclosure, alteration, or destruction, consistent with industry standards for software-as-a-service platforms.</p>
            <h3 className="legal-h3">12.2 Encryption</h3>
            <p className="legal-p">Customer Data is encrypted in transit using TLS 1.2 or higher and at rest using AES-256 encryption or equivalent industry-standard encryption.</p>
            <h3 className="legal-h3">12.3 Incident Notification</h3>
            <p className="legal-p">In the event of a confirmed security breach that results in the unauthorized access to or acquisition of Customer Data (a &quot;Security Incident&quot;), Company shall: (a) notify Customer in writing within seventy-two (72) hours of confirming the Security Incident; (b) provide reasonable details regarding the nature and scope of the Security Incident; (c) take commercially reasonable steps to investigate, remediate, and mitigate the effects of the Security Incident; and (d) cooperate with Customer&#x27;s reasonable requests for information regarding the Security Incident.</p>
            <h3 className="legal-h3">12.4 Data Processing Addendum</h3>
            <p className="legal-p">For enterprise Customers that require additional data processing protections, Company will make available a Data Processing Addendum (&quot;DPA&quot;) upon written request. The DPA, when executed, shall supplement these Terms with respect to the processing of personal data.</p>
            <h3 className="legal-h3">12.5 CCPA Compliance</h3>
            <p className="legal-p">To the extent that Company processes personal information (as defined under the California Consumer Privacy Act, as amended by the California Privacy Rights Act, collectively &quot;CCPA&quot;) on behalf of Customer, Company shall: (a) process such personal information only as necessary to provide the Service and as instructed by Customer; (b) not sell or share personal information as those terms are defined under the CCPA; (c) not combine personal information received from Customer with personal information collected from other sources, except as permitted by the CCPA; and (d) comply with all applicable obligations under the CCPA as a service provider.</p>
            <h2 className="legal-h2">13. TERM AND TERMINATION</h2>
            <h3 className="legal-h3">13.1 Term</h3>
            <p className="legal-p">These Terms are effective as of the date you first access or use the Platform (the &quot;Effective Date&quot;) and will remain in effect until terminated by either party in accordance with this Section 13. For enterprise Customers, the subscription term shall be as specified in the applicable Order Form.</p>
            <h3 className="legal-h3">13.2 Termination for Convenience</h3>
            <p className="legal-p">Customer may terminate these Terms at any time by closing its account through the Platform or by providing written notice to Company. Such termination shall be effective upon the date the account is closed or, if written notice is provided, thirty (30) days following receipt of such notice.</p>
            <h3 className="legal-h3">13.3 Termination for Cause</h3>
            <p className="legal-p">Either party may terminate these Terms upon written notice if the other party materially breaches any provision of these Terms and fails to cure such breach within thirty (30) days after receiving written notice specifying the breach in reasonable detail. Company may terminate these Terms immediately upon written notice if Customer fails to pay any fees within fifteen (15) days after the due date.</p>
            <h3 className="legal-h3">13.4 Suspension</h3>
            <p className="legal-p">Company may, in its sole discretion, immediately suspend Customer&#x27;s and/or any Authorized User&#x27;s access to the Platform if: (a) Customer or any Authorized User violates Section 3.2 (Restrictions), Section 14 (Acceptable Use Policy), or any other material provision of these Terms; (b) Company reasonably believes that suspension is necessary to prevent harm to the Platform, Company, other customers, or third parties; (c) Company is required to do so by law or regulation; or (d) Customer&#x27;s account has an outstanding, past-due balance. Company will make commercially reasonable efforts to provide prior notice of any suspension, except where immediate action is required.</p>
            <h3 className="legal-h3">13.5 Effect of Termination</h3>
            <p className="legal-p">Upon termination or expiration of these Terms: (a) all licenses granted herein shall immediately terminate; (b) Customer shall cease all use of the Platform; (c) Customer shall have a thirty (30) day Export Period to download or export Customer Data; (d) following the Export Period, Company shall delete Customer Data in accordance with Section 4.5; and (e) any unused Tokens remaining in Customer&#x27;s account shall be forfeited and are non-refundable, except as may be required by applicable law.</p>
            <h3 className="legal-h3">13.6 Surviving Provisions</h3>
            <p className="legal-p">The following Sections shall survive any termination or expiration of these Terms: Section 1 (Definitions), Section 4.1 (Ownership of Customer Data), Section 5 (AI-Powered Features Disclaimers), Section 7 (Intellectual Property), Section 8 (Confidentiality), Section 9 (Warranty Disclaimers), Section 10 (Limitation of Liability), Section 11 (Indemnification), Section 16 (Governing Law and Dispute Resolution), and Section 18 (Miscellaneous).</p>
            <h2 className="legal-h2">14. ACCEPTABLE USE POLICY</h2>
            <h3 className="legal-h3">14.1 Prohibited Conduct</h3>
            <p className="legal-p">Customer shall not, and shall not permit any Authorized User or third party to, use the Platform to:</p>
            <p className="legal-indent">(a) Violate any applicable federal, state, local, or international law, regulation, or ordinance;</p>
            <p className="legal-indent">(b) Upload, transmit, or store any content that is unlawful, fraudulent, defamatory, obscene, threatening, abusive, or otherwise objectionable;</p>
            <p className="legal-indent">(c) Upload, transmit, or store any malicious code, virus, worm, Trojan horse, ransomware, or other harmful or destructive software;</p>
            <p className="legal-indent">(d) Attempt to gain unauthorized access to the Platform, other users&#x27; accounts, or any systems or networks connected to the Platform;</p>
            <p className="legal-indent">(e) Access or attempt to access another user&#x27;s Project, Customer Data, or Customer Content without proper authorization;</p>
            <p className="legal-indent">(f) Use any automated means, including bots, scripts, crawlers, or data mining tools, to access, monitor, copy, or interact with the Platform without Company&#x27;s prior written consent;</p>
            <p className="legal-indent">(g) Reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code or underlying algorithms of the Platform;</p>
            <p className="legal-indent">(h) Circumvent, disable, or interfere with any security features, authentication mechanisms, or access controls of the Platform;</p>
            <p className="legal-indent">(i) Upload data or documents for which Customer does not have the necessary rights, licenses, or permissions;</p>
            <p className="legal-indent">(j) Impersonate any person or entity, or falsely state or misrepresent your affiliation with any person or entity;</p>
            <p className="legal-indent">(k) Interfere with, disrupt, or impose an unreasonable or disproportionate load on the Platform or its infrastructure; or</p>
            <p className="legal-indent">(l) Engage in any activity that could damage, disable, overburden, or impair the proper functioning of the Platform.</p>
            <h3 className="legal-h3">14.2 Enforcement</h3>
            <p className="legal-p">Company reserves the right to investigate and take appropriate action against any violation of this Section 14, including without limitation: (a) removing or disabling access to offending content; (b) suspending or terminating the violating Customer&#x27;s or Authorized User&#x27;s access to the Platform; and (c) reporting violations to law enforcement authorities. Company may refer to a separate Acceptable Use Policy document, which shall be deemed incorporated into these Terms by reference.</p>
            <h2 className="legal-h2">15. THIRD-PARTY SERVICES</h2>
            <h3 className="legal-h3">15.1 Third-Party Integrations</h3>
            <p className="legal-p">The Platform integrates with and relies upon various Third-Party Services to provide its functionality, including but not limited to:</p>
            <p className="legal-indent">(a) Google Gemini -- for artificial intelligence processing and document analysis;</p>
            <p className="legal-indent">(b) Google Maps -- for geocoding, mapping, and location services;</p>
            <p className="legal-indent">(c) Supabase -- for database, authentication, and backend infrastructure;</p>
            <p className="legal-indent">(d) Stripe -- for payment processing and billing; and</p>
            <p className="legal-indent">(e) Vercel -- for hosting and content delivery.</p>
            <h3 className="legal-h3">15.2 Third-Party Terms</h3>
            <p className="legal-p">Customer acknowledges and agrees that: (a) use of Third-Party Services may be subject to the terms and conditions, privacy policies, and acceptable use policies of the respective third-party providers; (b) Company does not control and is not responsible for Third-Party Services; and (c) Company is not liable for any acts or omissions of third-party providers or any interruption, modification, or discontinuation of Third-Party Services.</p>
            <h3 className="legal-h3">15.3 No Endorsement</h3>
            <p className="legal-p">The integration of Third-Party Services with the Platform does not constitute an endorsement, guarantee, or recommendation of such Third-Party Services by Company. Company makes no warranty or representation regarding the quality, reliability, or suitability of any Third-Party Services.</p>
            <h2 className="legal-h2">16. GOVERNING LAW AND DISPUTE RESOLUTION</h2>
            <h3 className="legal-h3">16.1 Governing Law</h3>
            <p className="legal-p">These Terms and any dispute arising out of or in connection with these Terms or the Platform shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of laws principles.</p>
            <h3 className="legal-h3">16.2 Mandatory Binding Arbitration</h3>
            <p className="legal-caps">ANY DISPUTE, CLAIM, OR CONTROVERSY ARISING OUT OF OR RELATING TO THESE TERMS OR THE BREACH, TERMINATION, ENFORCEMENT, INTERPRETATION, OR VALIDITY THEREOF, INCLUDING THE DETERMINATION OF THE SCOPE OR APPLICABILITY OF THIS AGREEMENT TO ARBITRATE (COLLECTIVELY, &quot;DISPUTES&quot;), SHALL BE DETERMINED BY BINDING ARBITRATION IN SANTA BARBARA COUNTY, CALIFORNIA, BEFORE A SINGLE ARBITRATOR. THE ARBITRATION SHALL BE ADMINISTERED BY JAMS PURSUANT TO ITS COMPREHENSIVE ARBITRATION RULES AND PROCEDURES OR, IF JAMS IS UNAVAILABLE, BY THE AMERICAN ARBITRATION ASSOCIATION (&quot;AAA&quot;) PURSUANT TO ITS COMMERCIAL ARBITRATION RULES. JUDGMENT ON THE AWARD MAY BE ENTERED IN ANY COURT HAVING JURISDICTION.</p>
            <h3 className="legal-h3">16.3 Class Action Waiver</h3>
            <p className="legal-caps">TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, CUSTOMER AGREES THAT ANY ARBITRATION OR PROCEEDING SHALL BE CONDUCTED ONLY ON AN INDIVIDUAL BASIS AND NOT IN A CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION. CUSTOMER WAIVES ANY RIGHT TO PARTICIPATE IN A CLASS ACTION LAWSUIT OR CLASS-WIDE ARBITRATION AGAINST COMPANY. IF FOR ANY REASON A CLAIM PROCEEDS IN COURT RATHER THAN IN ARBITRATION, EACH PARTY WAIVES ANY RIGHT TO A JURY TRIAL.</p>
            <h3 className="legal-h3">16.4 Arbitration Opt-Out</h3>
            <p className="legal-p">Customer may opt out of the mandatory arbitration provision by sending written notice to Company at legal@tourlytics.ai within thirty (30) days of first accepting these Terms. The notice must include Customer&#x27;s name, address, email address, and a clear statement that Customer wishes to opt out of binding arbitration. If Customer opts out, all Disputes shall be resolved exclusively in the state or federal courts located in Santa Barbara County, California, and the parties consent to the exclusive jurisdiction and venue of such courts.</p>
            <h3 className="legal-h3">16.5 Injunctive Relief</h3>
            <p className="legal-p">Notwithstanding the foregoing, either party may seek injunctive or other equitable relief in any court of competent jurisdiction to prevent the actual or threatened infringement, misappropriation, or violation of the other party&#x27;s intellectual property rights, Confidential Information, or other proprietary rights, without the requirement of posting a bond or other security.</p>
            <h3 className="legal-h3">16.6 Prevailing Party</h3>
            <p className="legal-p">In any arbitration or legal proceeding arising out of or relating to these Terms, the prevailing party shall be entitled to recover its reasonable attorneys&#x27; fees and costs from the non-prevailing party.</p>
            <h2 className="legal-h2">17. CHANGES TO TERMS</h2>
            <h3 className="legal-h3">17.1 Modification</h3>
            <p className="legal-p">Company reserves the right to modify these Terms at any time. Company will provide at least thirty (30) days&#x27; prior notice of any material changes by sending an email to the address associated with Customer&#x27;s account and/or by posting a notice on the Platform. The updated Terms will indicate the date of the most recent revision.</p>
            <h3 className="legal-h3">17.2 Acceptance</h3>
            <p className="legal-p">Customer&#x27;s continued use of the Platform following the effective date of any modifications shall constitute Customer&#x27;s acceptance of the modified Terms. If Customer does not agree to the modified Terms, Customer must stop using the Platform and terminate its account in accordance with Section 13.2.</p>
            <h3 className="legal-h3">17.3 Enterprise Customers</h3>
            <p className="legal-p">For enterprise Customers bound by an Order Form, material changes to these Terms that materially diminish Customer&#x27;s rights or materially increase Customer&#x27;s obligations shall require Customer&#x27;s affirmative written consent before becoming effective. If Customer does not consent to such material changes within sixty (60) days of receiving notice, either party may terminate the affected Order Form upon written notice, and Customer shall be entitled to a pro-rata refund of any prepaid, unused fees.</p>
            <h2 className="legal-h2">18. MISCELLANEOUS</h2>
            <h3 className="legal-h3">18.1 Entire Agreement</h3>
            <p className="legal-p">These Terms, together with any applicable Order Forms, the Privacy Policy, and any other documents expressly incorporated by reference herein, constitute the entire agreement between the parties with respect to the subject matter hereof and supersede all prior and contemporaneous agreements, understandings, negotiations, and discussions, whether oral or written.</p>
            <h3 className="legal-h3">18.2 Severability</h3>
            <p className="legal-p">If any provision of these Terms is held by a court of competent jurisdiction to be invalid, illegal, or unenforceable, such provision shall be modified to the minimum extent necessary to make it valid, legal, and enforceable. If such modification is not possible, the offending provision shall be severed, and the remaining provisions shall continue in full force and effect.</p>
            <h3 className="legal-h3">18.3 Waiver</h3>
            <p className="legal-p">No failure or delay by either party in exercising any right, power, or remedy under these Terms shall operate as a waiver thereof, nor shall any single or partial exercise of any right, power, or remedy preclude any other or further exercise thereof or the exercise of any other right, power, or remedy.</p>
            <h3 className="legal-h3">18.4 Assignment</h3>
            <p className="legal-p">Customer may not assign or transfer these Terms or any rights or obligations hereunder without Company&#x27;s prior written consent. Any attempted assignment in violation of this Section shall be null and void. Company may assign these Terms freely in connection with a merger, acquisition, corporate reorganization, or sale of all or substantially all of its assets without Customer&#x27;s consent. Subject to the foregoing, these Terms shall bind and inure to the benefit of the parties and their respective successors and permitted assigns.</p>
            <h3 className="legal-h3">18.5 Force Majeure</h3>
            <p className="legal-p">Neither party shall be liable for any failure or delay in performing its obligations under these Terms (other than payment obligations) to the extent such failure or delay results from circumstances beyond the party&#x27;s reasonable control, including but not limited to: acts of God, natural disasters, epidemics, pandemics, war, terrorism, riots, embargoes, acts of civil or military authorities, fire, floods, earthquakes, power outages, internet or telecommunications failures, cyberattacks, or third-party service provider outages (collectively, &quot;Force Majeure Events&quot;). The affected party shall provide prompt notice to the other party and shall use commercially reasonable efforts to resume performance as soon as practicable.</p>
            <h3 className="legal-h3">18.6 Notices</h3>
            <p className="legal-p">All notices required or permitted under these Terms shall be in writing and shall be deemed effectively given: (a) upon personal delivery; (b) upon confirmed delivery by nationally recognized overnight courier; (c) upon confirmed delivery by email; or (d) three (3) business days after deposit in the United States mail, postage prepaid, certified or registered, return receipt requested. Notices to Company shall be sent to legal@tourlytics.ai or to such other address as Company may designate in writing. Notices to Customer shall be sent to the email address associated with Customer&#x27;s account.</p>
            <h3 className="legal-h3">18.7 Relationship of the Parties</h3>
            <p className="legal-p">The parties are independent contractors. Nothing in these Terms shall be construed to create a partnership, joint venture, agency, employment, or franchise relationship between the parties. Neither party has the authority to bind the other party or to incur any obligation on behalf of the other party.</p>
            <h3 className="legal-h3">18.8 No Third-Party Beneficiaries</h3>
            <p className="legal-p">These Terms are for the sole benefit of the parties hereto and their respective successors and permitted assigns. Nothing in these Terms, express or implied, is intended to or shall confer upon any third party any legal or equitable right, benefit, or remedy of any nature whatsoever.</p>
            <h3 className="legal-h3">18.9 Export Compliance</h3>
            <p className="legal-p">Customer shall comply with all applicable U.S. export control laws and regulations, including the Export Administration Regulations (&quot;EAR&quot;) and the International Traffic in Arms Regulations (&quot;ITAR&quot;), in connection with its use of the Platform. Customer shall not export, re-export, or transfer the Platform or any Output to any country, entity, or individual prohibited by applicable law.</p>
            <h3 className="legal-h3">18.10 Government Users</h3>
            <p className="legal-p">If Customer is a U.S. government entity or the Platform is being used on behalf of the U.S. government, the Platform is provided as &quot;commercial computer software&quot; and &quot;commercial computer software documentation&quot; as defined in 48 C.F.R. section 2.101 and section 12.212, and the rights of the U.S. government with respect to the Platform shall be as specified therein.</p>
            <h3 className="legal-h3">18.11 Electronic Signatures and Communications</h3>
            <p className="legal-p">Customer agrees that these Terms and all related documents, notices, and communications may be provided, executed, and delivered electronically. Customer&#x27;s electronic acceptance of these Terms constitutes a binding agreement equivalent to a handwritten signature.</p>
            <h2 className="legal-h2">19. CONTACT INFORMATION</h2>
            <p className="legal-p">If you have any questions, concerns, or requests regarding these Terms, please contact us:</p>
            <p className="legal-p">Chewerlytics LLC (d/b/a TourLytics)</p>
            <p className="legal-p">Email: legal@tourlytics.ai</p>
            <p className="legal-p">Website: tourlytics.ai</p>
            <p className="legal-p">By using the Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.</p>
            <p className="legal-p">By: Scott Moitoza</p>
            <p className="legal-p">Title: Founder &amp; Managing Member</p>
            <p className="legal-p">Date: March 18, 2026</p>
            <p className="legal-p">* * *</p>
      </div>

      <div className="legal-footer">
        <div className="legal-footer-inner">
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>&copy; 2026 TourLytics. All rights reserved.</span>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer">Created with Perplexity Computer</a>
          </div>
        </div>
      </div>
    </div>
  )
}
