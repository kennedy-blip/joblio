import type { Profile } from './types';

/**
 * A realistic (fictional) student profile. The point of the button is to let
 * anyone exercise the whole loop — discover → score → tailor → export — in two
 * seconds instead of typing fifteen bullets.
 */
export const SAMPLE_PROFILE: Profile = {
  name: 'Kennedy Wanjiru',
  headline: 'Final-year Computer Science student · sales development and technical support',
  email: 'kennedy.wanjiru@example.com',
  phone: '+254 712 000 000',
  location: 'Nairobi, Kenya (EAT, UTC+3)',
  links: [
    { label: 'GitHub', url: 'github.com/kennedy-wanjiru' },
    { label: 'LinkedIn', url: 'linkedin.com/in/kennedy-wanjiru' },
    { label: 'Portfolio', url: 'kennedy.dev' },
  ],
  summary: '',
  skills: [
    'JavaScript',
    'TypeScript',
    'React',
    'Node.js',
    'PostgreSQL',
    'Python',
    'Customer Support',
    'HubSpot',
    'Cold Outreach',
    'Technical Writing',
    'Figma',
    'Git',
    'REST APIs',
    'Zendesk',
  ],
  experience: [
    {
      id: 'exp-1',
      company: 'Sahili Cloud',
      title: 'Sales Development Representative (part-time)',
      location: 'Nairobi, Kenya (remote)',
      start: 'Mar 2025',
      end: 'Present',
      bullets: [
        { id: 'b-1-1', text: 'Booked 41 qualified demos in six months by running cold outreach sequences to fintech founders across East Africa.' },
        { id: 'b-1-2', text: 'Built a HubSpot pipeline with 1,200 contacts and cut duplicate records by 34% in the first quarter.' },
        { id: 'b-1-3', text: 'Wrote 18 email sequences and lifted reply rate from 4% to 11% by testing subject lines weekly.' },
        { id: 'b-1-4', text: 'Answered first-line technical questions in Zendesk, resolving 62% of tickets without escalation.' },
        { id: 'b-1-5', text: 'Documented the onboarding flow in Notion, which halved the time to train a new SDR from two weeks to five days.' },
      ],
    },
    {
      id: 'exp-2',
      company: 'Freelance',
      title: 'Web Developer',
      location: 'Remote',
      start: 'Jun 2024',
      end: 'Feb 2025',
      bullets: [
        { id: 'b-2-1', text: 'Shipped four React and Node.js sites for small businesses, including a booking flow that handled 300 bookings a month.' },
        { id: 'b-2-2', text: 'Migrated a client from a spreadsheet to PostgreSQL and cut monthly reporting time from six hours to 40 minutes.' },
        { id: 'b-2-3', text: 'Set up CI checks on GitHub Actions so every pull request ran tests before merge.' },
        { id: 'b-2-4', text: 'Ran a weekend hackathon for 60 students on the university tech society committee.' },
      ],
    },
    {
      id: 'exp-3',
      company: 'Mkopo Finance',
      title: 'Customer Support Intern',
      location: 'Nairobi, Kenya',
      start: 'Jan 2024',
      end: 'May 2024',
      bullets: [
        { id: 'b-3-1', text: 'Handled 50+ support conversations a day over WhatsApp and email for a lending product with 20,000 users.' },
        { id: 'b-3-2', text: 'Rewrote 12 help-centre articles, reducing repeat "how do I repay" tickets by a fifth.' },
        { id: 'b-3-3', text: 'Escalated and tracked 80 bug reports with reproduction steps, which the engineering team shipped as fixes within two sprints.' },
      ],
    },
  ],
  projects: [
    {
      id: 'prj-1',
      name: 'Shamba Prices',
      link: 'github.com/kennedy-wanjiru/shamba-prices',
      description: 'A price-comparison tool for smallholder farmers.',
      bullets: [
        { id: 'b-p-1', text: 'Built a Next.js and PostgreSQL app that tracks maize prices across 14 markets, used by 220 farmers in the first month.' },
        { id: 'b-p-2', text: 'Wrote the API in TypeScript with scheduled ingestion and 74% test coverage.' },
        { id: 'b-p-3', text: 'Designed the mobile-first interface in Figma and tested it with nine users before launch.' },
      ],
    },
    {
      id: 'prj-2',
      name: 'Ticket Triage Bot',
      link: 'github.com/kennedy-wanjiru/triage-bot',
      description: 'A classifier that routes support tickets by intent.',
      bullets: [
        { id: 'b-p-4', text: 'Trained a scikit-learn classifier on 4,000 anonymised tickets and reached 88% routing accuracy.' },
        { id: 'b-p-5', text: 'Wrapped it in a FastAPI service and documented the endpoints for the support team.' },
      ],
    },
  ],
  education: [
    {
      id: 'edu-1',
      school: 'University of Nairobi',
      degree: 'BSc',
      field: 'Computer Science',
      start: 'Sep 2023',
      end: 'Expected Nov 2026',
      details: 'Coursework: databases, distributed systems, human-computer interaction. Dean\'s list 2024.',
    },
  ],
  isStudent: true,
};

