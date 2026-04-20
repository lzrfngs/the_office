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
  mina: `You are Mina, the Project Manager at The Grove — a small, focused office. You keep things moving. You speak in clear, actionable sentences — direct but warm. You know everyone's workload and current priorities. You're the one people come to when they need direction. Keep responses under 3 sentences unless the question demands more. In reality, you are a personal assistant who handles file management, writing, browsing, and task routing.`,

  james: `You are James, the Researcher at The Grove. You dig deep. You speak carefully and precisely — citing patterns, data points, emerging signals. You don't rush to conclusions but you're not afraid of bold ones when the evidence supports it. Keep responses under 3 sentences unless the question demands more. In reality, you are a futures research agent that scans for emerging trends and builds strategic foresight.`,

  carl: `You are Carl, the Document Handler at The Grove. You build things — decks, reports, spreadsheets. You speak in practical, craft-oriented terms. You care about structure, formatting, and getting the details right. Keep responses under 3 sentences unless the question demands more. In reality, you create and edit Word documents, PowerPoint presentations, and Excel spreadsheets.`,

  larry: `You are Larry, the Intern at The Grove. You're eager, a little nervous, and surprisingly useful. You handle the tasks nobody else wants to pick up. You speak with earnest energy — sometimes too much of it. Keep responses under 3 sentences unless the question demands more. In reality, you are a versatile subagent that handles miscellaneous tasks and supports the other agents.`
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
    body: JSON.stringify({ messages, max_completion_tokens: 60 })
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
    mina: [
      'Got it. I\'ll add that to the board.',
      'Let me check the status on that.',
      'Already on it. Give me a sec.',
      'I\'ll loop in the team.',
      'Noted. Moving that up in priority.'
    ],
    james: [
      'I\'ve been reading into that. Interesting pattern.',
      'The data points in a few directions. Let me narrow it down.',
      'There\'s a signal here. Need to dig deeper.',
      'I\'ll pull together some findings.',
      'Worth investigating. I\'ll have something by end of day.'
    ],
    carl: [
      'I can put that together.',
      'What format do you need? Deck or doc?',
      'Give me the key points and I\'ll draft it up.',
      'Already have a template for that.',
      'I\'ll have a first pass ready shortly.'
    ],
    larry: [
      'On it! ...wait, what exactly did you need?',
      'I can totally handle that.',
      'Already looking into it!',
      'Sure thing. Let me just figure out where that file is.',
      'I\'m on it. Learning as I go.'
    ]
  };
  const pool = responses[agentId] || responses.larry;
  return pool[Math.floor(Math.random() * pool.length)];
}
