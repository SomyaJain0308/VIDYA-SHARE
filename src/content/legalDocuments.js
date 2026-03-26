import {
  ACCOUNT_USE_NOTICE,
  APP_NAME,
  BUSINESS_LOCATION,
  DIRECT_TRANSACTION_NOTICE,
  GRIEVANCE_ACK_HOURS,
  GRIEVANCE_RESOLUTION_DAYS,
  LEGAL_LAST_UPDATED,
  MARKETPLACE_DISCLOSURE,
  PLATFORM_LEGAL_NAME,
  SUPPORT_EMAIL,
} from '../config/compliance';

export const LEGAL_NAV_ITEMS = [
  { path: '/terms', label: 'Terms & Conditions' },
  { path: '/privacy', label: 'Privacy Policy' },
  { path: '/refund-policy', label: 'Refund / Return Policy' },
  { path: '/disclaimer', label: 'Marketplace Disclaimer' },
];

export const normalizeLegalPath = (pathname = '/') => {
  const cleanedPath = pathname.replace(/\/+$/, '');
  return cleanedPath || '/';
};

export const LEGAL_DOCUMENTS = {
  '/terms': {
    title: 'Terms & Conditions',
    description: `These terms govern use of ${APP_NAME} as an Indian marketplace platform for second-hand educational goods.`,
    lastUpdated: LEGAL_LAST_UPDATED,
    sections: [
      {
        heading: '1. Platform Role',
        paragraphs: [
          DIRECT_TRANSACTION_NOTICE,
          `${APP_NAME} only provides a platform where users can post listings, browse books, chat with each other, and report unsafe or inappropriate activity.`,
          `${APP_NAME} is not the seller, buyer, reseller, payment intermediary, delivery partner, or quality guarantor for user listings unless we clearly state otherwise on a specific page.`,
        ],
      },
      {
        heading: '2. Eligibility',
        paragraphs: [
          ACCOUNT_USE_NOTICE,
          'You must provide truthful account information, keep your credentials secure, and use the platform only for lawful educational marketplace activity.',
        ],
      },
      {
        heading: '3. User Responsibility',
        paragraphs: [
          'You are solely responsible for the content you post, share, upload, send, or otherwise make available on the platform, including listings, images, messages, profile details, and reports.',
          'If you create a listing, you must make sure it is accurate, lawful, appropriate, and not misleading. This includes the title, photos, description, price, condition, class or school fit, and availability of the item.',
          'You are also responsible for your own interactions with other users, including chats, negotiations, meetings, handovers, and any agreement you make with another user.',
        ],
      },
      {
        heading: '4. Seller And Buyer Responsibilities',
        paragraphs: [
          'Sellers may list only books or other permitted school-related goods that they lawfully own or are authorized to sell. Sellers must not post fake, duplicate, misleading, or unavailable listings.',
          'Buyers should review listings carefully, ask questions through chat, verify the item before payment where possible, and confirm suitability, condition, and completeness before completing a transaction.',
        ],
      },
      {
        heading: '5. Prohibited Content',
        paragraphs: [
          'You must not post, upload, share, request, or send offensive, obscene, sexually explicit, abusive, hateful, threatening, or otherwise inappropriate content or images.',
          'You must not harass, bully, abuse, impersonate, intimidate, or target other users through listings, chat, reports, or any other platform feature.',
          'You must not post spam, duplicate content, fake listings, prank listings, misleading listings, fraudulent posts, or any content designed to trick, scam, or manipulate other users.',
          'You must not use ${APP_NAME} for illegal items, stolen goods, infringing goods, leaked exam materials, counterfeit or pirated materials, or any other unlawful or prohibited activity.',
        ],
      },
      {
        heading: '6. Transactions, Payments, Refunds, And Disputes',
        paragraphs: [
          'Sellers set their own prices. Payments and handovers happen directly between users unless the platform explicitly launches a separate payment feature.',
          'Refunds, returns, cancellations, replacements, no-shows, failed handovers, and disputes are handled between the buyer and seller. The platform does not issue refunds from its own account for user-to-user transactions.',
          `${APP_NAME} is not responsible for losses, failed payments, damaged goods, non-delivery, or disputes arising from a transaction between users.`,
        ],
      },
      {
        heading: '7. Content Moderation',
        paragraphs: [
          `${APP_NAME} may remove, restrict, hide, de-list, or disable any listing, request, message, profile content, or other material at our discretion, including without prior notice, if we believe it is unsafe, inappropriate, unlawful, misleading, abusive, fraudulent, spammy, or otherwise violates these terms.`,
          `${APP_NAME} may suspend, restrict, or ban accounts that violate these terms, create risk for other users, interfere with platform operations, or misuse the marketplace.`,
          'We do not guarantee that all content is reviewed before it appears on the platform. Users may still encounter content that is inaccurate, offensive, misleading, or otherwise harmful before it is detected or removed.',
        ],
      },
      {
        heading: '8. Safety Disclaimer',
        paragraphs: [
          'Users should interact cautiously and use common sense when dealing with others on the platform.',
          'Do not share personal, financial, school, or family details unnecessarily. Use in-app chat first where possible, and be careful before moving a conversation elsewhere.',
          'If you choose to meet another user, meet in a safe public place, preferably during daytime, and take reasonable precautions.',
        ],
      },
      {
        heading: '9. Limitation Of Liability',
        paragraphs: [
          `${APP_NAME} is not liable for user behavior, listings created by users, messages sent by users, or any loss, damage, injury, fraud, dispute, payment issue, failed handover, or other harm arising from user conduct or user-to-user transactions.`,
          `${APP_NAME} does not guarantee that listings are accurate, users are trustworthy, goods are authentic, chats are truthful, transactions will be completed, or the platform will always be uninterrupted or error-free.`,
          'To the maximum extent permitted by law, your use of the platform is at your own risk, and liability is limited to the platform service itself except where liability cannot lawfully be excluded.',
        ],
      },
      {
        heading: '10. Account Actions',
        paragraphs: [
          'Accounts may be restricted, suspended, or permanently terminated for violating these terms, posting prohibited content, misleading other users, abusing platform tools, or creating safety, legal, or trust risks on the platform.',
          'We may also limit access to certain features while we review suspected misuse, complaints, reports, or policy violations.',
        ],
      },
      {
        heading: '11. Reporting And Complaints',
        paragraphs: [
          'Users can report inappropriate listings, suspicious behavior, harassment, fraud, or other unsafe activity through the platform reporting tools where available.',
          `For complaints, legal notices, unsafe-content reports, or consumer grievances, contact ${SUPPORT_EMAIL}. Complaints are targeted to be acknowledged within ${GRIEVANCE_ACK_HOURS} hours and resolved within ${GRIEVANCE_RESOLUTION_DAYS} days.`,
        ],
      },
      {
        heading: '12. Governing Law',
        paragraphs: [
          'These terms are governed by Indian law. Courts with competent jurisdiction in India will have jurisdiction over disputes, subject to any mandatory consumer rights that apply under Indian law.',
        ],
      },
    ],
  },
  '/privacy': {
    title: 'Privacy Policy',
    description: `This Privacy Policy explains how ${APP_NAME} collects, uses, stores, and discloses personal data in connection with its marketplace platform.`,
    lastUpdated: LEGAL_LAST_UPDATED,
    sections: [
      {
        heading: '1. Data We Collect',
        paragraphs: [
      'We may collect account identifiers, email address, phone number, seller profile details, listing data, request data, report data, communications submitted to support, device or browser metadata, and analytics data used to improve platform reliability and performance.',
          'Certain seller details, such as seller name and contact information, are collected so listings can comply with marketplace disclosure requirements and enable direct buyer-seller communication.',
        ],
      },
      {
        heading: '2. Why We Use Data',
        paragraphs: [
          'We use personal data to authenticate users, publish listings, enable direct buyer-seller contact, moderate unsafe or misleading content, respond to complaints, improve platform reliability, enforce our policies, and comply with legal obligations.',
        ],
      },
      {
    heading: '3. App Storage And Analytics',
    paragraphs: [
      'Local app storage is used for security, session management, draft recovery, and core platform functionality. Analytics may also be used to understand performance and improve the product experience.',
    ],
      },
      {
        heading: '4. Public Marketplace Information',
        paragraphs: [
          'If you post a listing, your seller name and listing contact details may be shown to other users so they can evaluate the listing and contact you directly. Optional profile details may be hidden if you choose, but mandatory seller disclosures connected to live listings may still be shown.',
        ],
      },
      {
        heading: '5. Sharing',
        paragraphs: [
          'We share data with other users only to the extent needed to operate the marketplace, with service providers who help run the app, and with regulators, law-enforcement agencies, courts, or other authorities where required by law or to protect the platform and its users.',
        ],
      },
      {
        heading: '6. Retention',
        paragraphs: [
          'We retain personal data only for as long as reasonably necessary for account operation, moderation, complaint handling, legal compliance, fraud prevention, dispute management, and lawful record-keeping. Public listing data may remain visible until removed, archived, or required to be retained for compliance purposes.',
        ],
      },
      {
        heading: '7. Your Rights',
        paragraphs: [
          `Subject to applicable Indian law, you may request access to your personal data, correction of inaccurate data, account-related updates, withdrawal of consent where consent is the basis of processing, and deletion of data that is no longer required. Requests may be sent to ${SUPPORT_EMAIL}.`,
        ],
      },
      {
        heading: '8. Children',
        paragraphs: [
          ACCOUNT_USE_NOTICE,
          'If we learn that a user has shared personal data in a way that creates a safety risk, we may remove the data, limit affected features, or ask for parent, guardian, or school involvement to resolve the issue.',
        ],
      },
      {
        heading: '9. Security',
        paragraphs: [
          'We use reasonable administrative and technical measures to protect platform data, but no method of transmission or storage is completely risk-free. Users should avoid sharing unnecessary sensitive personal data through listings, chat, or free-text fields.',
        ],
      },
      {
        heading: '10. Contact',
        paragraphs: [
          `Privacy requests, grievance submissions, and data-rights requests may be sent to ${SUPPORT_EMAIL}.`,
        ],
      },
    ],
  },
  '/refund-policy': {
    title: 'Refund / Return Policy',
    description: `This policy explains how refunds, returns, and cancellations work on ${APP_NAME}.`,
    lastUpdated: LEGAL_LAST_UPDATED,
    sections: [
      {
        heading: '1. Marketplace-Only Policy',
        paragraphs: [
          DIRECT_TRANSACTION_NOTICE,
          'Because user-to-user payments are made outside the platform, the platform does not itself collect sale proceeds and cannot directly reverse, refund, or charge back those transactions.',
        ],
      },
      {
        heading: '2. Buyer Inspection Requirement',
        paragraphs: [
          'Buyers should inspect the item, confirm its condition, edition, accessories, and suitability, and only make payment after they are satisfied. This is especially important for second-hand books, uniforms, and other school goods.',
        ],
      },
      {
        heading: '3. Seller-Specific Commitments',
        paragraphs: [
          'A seller may voluntarily offer a return, replacement, partial refund, or cancellation arrangement. Any such commitment is between the seller and buyer and should be agreed clearly before payment.',
        ],
      },
      {
        heading: '4. Misleading Or Unsafe Listings',
        paragraphs: [
          `If a listing appears misleading, counterfeit, unlawful, or unsafe, report it promptly through the app or by emailing ${SUPPORT_EMAIL}. The platform may remove the content and restrict the seller account, but platform moderation does not guarantee a monetary remedy.`,
        ],
      },
      {
        heading: '5. Complaint Timeline',
        paragraphs: [
          `Complaints relating to misleading listings, unsafe goods, or marketplace conduct are targeted to be acknowledged within ${GRIEVANCE_ACK_HOURS} hours and addressed within ${GRIEVANCE_RESOLUTION_DAYS} days.`,
        ],
      },
    ],
  },
  '/disclaimer': {
    title: 'Marketplace Disclaimer',
    description: `Important legal disclaimers for ${APP_NAME} as a student marketplace platform in India.`,
    lastUpdated: LEGAL_LAST_UPDATED,
    sections: [
      {
        heading: '1. Platform Disclaimer',
        paragraphs: [
          DIRECT_TRANSACTION_NOTICE,
        ],
      },
      {
        heading: '2. Product Disclaimer',
        paragraphs: [
          'Listings are created by users. The platform does not guarantee accuracy, legality, ownership, completeness, quality, condition, safety, compatibility, merchantability, or fitness for a particular purpose of any listed good.',
        ],
      },
      {
        heading: '3. Transaction Disclaimer',
        paragraphs: [
          'Any negotiation, payment, pickup, exchange, refund, return, cancellation, or dispute is primarily between the buyer and seller. Users should meet safely, inspect goods before paying, and avoid sharing unnecessary personal or financial information.',
        ],
      },
      {
        heading: '4. Moderation Disclaimer',
        paragraphs: [
          'Reporting and moderation tools reduce risk but do not amount to a warranty that every user or listing has been independently investigated. Removal or non-removal of content does not amount to a legal finding regarding a listing or a user.',
        ],
      },
      {
        heading: '5. Educational And Legal Use',
        paragraphs: [
          'Nothing on the platform constitutes legal, tax, financial, educational, or product advice. Users remain responsible for their own compliance with law, school rules, and any local safety requirements.',
        ],
      },
      {
        heading: '6. Contact',
        paragraphs: [
          `To report unlawful or unsafe content, or to submit a grievance, write to ${SUPPORT_EMAIL}.`,
        ],
      },
    ],
  },
};
