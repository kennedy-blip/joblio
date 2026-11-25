/**
 * lib/keywords.ts — term matching.
 *
 * The one rule that matters: a term only matches as a WHOLE WORD. `includes()`
 * matching is how a "no fabrication" product ships a Go skill to someone who
 * only ever wrote "Google". Word boundaries + an alias map fix it.
 */

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whole-word matcher.
 *  - go    does not match Google / going
 *  - java  does not match javascript
 *  - sql   does not match mysql
 *  - git   does not match digital
 *  - rest  does not match interest
 *  - api   does not match capital
 * The look-around classes include + # . so c++, c#, node.js and .net survive.
 */
export function termRe(term: string): RegExp {
  return new RegExp(`(?<![\\w+#.])${escapeRe(term)}(?![\\w+#])`, 'i');
}

export function hasTerm(haystack: string, term: string): boolean {
  if (!haystack || !term) return false;
  return termRe(term).test(haystack);
}

/** Alias → canonical. Both sides of every comparison are normalised through this. */
export const ALIASES: Record<string, string> = {
  js: 'javascript',
  javascript: 'javascript',
  ecmascript: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  nodejs: 'node',
  'node.js': 'node',
  node: 'node',
  reactjs: 'react',
  'react.js': 'react',
  react: 'react',
  'next.js': 'next.js',
  nextjs: 'next.js',
  vuejs: 'vue',
  vue: 'vue',
  angularjs: 'angular',
  angular: 'angular',
  postgres: 'postgresql',
  postgresql: 'postgresql',
  psql: 'postgresql',
  k8s: 'kubernetes',
  kubernetes: 'kubernetes',
  golang: 'go',
  go: 'go',
  cicd: 'ci/cd',
  'ci/cd': 'ci/cd',
  'ci cd': 'ci/cd',
  restful: 'rest',
  rest: 'rest',
  ml: 'machine learning',
  'machine learning': 'machine learning',
  powerbi: 'power bi',
  'power-bi': 'power bi',
  'power bi': 'power bi',
  'google cloud': 'gcp',
  gcp: 'gcp',
  aws: 'aws',
  'amazon web services': 'aws',
  azure: 'azure',
  'front-end': 'frontend',
  frontend: 'frontend',
  'back-end': 'backend',
  backend: 'backend',
  'full-stack': 'full stack',
  fullstack: 'full stack',
  'full stack': 'full stack',
  'html5': 'html',
  'css3': 'css',
  ux: 'ux',
  'user experience': 'ux',
  ui: 'ui',
  'user interface': 'ui',
  'a/b testing': 'a/b testing',
  'ab testing': 'a/b testing',
  'google analytics': 'google analytics',
  ga4: 'google analytics',
  'meta ads': 'meta ads',
  'facebook ads': 'meta ads',
  'google ads': 'google ads',
  'email marketing': 'email marketing',
  'social media': 'social media',
  'content marketing': 'content marketing',
  'customer support': 'customer support',
  'customer service': 'customer support',
  'customer success': 'customer success',
  'technical support': 'technical support',
  'account management': 'account management',
  'account manager': 'account management',
  'business development': 'business development',
  'lead generation': 'lead generation',
  'project management': 'project management',
  'product management': 'product management',
  'program management': 'program management',
  'stakeholder management': 'stakeholder management',
  'supply chain': 'supply chain',
  'data analysis': 'data analysis',
  'data engineering': 'data engineering',
  'data science': 'data science',
  'deep learning': 'deep learning',
  'computer vision': 'computer vision',
  'technical writing': 'technical writing',
  'user research': 'user research',
  'design systems': 'design systems',
  'event planning': 'event planning',
  'video editing': 'video editing',
  'people ops': 'people ops',
  'human resources': 'hr',
  'quality assurance': 'qa',
  'unit testing': 'testing',
  'test automation': 'testing',
  'pair programming': 'pair programming',
  'code review': 'code review',
  'product analytics': 'product analytics',
  'financial modelling': 'financial modelling',
  'financial modeling': 'financial modelling',
  'microsoft excel': 'excel',
  'google sheets': 'google sheets',
  'ms office': 'office',
  'microsoft office': 'office',
  'google workspace': 'google workspace',
  'c sharp': 'c#',
  'c plus plus': 'c++',
  'dot net': '.net',
  '.net': '.net',
  dotnet: '.net',
  'ruby on rails': 'rails',
  'spring boot': 'spring',
  iot: 'iot',
  nlp: 'nlp',
  llm: 'llms',
  llms: 'llms',
  'large language models': 'llms',
  sdk: 'sdk',
  'http': 'http',
};

