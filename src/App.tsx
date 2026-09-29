import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Preset = {
  label: string
  prompt: string
}

const presets: Preset[] = [
  {
    label: 'Tesla / TSLA',
    prompt: 'Analyze Tesla (TSLA) using this three-day share-price data:\nDay 1 — Open: $223.98, Close: $225.10\nDay 2 — Open: $225.10, Close: $220.42\nDay 3 — Open: $220.42, Close: $202.11',
  },
  {
    label: 'Apple / AAPL',
    prompt: 'Analyze Apple (AAPL) using this three-day share-price data:\nDay 1 — Open: $150.22, Close: $160.40\nDay 2 — Open: $160.40, Close: $170.80\nDay 3 — Open: $170.80, Close: $175.36',
  },
  {
    label: 'Custom analysis',
    prompt: 'Analyze this stock using the last three days of share-price data:\nTicker: \nDay 1 — Open: $, Close: $\nDay 2 — Open: $, Close: $\nDay 3 — Open: $, Close: $\n\nGive an educational buy, hold, or sell view with the key risks.',
  },
]

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    const savedTheme = window.localStorage.getItem('promptly-theme')
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [prompt, setPrompt] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [temperature, setTemperature] = useState(0.7)
  const [frequencyPenalty, setFrequencyPenalty] = useState(0)
  const [presencePenalty, setPresencePenalty] = useState(0)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('promptly-theme', theme)
  }, [theme])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!prompt.trim() || isLoading) return

    setIsLoading(true)
    setError('')
    setOutput('')

    try {
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          temperature,
          frequency_penalty: frequencyPenalty,
          presence_penalty: presencePenalty,
        }),
      })
      const responseText = await response.text()
      let data: { output?: string; error?: string }
      try {
        data = JSON.parse(responseText) as { output?: string; error?: string }
      } catch {
        throw new Error(`The server returned an unexpected response (HTTP ${response.status}).`)
      }

      if (!response.ok) {
        throw new Error(data.error ?? 'Something went wrong. Please try again.')
      }

      setOutput(data.output ?? '')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to reach the AI worker.')
    } finally {
      setIsLoading(false)
    }
  }

  function applyPreset(preset: Preset) {
    setPrompt(preset.prompt)
    setOutput('')
    setError('')
  }

  return (
    <main className="app-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="/" aria-label="Promptly home">
          <span className="brand-mark">P</span>
          <span>marketly</span>
        </a>
        <div className="nav-actions">
          <div className="status-pill"><span className="status-dot" /> Worker online</div>
          <button
            className="theme-toggle"
            type="button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            <span aria-hidden="true">{theme === 'light' ? '☾' : '☀'}</span>
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
        </div>
      </nav>

      <section className="hero-copy">
        <p className="eyebrow">AI TRADING ANALYSIS</p>
        <h1>Read the market<br /><em>before it moves.</em></h1>
        <p className="intro">Paste three days of share-price data and get a focused performance report with an educational buy, hold, or sell view.</p>
      </section>

      <section className="workspace" aria-label="AI prompt workspace">
        <div className="workspace-header">
          <div>
            <p className="section-label">01 / Market data</p>
            <h2>Which stock are you watching?</h2>
          </div>
          <div className="preset-list" aria-label="Prompt presets">
            {presets.map((preset) => (
              <button className="preset-button" key={preset.label} type="button" onClick={() => applyPreset(preset)}>
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="prompt-card">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Paste a ticker and three days of open and close prices..."
              aria-label="Stock market data and analysis prompt"
              maxLength={4000}
            />
            <div className="prompt-footer">
              <span className="character-count">{prompt.length} / 4000 · 3-day snapshot</span>
              <button className="submit-button" type="submit" disabled={!prompt.trim() || isLoading}>
                {isLoading ? 'Thinking...' : 'Generate response'}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          </div>

          <div className="controls">
            <label>
              <span>Temperature <strong>{temperature.toFixed(1)}</strong></span>
              <input type="range" min="0" max="2" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} />
            </label>
            <label>
              <span>Frequency penalty <strong>{frequencyPenalty.toFixed(1)}</strong></span>
              <input type="range" min="-2" max="2" step="0.1" value={frequencyPenalty} onChange={(event) => setFrequencyPenalty(Number(event.target.value))} />
            </label>
            <label>
              <span>Presence penalty <strong>{presencePenalty.toFixed(1)}</strong></span>
              <input type="range" min="-2" max="2" step="0.1" value={presencePenalty} onChange={(event) => setPresencePenalty(Number(event.target.value))} />
            </label>
          </div>
        </form>
      </section>

      <section className={`response-panel ${output || error || isLoading ? 'has-content' : ''}`} aria-live="polite">
        <div className="response-heading">
          <p className="section-label">02 / Market read</p>
          {output && <span className="response-meta">Generated by GPT-4o mini</span>}
        </div>
        {isLoading && <div className="loading-state"><span className="loader" /> Creating your response...</div>}
        {error && <p className="error-message">{error}</p>}
        {!isLoading && !error && output && <p className="output-text">{output}</p>}
        {!isLoading && !error && !output && <p className="empty-state">Your performance summary, signal, and risk notes will appear here.</p>}
      </section>

      <footer className="footer-note">
        <span>Built for thoughtful experiments.</span>
        <span>Educational analysis · Not financial advice</span>
      </footer>
    </main>
  )
}

export default App