/** A second, non-student profile so the engine can be exercised both ways. */
export const SAMPLE_PROFILE_EXPERIENCED: Profile = {
  name: 'Achieng Otieno',
  headline: 'Customer success manager · B2B SaaS · Nairobi',
  email: 'achieng.otieno@example.com',
  phone: '+254 733 000 000',
  location: 'Nairobi, Kenya (EAT, UTC+3)',
  links: [{ label: 'LinkedIn', url: 'linkedin.com/in/achieng-otieno' }],
  summary: '',
  skills: ['Customer Success', 'Account Management', 'Salesforce', 'Churn', 'Onboarding', 'SQL', 'Looker', 'Renewals'],
  experience: [
    {
      id: 'exp-a1',
      company: 'Kifaa Systems',
      title: 'Customer Success Manager',
      location: 'Nairobi, Kenya (remote)',
      start: 'Feb 2022',
      end: 'Present',
      bullets: [
        { id: 'b-a1', text: 'Owned a $1.4M book of business across 38 B2B accounts and kept gross churn under 6% for two years.' },
        { id: 'b-a2', text: 'Rebuilt onboarding for new accounts, taking time-to-first-value from 34 days to 12.' },
        { id: 'b-a3', text: 'Built Looker dashboards on top of SQL models so the team could spot at-risk accounts weekly.' },
        { id: 'b-a4', text: 'Negotiated renewals and upsells worth $600k in 2025.' },
      ],
    },
    {
      id: 'exp-a2',
      company: 'Kifaa Systems',
      title: 'Support Specialist',
      location: 'Nairobi, Kenya',
      start: 'Aug 2020',
      end: 'Jan 2022',
      bullets: [
        { id: 'b-a5', text: 'Resolved 40 tickets a day in Zendesk with a 96% satisfaction rating.' },
        { id: 'b-a6', text: 'Wrote 30 knowledge-base articles that cut repeat contacts by a third.' },
      ],
    },
  ],
  projects: [],
  education: [
    {
      id: 'edu-a1',
      school: 'Strathmore University',
      degree: 'BCom',
      field: 'Business Information Technology',
      start: 'Sep 2016',
      end: 'Jun 2020',
      details: '',
    },
  ],
  isStudent: false,
};

/** Raw CV text used by the paste-CV parser demo and its tests. */
export const SAMPLE_CV_TEXT = `KENNEDY WANJIRU
Nairobi, Kenya · kennedy.wanjiru@example.com · +254 712 000 000
github.com/kennedy-wanjiru · linkedin.com/in/kennedy-wanjiru

SUMMARY
Final-year computer science student who has sold, supported and shipped software. Comfortable in HubSpot, Zendesk and a code editor.

EXPERIENCE
Sales Development Representative — Sahili Cloud
Mar 2025 - Present
- Booked 41 qualified demos in six months through cold outreach to fintech founders.
- Built a HubSpot pipeline of 1,200 contacts and cut duplicates by 34%.
- Wrote 18 email sequences that lifted reply rate from 4% to 11%.

Web Developer — Freelance
Jun 2024 - Feb 2025
- Shipped four React and Node.js sites for small businesses.
- Migrated a client from spreadsheets to PostgreSQL, saving five hours a month.

Customer Support Intern — Mkopo Finance
Jan 2024 - May 2024
- Handled 50+ support conversations a day in Zendesk.
- Rewrote 12 help-centre articles, cutting repeat tickets by a fifth.

PROJECTS
Shamba Prices — github.com/kennedy-wanjiru/shamba-prices
- Built a Next.js and PostgreSQL price tracker used by 220 farmers.

EDUCATION
BSc Computer Science — University of Nairobi
Sep 2023 - Nov 2026

SKILLS
JavaScript, TypeScript, React, Node.js, PostgreSQL, Python, Customer Support, HubSpot, Cold Outreach, Technical Writing, Figma, Git, REST APIs, Zendesk
`;
