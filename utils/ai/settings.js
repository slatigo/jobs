const { AiSetting } = require('../../models');
const { decrypt, encrypt, mask } = require('./secrets');

const MODEL_PRESETS = {
  gemini: ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
  anthropic: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-1']
};

async function getSettings() {
  const [row] = await AiSetting.findOrCreate({
    where: { id: 1 },
    defaults: { id: 1 }
  });
  return row;
}

function resolveRawKey(row, provider) {
  if (provider === 'anthropic') {
    if (row.anthropicKeyEnc) {
      try { return decrypt(row.anthropicKeyEnc); } catch (e) { /* ignore */ }
    }
    return process.env.ANTHROPIC_API_KEY || '';
  }
  if (row.geminiKeyEnc) {
    try { return decrypt(row.geminiKeyEnc); } catch (e) { /* ignore */ }
  }
  return process.env.GEMINI_API_KEY || '';
}

function publicSettings(row) {
  let geminiMask = '';
  let anthropicMask = '';
  try {
    const gKey = resolveRawKey(row, 'gemini');
    geminiMask = gKey ? mask(gKey) : '';
  } catch (err) {
    geminiMask = row.geminiKeyEnc ? 'saved key could not be read' : '';
  }
  try {
    const aKey = resolveRawKey(row, 'anthropic');
    anthropicMask = aKey ? mask(aKey) : '';
  } catch (err) {
    anthropicMask = row.anthropicKeyEnc ? 'saved key could not be read' : '';
  }

  const activeProvider = row.activeProvider === 'anthropic' ? 'anthropic' : 'gemini';
  const activeConfigured = activeProvider === 'anthropic'
    ? Boolean(anthropicMask)
    : Boolean(geminiMask);

  return {
    activeProvider,
    activeConfigured,
    geminiModel: row.geminiModel,
    anthropicModel: row.anthropicModel,
    geminiConfigured: Boolean(geminiMask),
    anthropicConfigured: Boolean(anthropicMask),
    geminiMask,
    anthropicMask,
    presets: MODEL_PRESETS
  };
}

async function activeCredential() {
  const row = await getSettings();
  const provider = row.activeProvider === 'anthropic' ? 'anthropic' : 'gemini';
  const model = provider === 'anthropic' ? row.anthropicModel : row.geminiModel;
  const apiKey = resolveRawKey(row, provider);
  if (!apiKey) {
    const name = provider === 'anthropic' ? 'Claude (Anthropic)' : 'Google Gemini';
    throw new Error(`${name} is the active AI provider, but no API key is configured yet. Go to Admin → AI Settings to add your API key.`);
  }
  return { provider, model, apiKey };
}

async function saveSettings({ body, userId }) {
  const row = await getSettings();
  row.activeProvider = body.activeProvider === 'anthropic' ? 'anthropic' : 'gemini';
  row.geminiModel = String(body.geminiModel || '').trim().slice(0, 80) || 'gemini-2.5-flash';
  row.anthropicModel = String(body.anthropicModel || '').trim().slice(0, 80) || 'claude-sonnet-4-5';
  row.updatedByUserId = userId;

  if (body.clearGemini === '1') row.geminiKeyEnc = null;
  else if (body.geminiKey && String(body.geminiKey).trim()) row.geminiKeyEnc = encrypt(String(body.geminiKey).trim());

  if (body.clearAnthropic === '1') row.anthropicKeyEnc = null;
  else if (body.anthropicKey && String(body.anthropicKey).trim()) row.anthropicKeyEnc = encrypt(String(body.anthropicKey).trim());

  await row.save();
  return row;
}

const JUDGEMENT_MAP = {
  advance: { code: 'pass', label: 'Pass', sublabel: 'Eligible · Advance', badgeClass: 'ai-judgement-pass' },
  hold: { code: 'hold', label: 'Hold / Review', sublabel: 'Unclear · Verify', badgeClass: 'ai-judgement-hold' },
  do_not_advance: { code: 'fail', label: 'Fail', sublabel: 'Not Eligible', badgeClass: 'ai-judgement-fail' }
};

function present(screening) {
  if (!screening) return null;
  let checklist = [];
  try { checklist = JSON.parse(screening.checklistJson); } catch (err) { checklist = []; }

  const mandatoryItems = checklist.filter((i) => i.group === 'Mandatory');
  const mandatoryMet = mandatoryItems.filter((i) => i.result === 'met').length;
  const judgement = JUDGEMENT_MAP[screening.recommendation] || JUDGEMENT_MAP.hold;

  return {
    id: screening.id,
    recommendation: screening.recommendation,
    judgement: judgement.label,
    judgementCode: judgement.code,
    judgementSublabel: judgement.sublabel,
    mandatoryMet,
    mandatoryTotal: mandatoryItems.length,
    suggestedStageKey: screening.suggestedStageKey,
    summary: screening.summary,
    checklist,
    documentNote: screening.documentNote,
    confidence: screening.confidence,
    provider: screening.provider,
    model: screening.model,
    hrDecision: screening.hrDecision,
    createdAt: screening.createdAt
  };
}

module.exports = {
  MODEL_PRESETS,
  JUDGEMENT_MAP,
  getSettings,
  publicSettings,
  activeCredential,
  saveSettings,
  present
};
