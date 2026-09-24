const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
});

const settingsSchema = new mongoose.Schema({
  termsOfService: { type: String, required: true, default: 'Your terms of service go here...' },
  privacyPolicy: { 
    type: String, 
    required: true, 
    default: `
## Privacy Policy

We value your privacy and are committed to safeguarding the personal information you share with us. This Privacy Policy explains how we collect, use, and protect your data when you interact with our website and services.

---

### Types of Personal Information Collected and Stored

1.1. We collect the following personal information when you use third-party login services or create an account on our website:
- Account ID (from third-party login services such as Discord, GitHub, Google, etc.)
- Email address
- User profile information (such as profile picture/avatar, guilds, etc.)
- Internet Protocol (IP) address
- Payment details (For PayPal, we collect your account handle/email; for Stripe, we collect the last 4 digits of your card and transaction details; for Coinbase, we collect transaction details, including the payment method used, the transaction amount, and the cryptocurrency involved.)

1.2. We use login services through platforms such as Discord, GitHub, Google, and Twitter. These platforms provide basic information via their respective APIs. Please refer to their privacy policies for further details on how they handle your data.

---

### Information Collection Process

2.1. When you log in and create an account, your personal information is securely collected and stored in our database. Payment information is only collected when a purchase is made on our website.

---

### Use of Your Information

3.1. We use the information we collect for the following purposes:
- Managing your account and providing related services
- Maintaining administrative records, including payment history and receipts
- Collecting aggregated data for advertising and performance analysis, which does not identify individual users

---

### Information Sharing

4.1. We do not sell, trade, or disclose your personal information to third parties, except as necessary for the operation of our services or as required by law.

---

### Information Security

5.1. We take appropriate measures to ensure the security of your personal information. This includes using industry-standard security protocols to prevent unauthorized access, disclosure, alteration, or destruction of your data.

---

### Data Retention

6.1. We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, or as required or permitted by law.

---

### Third-Party Links

7.1. Our website may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to review the privacy policies of any third-party websites you visit.

---

### Your Rights and Choices

8.1. You have the right to access, update, or correct inaccuracies in your personal information. You may also request the deletion of your personal information, subject to legal requirements.

8.2. If you have any questions or concerns regarding your personal information or this Privacy Policy, please contact us using the information provided below.

---

### Changes to This Privacy Policy

9.1. We may update this Privacy Policy periodically to reflect changes in our practices or legal obligations. Any significant changes will be communicated by posting a prominent notice on our website or via other communication methods.

---

**Please review this Privacy Policy carefully. By continuing to use our services, you consent to the collection, use, and storage of your personal information as described in this policy.**
`
  },
  aboutUsText: { type: String, required: true, default: 'Tell buyers who you are and what you sell. Plain sentences work better than marketing copy.' },
  aboutUsVisible: { type: Boolean, required: true, default: true },
  displayStats: { type: Boolean, required: true, default: true },
  displayFeatures: { type: Boolean, required: true, default: true },
  displayReviews: { type: Boolean, required: true, default: true },
  displayProductReviews: { type: Boolean, required: true, default: true },
  displayCTABanner: { type: Boolean, required: true, default: true },
  backgroundGradient: { type: Boolean, required: true, default: false },
  logoPath: { type: String, default: '/images/logo.png' },
  websiteFont: { type: String, default: 'Manrope' },
  displayFont: { type: String, default: 'Bricolage Grotesque' },
  backgroundImagePath: { type: String, default: '/images/background.jpg' },
  faviconPath: { type: String, default: '/images/favicon.ico' },
  accentColor: { type: String, default: '#7b68ee' },
  discordInviteLink: { type: String, default: 'https://discord.gg/credas' },
  siteBannerText: { type: String, default: '' },
  homePageTitle: { type: String, default: 'Buy once. Download now.' },
  homePageSubtitle: { type: String, default: 'Discord bots, addons, source code and license keys. Pay once and download the file straight away, with every future update included.' },
  productsPageTitle: { type: String, default: 'All products' },
  productsPageSubtitle: { type: String, default: 'Everything currently for sale. Prices include updates, so there is nothing extra to pay later.' },
  reviewsPageTitle: { type: String, default: 'Customer reviews' },
  reviewsPageSubtitle: { type: String, default: 'What buyers said after they used the product.' },
  tosPageTitle: { type: String, default: 'Terms of service' },
  tosPageSubtitle: { type: String, default: 'The rules for buying and using products from this store.' },
  privacyPolicyPageTitle: { type: String, default: 'Privacy policy' },
  privacyPolicyPageSubtitle: { type: String, default: 'What data this store keeps, why it needs it, and how to have it removed.' },
  storeName: { type: String, default: 'Credas' },
  paymentCurrency: { type: String, default: 'USD' },
  currencySymbol: { type: String, default: '$' },
  customNavTabs: [{ name: { type: String, required: true }, link: { type: String, required: true } }],
  customFooterTabs: [{ name: { type: String, required: true }, link: { type: String, required: true } }],
  footerDescription: { type: String, required: true, default: 'Credas sells Discord bots, addons, source code and license keys. Pay once, download immediately, get every future update free.' },
  features: [
    { icon: { type: String, required: true, default: 'fas fa-bolt' }, title: { type: String, required: true, default: 'Download straight away' }, description: { type: String, required: true, default: 'Files unlock on your profile the moment payment clears. No waiting for an email.' }},
    { icon: { type: String, required: true, default: 'fas fa-cogs' }, title: { type: String, required: true, default: 'Updates included' }, description: { type: String, required: true, default: 'Every version released after your purchase is yours at no extra cost.' }},
    { icon: { type: String, required: true, default: 'fas fa-headset' }, title: { type: String, required: true, default: 'Support that answers' }, description: { type: String, required: true, default: 'Ask in the Discord and a person replies. Setup problems are handled in the same channel.' }}
  ],
  seoTitle: { type: String, default: 'Credas — Discord bots, addons and source code' },
  seoDescription: { type: String, default: 'Buy Discord bots, addons, source code and license keys. Pay once, download immediately, updates included.' },
  seoTags: { type: String, default: 'Discord bots, Discord addons, source code, license keys, digital downloads' },
  apiKey: { type: String, default: '' },
  apiEnabled: { type: Boolean, default: false },
  tagline: { type: String, default: 'Digital goods, no subscription' },
  
  displayFaq: { type: Boolean, default: true },
  faqItems: [
    { question: { type: String, required: true, default: 'How do I get my product?' }, answer: { type: String, required: true, default: 'Sign in with Discord, pay, then open your profile. Download links appear there immediately.' } },
    { question: { type: String, required: true, default: 'Do updates cost anything?' }, answer: { type: String, required: true, default: 'No. Every version published after your purchase is included in the price you paid.' } },
    { question: { type: String, required: true, default: 'Which payment methods work?' }, answer: { type: String, required: true, default: 'PayPal, card through Stripe, and crypto through Coinbase, depending on what is enabled in settings.' } }
  ],
  announcementEnabled: { type: Boolean, default: false },
  announcementText: { type: String, default: '' },
  announcementLink: { type: String, default: '' },
  socialLinks: [{ label: { type: String, required: true }, url: { type: String, required: true }, icon: { type: String, default: 'fas fa-link' } }],
  showPaymentBadges: { type: Boolean, default: true },
  newsletterEnabled: { type: Boolean, default: true },
  newsletterTitle: { type: String, default: 'New products' },
  newsletterText: { type: String, default: 'One email when a product is added. Nothing else.' },
  wishlistEnabled: { type: Boolean, default: true },
  productGridDensity: { type: String, default: 'comfortable' },
  customCSS: { type: String, default: '' },
  customJS: { type: String, default: '' },
  maintenanceMode: { type: Boolean, default: false },
  maintenanceMessage: { type: String, default: 'The store is closed for a short maintenance window. Nothing is lost — check back shortly.' },
  antiPiracyEnabled: { type: Boolean, default: false },
  salesTax: { type: Number, default: 0 },
  discordLoggingChannel: { type: String, default: '' },
  productCategories: [categorySchema],
  // Review settings
  sendReviewsToDiscord: { type: Boolean, default: false },
  discordReviewChannel: { type: String, default: '' },
  minimumReviewLength: { type: Number, default: 30 },
  allowReviewDeletion: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
});


settingsSchema.pre('save', function (next) {
  if (!this.features || this.features.length === 0) {
    this.features = [
      {
        icon: 'fas fa-star',
        title: 'High Quality',
        description: 'Our products are crafted with the highest quality standards to ensure reliability and performance.'
      },
      {
        icon: 'fas fa-headset',
        title: 'Customer Support',
        description: 'We offer exceptional customer support to help you get the most out of our products.'
      },
      {
        icon: 'fas fa-bolt',
        title: 'Easy to Use',
        description: 'Designed for ease of use, our products are simple to set up and intuitive to operate.'
      }
    ];
  }

  this.updatedAt = Date.now();
  next();
});
 // %%__NONCE__%%
const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