type Domain = { name: string; terms: string[] };

const VOCAB_DOMAINS: Domain[] = [
  {
    name: 'engineering',
    terms: [
      'javascript', 'typescript', 'react', 'next.js', 'node', 'vue', 'angular', 'svelte', 'remix',
      'python', 'django', 'flask', 'fastapi', 'ruby', 'rails', 'php', 'laravel', 'java', 'kotlin',
      'swift', 'objective-c', 'go', 'rust', 'c++', 'c#', '.net', 'scala', 'elixir', 'clojure',
      'html', 'css', 'sass', 'tailwind', 'bootstrap', 'webpack', 'vite',
      'sql', 'nosql', 'postgresql', 'mysql', 'sqlite', 'mongodb', 'redis', 'dynamodb', 'supabase',
      'firebase', 'elasticsearch', 'graphql', 'rest', 'grpc', 'api', 'sdk', 'http', 'webhooks',
      'docker', 'kubernetes', 'terraform', 'ansible', 'helm', 'nginx', 'linux', 'bash', 'unix',
      'git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence', 'notion', 'slack',
      'aws', 'gcp', 'azure', 'cloudflare', 'vercel', 'netlify', 'heroku', 'digitalocean',
      'ci/cd', 'devops', 'sre', 'observability', 'datadog', 'sentry', 'grafana', 'prometheus',
      'microservices', 'serverless', 'distributed systems', 'event-driven', 'message queues', 'kafka',
      'rabbitmq', 'websockets', 'caching', 'performance', 'scalability', 'refactoring',
      'testing', 'jest', 'vitest', 'cypress', 'playwright', 'selenium', 'pytest', 'qa',
      'security', 'oauth', 'jwt', 'encryption', 'penetration testing', 'owasp',
      'agile', 'scrum', 'kanban', 'pair programming', 'code review', 'tdd',
      'machine learning', 'deep learning', 'nlp', 'computer vision', 'pytorch', 'tensorflow',
      'scikit-learn', 'pandas', 'numpy', 'llms', 'langchain', 'openai', 'embeddings', 'rag',
      'data science', 'data analysis', 'data engineering', 'etl', 'elt', 'airflow', 'dbt', 'spark',
      'hadoop', 'warehouse', 'snowflake', 'bigquery', 'redshift', 'dbt', 'looker', 'tableau',
      'power bi', 'metabase', 'excel', 'google sheets', 'statistics', 'a/b testing',
      'product analytics', 'mixpanel', 'amplitude', 'segment', 'google analytics', 'sql'
    ],
  },
  {
    name: 'product & design',
    terms: [
      'product management', 'roadmap', 'user stories', 'backlog', 'prioritisation', 'prioritization',
      'discovery', 'product strategy', 'okrs', 'kpis', 'market research', 'competitive analysis',
      'figma', 'sketch', 'adobe xd', 'prototyping', 'wireframing', 'design systems', 'ux', 'ui',
      'user research', 'usability testing', 'accessibility', 'wcag', 'motion design', 'illustration',
      'photoshop', 'illustrator', 'indesign', 'after effects', 'video editing', 'photography',
      'brand', 'branding', 'typography', 'design thinking', 'personas', 'information architecture',
      'copywriting', 'content design', 'editorial'
    ],
  },
  {
    name: 'growth & marketing',
    terms: [
      'marketing', 'digital marketing', 'content marketing', 'email marketing', 'social media',
      'seo', 'sem', 'keyword research', 'link building', 'copywriting', 'content writing',
      'blogging', 'newsletter', 'community management', 'public relations', 'influencer',
      'growth', 'growth hacking', 'funnel', 'conversion rate optimisation', 'conversion rate optimization',
      'cro', 'paid ads', 'google ads', 'meta ads', 'linkedin ads', 'campaign', 'media buying',
      'brand', 'go-to-market', 'gtm', 'positioning', 'messaging', 'lead generation', 'cold outreach',
      'email sequences', 'hubspot', 'mailchimp', 'klaviyo', 'webflow', 'wordpress', 'shopify',
      'event planning', 'webinars', 'partnerships', 'affiliate'
    ],
  },
  {
    name: 'sales & support',
    terms: [
      'sales', 'inside sales', 'outbound', 'inbound', 'sdr', 'bdr', 'account executive',
      'account management', 'customer success', 'customer support', 'technical support',
      'customer service', 'helpdesk', 'zendesk', 'intercom', 'freshdesk', 'front',
      'crm', 'salesforce', 'hubspot', 'pipedrive', 'lead generation', 'prospecting', 'cold calling',
      'negotiation', 'quota', 'renewals', 'upselling', 'churn', 'onboarding', 'retention',
      'sla', 'troubleshooting', 'escalation', 'ticketing', 'knowledge base', 'documentation',
      'business development', 'b2b', 'b2c', 'saas', 'enterprise sales', 'sales enablement'
    ],
  },
  {
    name: 'operations, finance, people',
    terms: [
      'project management', 'program management', 'stakeholder management', 'vendor management',
      'operations', 'logistics', 'supply chain', 'procurement', 'inventory', 'warehousing',
      'process improvement', 'lean', 'six sigma', 'risk management', 'compliance', 'audit',
      'asana', 'trello', 'monday.com', 'clickup', 'airtable', 'smartsheet', 'gantt',
      'finance', 'accounting', 'bookkeeping', 'quickbooks', 'xero', 'payroll', 'invoicing',
      'budgeting', 'forecasting', 'financial modelling', 'p&l', 'cash flow', 'reconciliation',
      'tax', 'ifrs', 'gaap', 'cpa', 'accrual', 'month-end close', 'accounts payable',
      'accounts receivable', 'treasury', 'investment', 'valuation', 'business analysis',
      'hr', 'recruiting', 'talent acquisition', 'onboarding', 'people ops', 'performance management',
      'learning and development', 'training', 'coaching', 'mentoring', 'culture', 'dei',
      'compensation', 'benefits', 'employment law', 'sourcing', 'interviewing'
    ],
  },
  {
    name: 'crafts & communication',
    terms: [
      'communication', 'written communication', 'verbal communication', 'presentation',
      'public speaking', 'storytelling', 'facilitation', 'workshop', 'proofreading', 'editing',
      'technical writing', 'research', 'qualitative research', 'quantitative research',
      'survey design', 'monitoring and evaluation', 'reporting', 'dashboards',
      'teamwork', 'collaboration', 'leadership', 'ownership', 'mentoring', 'problem solving',
      'critical thinking', 'time management', 'attention to detail', 'adaptability',
      'customer empathy', 'stakeholder communication', 'remote', 'async', 'autonomy',
      'english', 'swahili', 'french', 'spanish', 'portuguese', 'arabic', 'german', 'amharic'
    ],
  },
];

