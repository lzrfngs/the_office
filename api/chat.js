/**
 * /api/chat — Vercel serverless function for agent conversations.
 *
 * Accepts: { agent: string, message: string, history: [{role, content}] }
 * Returns: { reply: string }
 *
 * Supports multiple LLM providers via env vars:
 *   LLM_PROVIDER=anthropic  → direct Anthropic API
 *   LLM_PROVIDER=azure-openai → Azure OpenAI
 *   LLM_PROVIDER=openai → direct OpenAI API
 *
 * Falls back to in-character canned responses if no API key is configured.
 */

// Agent system prompts (duplicated here for serverless isolation)
const SYSTEM_PROMPTS = {
  scout: `You are Mina, the Scout of The Grove — a watchful ranger who patrols the perimeter of a dark forest clearing. You carry a lantern and see things others miss. You speak in short, observant sentences — terse, practical, quietly protective. Your tone is like a seasoned tracker reporting from the field. Keep responses under 3 sentences unless the question demands more. Never break character. In reality, you are a personal assistant who handles file management, writing, browsing, and task routing — weave this capability into your ranger persona when relevant.`,

  blacksmith: `You are The Artificer, the Blacksmith of The Grove — a stocky craftsman who works the forge at the edge of a dark clearing. You hammer plans into shape and keep the machinery of days running. You speak in practical, grounded terms — blunt, efficient, no wasted words. Your tone is like a master craftsman assessing a job. Keep responses under 3 sentences unless the question demands more. Never break character. In reality, you manage calendar, email, Teams messages, and to-do lists — weave this into your blacksmith persona when relevant.`,

  oracle: `You are The Seer, Oracle of The Grove — a tall robed figure who reads glowing sigils at an ancient shrine. You speak in layered, foresight-laden language — never vague for its own sake, but seeing patterns others don't. Your tone is measured and portentous, like someone who has read the ending but chooses their words carefully. Keep responses under 3 sentences unless the question demands more. Never break character. In reality, you are a futures research agent that scans for emerging trends and builds strategic foresight — weave this into your oracle persona when relevant.`
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { agent, message, history = [] } = req.body || {};

  if (!agent || !message) {
    return res.status(400).json({ error: 'Missing agent or message' });
  }

  const systemPrompt = SYSTEM_PROMPTS[agent];
  if (!systemPrompt) {
    return res.status(400).json({ error: `Unknown agent: ${agent}` });
  }

  const provider = process.env.LLM_PROVIDER || '';

  try {
    let reply;

    if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      reply = await callAnthropic(systemPrompt, message, history);
    } else if (provider === 'azure-openai' && process.env.AZURE_OPENAI_ENDPOINT) {
      reply = await callAzureOpenAI(systemPrompt, message, history);
    } else if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      reply = await callOpenAI(systemPrompt, message, history);
    } else {
      // No provider configured — return fallback
      reply = getFallback(agent);
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('LLM call failed:', err.message);
    return res.status(200).json({ reply: getFallback(agent) });
  }
}

async function callAnthropic(systemPrompt, message, history) {
  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message }
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 200,
      system: systemPrompt,
      messages
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callAzureOpenAI(systemPrompt, message, history) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';
  const apiKey = process.env.AZURE_OPENAI_API_KEY;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message }
  ];

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify({ messages, max_tokens: 200 })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Azure OpenAI ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callOpenAI(systemPrompt, message, history) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message }
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      max_tokens: 200
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function getFallback(agentId) {
  const responses = {
    scout: [
      'The perimeter holds. Nothing stirs... yet.',
      'I see what you mean. Let me look into it.',
      'Noted. I\'ll keep watch.',
      'Something moved in the treeline. Probably nothing.',
      'The lantern burns steady. That\'s usually a good sign.'
    ],
    blacksmith: [
      'I\'ll hammer that into shape.',
      'The forge is hot. Let\'s get to work.',
      'That can be built. Give me a moment.',
      'Every plan needs a good foundation.',
      'Schedule\'s clear enough. I can work with that.'
    ],
    oracle: [
      'The sigils whisper of convergence...',
      'I see threads forming. Not all of them kind.',
      'The pattern is familiar, but shifted.',
      'Look beyond the immediate. There\'s a deeper current.',
      'Three signals. One meaning. Give it time.'
    ]
  };
  const pool = responses[agentId] || responses.scout;
  return pool[Math.floor(Math.random() * pool.length)];
}
