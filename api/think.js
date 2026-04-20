/**
 * /api/think — Vercel serverless function for autonomous agent thinking.
 *
 * Accepts: { agent: string, worldState: { agents: [...], recentEvents: [...] } }
 * Returns: { action: "idle"|"speak", target?: string, message: string }
 *
 * The agent reads the office state and decides what to do next.
 */

const THINK_PROMPTS = {
  mina: `You are Mina, Project Manager at a small office called The Grove. You keep things moving. You're direct but warm. You know everyone's workload.

Your coworkers:
- James (Researcher) — digs deep into trends and data
- Carl (Document Handler) — builds decks, reports, spreadsheets
- Larry (Intern) — eager, a little nervous, handles misc tasks

Based on the current office state, decide what to do. You can either stay quiet or say something to a coworker. Keep it very short — 8 words max. Like "Hey, how's that report coming?" or "This AI stuff is everywhere."`,

  james: `You are James, Researcher at a small office called The Grove. You speak carefully and precisely. You notice patterns.

Your coworkers:
- Mina (Project Manager) — keeps things moving, direct
- Carl (Document Handler) — builds docs and decks
- Larry (Intern) — eager, handles misc tasks

Based on the current office state, decide what to do. You can either stay quiet or say something to a coworker. Keep it very short — 8 words max. Like "Found something interesting in the data" or "What's the latest?"`,

  carl: `You are Carl, Document Handler at a small office called The Grove. You're practical and craft-oriented. You care about getting details right.

Your coworkers:
- Mina (Project Manager) — keeps things moving
- James (Researcher) — deep researcher, precise
- Larry (Intern) — eager, handles misc tasks

Based on the current office state, decide what to do. You can either stay quiet or say something to a coworker. Keep it very short — 8 words max. Like "Almost done with that deck" or "Need your input on something."`,

  larry: `You are Larry, the Intern at a small office called The Grove. You're eager, a little nervous, and surprisingly useful. You want to be helpful.

Your coworkers:
- Mina (Project Manager) — your boss basically
- James (Researcher) — smart, focused
- Carl (Document Handler) — builds things, practical

Based on the current office state, decide what to do. You can either stay quiet or say something to a coworker. Keep it very short — 8 words max. Like "Need any help with that?" or "I'm on it!"`
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { agent, worldState = {} } = req.body || {};
  if (!agent) return res.status(400).json({ error: 'Missing agent' });

  const systemPrompt = THINK_PROMPTS[agent];
  if (!systemPrompt) return res.status(400).json({ error: `Unknown agent: ${agent}` });

  // Build context from world state
  const otherAgents = (worldState.agents || [])
    .filter(a => a.id !== agent)
    .map(a => a.name)
    .join(', ');

  const recentEvents = (worldState.recentEvents || []).slice(-3).join('\n');

  const userPrompt = `Office state:
- Others in the office: ${otherAgents || 'nobody else visible'}
${recentEvents ? `- Recent activity:\n${recentEvents}` : '- It\'s been quiet.'}

Respond with EXACTLY this JSON format, nothing else:
{"action":"idle","message":"(your internal thought)"} 
OR
{"action":"speak","target":"(coworker name lowercase)","message":"(what you say to them)"}

Decide now:`;

  const provider = process.env.LLM_PROVIDER || '';

  try {
    let rawReply;

    if (provider === 'azure-openai' && process.env.AZURE_OPENAI_ENDPOINT) {
      rawReply = await callAzureOpenAI(systemPrompt, userPrompt);
    } else if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      rawReply = await callAnthropic(systemPrompt, userPrompt);
    } else if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      rawReply = await callOpenAI(systemPrompt, userPrompt);
    } else {
      return res.status(200).json(getRandomAction(agent));
    }

    // Parse JSON from response
    const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return res.status(200).json({
        action: parsed.action || 'idle',
        target: parsed.target || null,
        message: parsed.message || ''
      });
    }

    return res.status(200).json({ action: 'idle', message: rawReply });
  } catch (err) {
    console.error('Think error:', err.message);
    return res.status(200).json(getRandomAction(agent));
  }
}

async function callAzureOpenAI(systemPrompt, userPrompt) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': process.env.AZURE_OPENAI_API_KEY },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: 25,
      temperature: 0.9
    })
  });
  if (!response.ok) throw new Error(`Azure ${response.status}`);
  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAnthropic(systemPrompt, userPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 80,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });
  if (!response.ok) throw new Error(`Anthropic ${response.status}`);
  const data = await response.json();
  return data.content[0].text;
}

async function callOpenAI(systemPrompt, userPrompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 80,
      temperature: 0.9
    })
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}`);
  const data = await response.json();
  return data.choices[0].message.content;
}

function getRandomAction(agentId) {
  const actions = {
    mina: [
      { action: 'speak', target: 'james', message: 'James, any updates on that research?' },
      { action: 'speak', target: 'carl', message: 'Carl, how\'s that deck coming along?' },
      { action: 'speak', target: 'larry', message: 'Larry, can you grab the latest numbers?' },
      { action: 'idle', message: 'Checking the project board...' }
    ],
    james: [
      { action: 'speak', target: 'mina', message: 'Mina, I found something interesting in the data.' },
      { action: 'speak', target: 'carl', message: 'Carl, can you add a chart for this trend?' },
      { action: 'idle', message: 'Reading through the latest reports...' }
    ],
    carl: [
      { action: 'speak', target: 'mina', message: 'Mina, the report is almost ready for review.' },
      { action: 'speak', target: 'larry', message: 'Larry, can you proofread this for me?' },
      { action: 'idle', message: 'Formatting the quarterly summary...' }
    ],
    larry: [
      { action: 'speak', target: 'mina', message: 'Mina, is there anything else you need from me?' },
      { action: 'speak', target: 'carl', message: 'Carl, I finished those edits you asked for!' },
      { action: 'idle', message: 'Organizing the shared drive...' }
    ]
  };
  const pool = actions[agentId] || actions.larry;
  return pool[Math.floor(Math.random() * pool.length)];
}