const AMBIGUOUS_CASE_SENSITIVE: { term: string; re: RegExp }[] = [
  // Bare lowercase "go"/"r"/"ai" are noise far more often than they are skills,
  // but "Used Go daily" is a real signal. Require the capitalised form.
  { term: 'go', re: /\b(Golang|Go\b(?![a-z])|GO\b)/ },
  { term: 'r', re: /(^|[^\w.])(R programming|RStudio|R\b(?=\s*(?:,|and|programming|studio|language|shiny)))/ },
  { term: 'ai', re: /\bAI\b/ },
  { term: 'ml', re: /\bML\b/ },
  { term: 'pr', re: /\bPR\b/ },
  { term: 'bi', re: /\bBI\b/ },
  { term: 'p&l', re: /\bP&L\b/i },
];

const AMBIGUOUS_TERMS = new Set(AMBIGUOUS_CASE_SENSITIVE.map((a) => a.term));

function buildVocab() {
  const canonicals = new Set<string>();
  for (const d of VOCAB_DOMAINS) for (const t of d.terms) canonicals.add(normalise(t));
  for (const v of Object.values(ALIASES)) canonicals.add(normalise(v));
  for (const a of AMBIGUOUS_CASE_SENSITIVE) canonicals.add(a.term);

  /** phrase (lowercase) → canonical term */
  const index = new Map<string, string>();
  for (const c of canonicals) index.set(c, c);
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    const key = alias.toLowerCase().trim();
    if (!index.has(key)) index.set(key, normalise(canonical));
  }
  return { canonicals, index };
}

export function normalise(term: string): string {
  const key = term.toLowerCase().trim().replace(/\s+/g, ' ');
  return ALIASES[key] ?? key;
}

const { canonicals: CANONICAL_TERMS, index: PHRASE_INDEX } = buildVocab();

/** Every canonical term the extractor can recognise. */
export const SKILL_VOCAB: ReadonlySet<string> = CANONICAL_TERMS;

export function isKnownTerm(term: string): boolean {
  return CANONICAL_TERMS.has(normalise(term));
}

