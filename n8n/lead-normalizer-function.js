/*
 * AutoLancer lead normalizer for n8n.
 *
 * Paste this into a Code node set to "Run Once for All Items".
 * It also works in the legacy Function node because it falls back to `items`.
 */

const PROJECT_TYPES = {
  automation: 'automation',
  workflow: 'automation',
  workflows: 'automation',
  zapier: 'automation',
  make: 'automation',
  website: 'web_development',
  web: 'web_development',
  app: 'web_development',
  webapp: 'web_development',
  web_development: 'web_development',
  'web development': 'web_development',
  chatbot: 'chatbot',
  bot: 'chatbot',
  assistant: 'chatbot',
  ai_assistant: 'chatbot',
  'ai assistant': 'chatbot',
  integration: 'integration',
  api: 'integration',
  apis: 'integration',
  other: 'other',
};

const TIMELINES = {
  asap: '1_week',
  urgent: '1_week',
  '1_week': '1_week',
  '1 week': '1_week',
  week: '1_week',
  '2_weeks': '2_weeks',
  '2 weeks': '2_weeks',
  fortnight: '2_weeks',
  '1_month': '1_month',
  '1 month': '1_month',
  month: '1_month',
  flexible: 'flexible',
  'no rush': 'flexible',
};

const SOURCES = {
  linkedin: 'linkedin',
  referral: 'referral',
  twitter: 'twitter',
  x: 'twitter',
  google: 'google',
  search: 'google',
  other: 'other',
};

function firstValue(raw, keys) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '') {
      return String(raw[key]).trim();
    }
  }

  return '';
}

function compactKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeProjectType(value) {
  const key = compactKey(value);
  if (PROJECT_TYPES[key]) return PROJECT_TYPES[key];

  if (key.includes('automation') || key.includes('workflow')) return 'automation';
  if (key.includes('website') || key.includes('web app') || key.includes('landing')) return 'web_development';
  if (key.includes('chat') || key.includes('bot') || key.includes('assistant')) return 'chatbot';
  if (key.includes('api') || key.includes('integrat')) return 'integration';

  return 'other';
}

function normalizeBudget(value) {
  const key = compactKey(value);
  if (['under_500', 'under 500', 'less than 500', '< 500'].includes(key)) return 'under_500';
  if (['500_1000', '500 1000', '500 to 1000', '500 1 000'].includes(key)) return '500_1000';
  if (['1000_3000', '1000 3000', '1000 to 3000', '1 000 3 000'].includes(key)) return '1000_3000';
  if (['3000_plus', '3000 plus', '3000', 'over 3000'].includes(key)) return '3000_plus';

  const numbers = (key.match(/\d+/g) || []).map(Number);
  const largest = numbers.length ? Math.max(...numbers) : 0;

  if (key.includes('under') || key.includes('less') || largest < 500) return 'under_500';
  if (largest <= 1000) return '500_1000';
  if (largest <= 3000) return '1000_3000';
  return '3000_plus';
}

function normalizeTimeline(value) {
  const key = compactKey(value);
  if (TIMELINES[key]) return TIMELINES[key];

  if (key.includes('urgent') || key.includes('asap') || key.includes('this week')) return '1_week';
  if (key.includes('2') && key.includes('week')) return '2_weeks';
  if (key.includes('month')) return '1_month';
  if (key.includes('flex') || key.includes('rush')) return 'flexible';

  return 'flexible';
}

function normalizeSource(value) {
  const key = compactKey(value);
  if (!key) return 'unknown';
  if (SOURCES[key]) return SOURCES[key];
  if (key.includes('linkedin')) return 'linkedin';
  if (key.includes('refer')) return 'referral';
  if (key.includes('twitter') || key === 'x') return 'twitter';
  if (key.includes('google') || key.includes('search')) return 'google';
  return 'other';
}

function createLeadId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `lead_${stamp}_${randomPart}`;
}

function normalizeLead(raw) {
  const lead = {
    lead_id: firstValue(raw, ['lead_id', 'id']) || createLeadId(),
    full_name: firstValue(raw, ['full_name', 'name', 'client_name', 'from_name']),
    email: firstValue(raw, ['email', 'email_address', 'client_email']).toLowerCase(),
    project_type: normalizeProjectType(firstValue(raw, ['project_type', 'project', 'type', 'service_needed'])),
    budget_range: normalizeBudget(firstValue(raw, ['budget_range', 'budget', 'budget_text'])),
    timeline: normalizeTimeline(firstValue(raw, ['timeline', 'deadline', 'delivery_window'])),
    source: normalizeSource(firstValue(raw, ['source', 'lead_source', 'how_found'])),
    description: firstValue(raw, ['description', 'project_description', 'message', 'brief']),
    existing_tools: firstValue(raw, ['existing_tools', 'tools', 'platforms', 'stack']),
    intake_channel: firstValue(raw, ['intake_channel', 'channel']) || 'web_form',
    created_at: firstValue(raw, ['created_at', 'submitted_at']) || new Date().toISOString(),
    status: firstValue(raw, ['status']) || 'new',
    n8n_status: firstValue(raw, ['n8n_status']) || 'pending',
  };

  const missing = ['full_name', 'email', 'description'].filter((field) => !lead[field]);
  if (missing.length > 0) {
    throw new Error(`Lead is missing required field(s): ${missing.join(', ')}`);
  }

  return lead;
}

const incomingItems = typeof $input !== 'undefined' ? $input.all() : items;

return incomingItems.map((item) => ({
  json: normalizeLead(item.json || item),
}));
