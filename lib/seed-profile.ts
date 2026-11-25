import type { Profile } from './types';

/**
 * The default profile that ships with this build.
 *
 * These are real facts, transcribed from Kennedy Mokaya's own CV: nothing here is
 * invented, and every bullet is a sentence he wrote about his own work, split into
 * lines. The engine may reorder or hide them for a given posting, but it may never
 * reword them — that is what `assertEngineOutput` enforces.
 *
 * Two deliberate omissions:
 *  - There is no work-experience block. He is a student whose evidence is projects;
 *    turning coursework into a fake employer would poison the rest of the product.
 *    The resume therefore renders summary → education → projects → skills.
 *  - "Julesown" and "Whitty Hybrid" appear in the CV with no description, so they
 *    are not represented rather than guessed at. Add them in Profile when known.
 */
export const SEED_PROFILE: Profile = {
  name: 'Kennedy Mokaya',
  headline: 'Data Science student · technical support, customer success and systems diagnostics',
  email: 'kmokaya864@gmail.com',
  phone: '+254 716 514 451',
  location: 'Nairobi / Meru, Kenya',
  links: [{ label: 'GitHub', url: 'https://github.com/kennedy-blip' }],
  summary:
    'Bachelor of Data Science student with hands-on project experience in Android/ADB diagnostics, system tuning, structured data handling, documentation and testing. Works with Python, JavaScript, Dart, Polars, FastAPI and Git/GitHub workflows, and writes clearly enough for a support ticket to be closed on the first reply.',
  skills: [
    'Python',
    'JavaScript',
    'Java',
    'Dart',
    'React',
    'Next.js',
    'Flutter',
    'FastAPI',
    'WebSockets',
    'Polars',
    'Excel',
    'JSON',
    'CSV',
    'Git',
    'GitHub',
    'Technical Support',
    'Troubleshooting',
    'Documentation',
    'Testing',
    'ADB diagnostics',
    'Android optimization',
    'Local LLMs',
  ],
  experience: [],
  projects: [
    {
      id: 'prj-mesocr',
      name: 'mesocr',
      description: 'Real-time communication app.',
      bullets: [
        {
          id: 'b-mesocr-1',
          text: 'Built an end-to-end real-time communication application using WebSockets for bi-directional messaging.',
        },
        {
          id: 'b-mesocr-2',
          text: 'Secured conversations between users with end-to-end encryption.',
        },
      ],
    },
    {
      id: 'prj-dataswiss',
      name: 'Dataswiss',
      description: 'Data workstation for structured refinement and reporting.',
      bullets: [
        {
          id: 'b-dataswiss-1',
          text: 'Developed a data workstation for structured refinement, data-quality review and reporting across Excel, JSON and CSV files.',
        },
        {
          id: 'b-dataswiss-2',
          text: 'Used high-speed Polars data manipulation with AI-driven reporting to turn raw files into automated insights.',
        },
      ],
    },
    {
      id: 'prj-uniqueno',
      name: 'UniqueNo',
      description: 'Browser utility for patterned mobile strings.',
      bullets: [
        {
          id: 'b-uniqueno-1',
          text: 'Created a glassmorphism-styled browser utility for generating patterned mobile strings.',
        },
        {
          id: 'b-uniqueno-2',
          text: 'Implemented the string-generation logic alongside the front-end interface.',
        },
      ],
    },
    {
      id: 'prj-schoolos',
      name: 'SchoolOS',
      description: 'School management platform, in development.',
      bullets: [
        {
          id: 'b-schoolos-1',
          text: 'Designing a centralized school management platform that integrates administrative and academic functions into a single system.',
        },
        {
          id: 'b-schoolos-2',
          text: 'Applying modular software architecture principles to keep components maintainable and extensible.',
        },
      ],
    },
  ],
  education: [
    {
      id: 'edu-bds',
      school: 'Meru University of Science and Technology',
      degree: 'Bachelor of Data Science (BDS)',
      field: 'Data Science',
      start: '2024',
      end: 'Present',
      details: '',
    },
    {
      id: 'edu-kcse',
      school: 'St. Peters Nyakemincha',
      degree: 'Kenya Certificate of Secondary Education',
      field: '',
      start: '2020',
      end: '2023',
      details: '',
    },
  ],
  isStudent: true,
};

/** Where the one-time seed happened, so an emptied workspace stays empty. */
export const SEED_FLAG = 'jobflow.seeded.v1';