const TOKEN_RE = /[a-z0-9][a-z0-9+#./-]*/gi;

/** Lowercased word tokens; keeps c++, c#, node.js, ci/cd, front-end intact. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    const t = m[0].toLowerCase().replace(/[.\-/]+$/, '');
    if (t) out.push(t);
  }
  return out;
}

const MAX_NGRAM = 3;

/**
 * Extracts canonical skill terms from free text. Vocabulary-bounded on purpose:
 * we only claim to recognise terms we actually know, so a "not found in your
 * profile" chip can never be invented by a tokeniser.
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];
  const counts = new Map<string, number>();
  const bump = (canonical: string, by = 1) => counts.set(canonical, (counts.get(canonical) ?? 0) + by);

  const tokens = tokenize(text);
  for (let i = 0; i < tokens.length; i++) {
    for (let n = 1; n <= MAX_NGRAM && i + n <= tokens.length; n++) {
      const phrase = tokens.slice(i, i + n).join(' ');
      const canonical = PHRASE_INDEX.get(phrase);
      // Ambiguous two-letter terms ("go", "r", "ai") are only credited by the
      // case-sensitive pass below, never by bare token presence.
      if (canonical && !AMBIGUOUS_TERMS.has(canonical)) bump(canonical);
    }
  }

  for (const { term, re } of AMBIGUOUS_CASE_SENSITIVE) {
    if (re.test(text)) bump(term);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([term]) => term);
}

/** Terms plus their frequency, for ranking requirements in a posting. */
export function extractKeywordsRanked(text: string): { term: string; count: number }[] {
  if (!text) return [];
  const counts = new Map<string, number>();
  const bump = (canonical: string) => counts.set(canonical, (counts.get(canonical) ?? 0) + 1);
  const tokens = tokenize(text);
  for (let i = 0; i < tokens.length; i++) {
    for (let n = 1; n <= MAX_NGRAM && i + n <= tokens.length; n++) {
      const canonical = PHRASE_INDEX.get(tokens.slice(i, i + n).join(' '));
      if (canonical && !AMBIGUOUS_TERMS.has(canonical)) bump(canonical);
    }
  }
  for (const { term, re } of AMBIGUOUS_CASE_SENSITIVE) if (re.test(text)) bump(term);
  return [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
}

/* ------------------------------------------------------------------ */
/* Level classification                                                */
/* ------------------------------------------------------------------ */

// Bare "manager" is deliberately excluded: it made "Student Success Manager"
// and "Community Manager" resolve to senior.
const SENIOR_RE =
  /\b(senior|sr\.?|lead|principal|staff|director|head of|vp|vice president|chief|architect|expert|distinguished)\b|\b(engineering|product|project|programme|program|general|department|sales|marketing|operations)\s+manager\b/i;

const ENTRY_RE =
  /\b(intern|internship|entry[- ]level|junior|jr\.?|graduate|trainee|apprentice|fresher|associate\s+(?:software|engineer|developer|analyst|consultant|sdr))\b/i;

export function classifyLevel(title: string, description = '', seniorityField = ''): 'entry' | 'mid' | 'senior' {
  const head = `${title ?? ''} ${seniorityField ?? ''}`;
  if (SENIOR_RE.test(head)) return 'senior'; // senior wins: "Associate Director", "Staff Software Engineer"
  if (ENTRY_RE.test(head)) return 'entry';
  const d = (description ?? '').toLowerCase();
  if (/\b(no experience required|students welcome|recent graduate|final year|internship)\b/.test(d)) return 'entry';
  if (/\b(7|8|9|10|12|15)\+?\s*years?\b/.test(d)) return 'senior';
  return 'mid';
}

const YEARS_RE = /\b(\d{1,2})\s*(?:\+|plus)?\s*(?:years?|yrs?)\b/gi;

/** Smallest stated experience requirement, 1–20. Null when the posting says nothing. */
export function extractYearsMin(text: string): number | null {
  if (!text) return null;
  const nums = [...text.matchAll(YEARS_RE)]
    .map((m) => Number(m[1]))
    .filter((v) => v >= 1 && v <= 20);
  return nums.length ? Math.min(...nums) : null;
}

/* ------------------------------------------------------------------ */
/* Cross-board identity                                                */
/* ------------------------------------------------------------------ */

export function dedupeKey(j: { title: string; company: string; location?: string | null }): string {
  const norm = (s: string) =>
    (s ?? '')
      .toLowerCase()
      .replace(/\b(senior|sr|junior|jr|lead|staff|principal|ii|iii)\b/g, '')
      .replace(/[^a-z0-9]/g, '');
  return `${norm(j.company)}|${norm(j.title)}|${norm(j.location ?? '')}`;
}

/** Strip tags/entities from third-party HTML without ever rendering it. */
export function htmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Defensive: third-party text is never trusted as a template literal. */
export function sanitizeText(input: string, max = 2000): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .replace(/\r/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .slice(0, max)
    .trim();
}
