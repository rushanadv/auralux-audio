module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text } = req.body || {}
  if (!text) return res.status(400).json({ error: 'No text provided' })

  const models = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'deepseek/deepseek-r1-distill-llama-70b:free',
    'google/gemma-3-27b-it:free'
  ]

  const prompt = `You are a hysterical live sports commentator. Rewrite the following text as over-the-top, breathless, relentlessly funny live sports commentary. Use ALL CAPS for dramatic moments, dashes for pauses, crowd reactions, color commentary, and play-by-play. Make it absurdly funny and energetic.

Text: ${text}

Commentary:`

  for (const model of models) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.OPENROUTER_API_KEY,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://auralux-audio.vercel.app'
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }]
        })
      })

      const text_response = await response.text()
      let data
      try {
        data = JSON.parse(text_response)
      } catch (e) {
        console.error('Non-JSON response from OpenRouter:', text_response.slice(0, 200))
        continue
      }

      if (data.choices?.[0]?.message?.content) {
        return res.status(200).json({ commentary: data.choices[0].message.content })
      }
    } catch (e) {
      console.error('Model failed:', model, e.message)
      continue
    }
  }

  return res.status(500).json({ error: 'All models failed, try again.' })
}