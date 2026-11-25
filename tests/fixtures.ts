import type { Job, Profile } from '@/lib/types';
import { SAMPLE_PROFILE } from '@/lib/sample';

export const supportJob: Job = {
  id: 'job-support',
  title: 'Customer Support Specialist',
  company: 'Northwind Labs',
  location: 'Worldwide',
  geo_tier: 'worldwide',
  level: 'entry',
  job_type: 'Full-time',
  salary: null,
  source: 'Jobicy',
  source_url: 'https://jobicy.com/jobs/support',
  apply_url: 'https://northwind.example.com/apply',
  description:
    'We need a support specialist for our SaaS product. You will answer tickets in Zendesk, write help-centre articles, handle customer support escalations and keep SLAs. Requirements: 2+ years in customer support, excellent written communication, comfortable with CRM and documentation. Experience with HubSpot is a plus.',
  posted_at: new Date().toISOString(),
  last_seen_at: new Date().toISOString(),
  years_min: 2,
  tags: ['customer support', 'zendesk'],
};

export const frontendJob: Job = {
  id: 'job-frontend',
  title: 'React Frontend Developer',
  company: 'Tidepool',
  location: 'Worldwide',
  geo_tier: 'worldwide',
  level: 'mid',
  job_type: 'Full-time',
  salary: null,
  source: 'RemoteOK',
  source_url: 'https://remoteok.com/jobs/frontend',
  apply_url: 'https://tidepool.example.com/apply',
  description:
    'Build accessible interfaces in React and TypeScript. You will work with our REST APIs, write tests with Vitest, use Git for code review and Tailwind for styling. Requirements: 3+ years frontend development, strong JavaScript and CSS.',
  posted_at: new Date().toISOString(),
  last_seen_at: new Date().toISOString(),
  years_min: 3,
  tags: ['react', 'typescript'],
};

/** A posting the vocabulary recognises nothing in — must not report 0%. */
export const opaqueJob: Job = {
  id: 'job-opaque',
  title: 'Night Shift Helper',
  company: 'Karoo Freight',
  location: 'Worldwide',
  geo_tier: 'worldwide',
  level: 'mid',
  job_type: 'Full-time',
  salary: null,
  source: 'Arbeitnow',
  source_url: 'https://arbeitnow.com/jobs/warehouse',
  apply_url: 'https://karoo.example.com/apply',
  description: 'Join a friendly crew. We will show you what to do. Bring sturdy boots and a good attitude.',
  posted_at: new Date().toISOString(),
  last_seen_at: new Date().toISOString(),
  years_min: null,
  tags: [],
};

export const tinyProfile: Profile = {
  ...SAMPLE_PROFILE,
  experience: [
    {
      id: 'x1',
      company: 'Acme',
      title: 'Support Agent',
      start: 'Jan 2024',
      end: 'Present',
      bullets: [
        { id: 'x1b1', text: 'Answered 40 support tickets a day in Zendesk.' },
        { id: 'x1b2', text: 'Wrote 12 help-centre articles.' },
        { id: 'x1b3', text: 'Trained two new agents on our escalation process.' },
        { id: 'x1b4', text: 'Ran the office book club.' },
      ],
    },
  ],
  projects: [
    {
      id: 'x2',
      name: 'Tool',
      bullets: [{ id: 'x2b1', text: 'Built a small tool with React.' }],
    },
  ],
  education: [
    { id: 'x3', school: 'University of Nairobi', degree: 'BSc', field: 'Computer Science', start: '2023', end: '2026' },
  ],
  skills: ['Zendesk', 'React', 'Customer Support'],
  isStudent: false,
};
