import express from 'express'
import cors from 'cors'
import { spawn, execFile } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())

// Find yt-dlp binary (local yt-dlp.exe on Windows, or global /usr/local/bin/yt-dlp on Linux)
const localExe = path.resolve(__dirname, 'yt-dlp.exe')
const binary = fs.existsSync(localExe) ? localExe : 'yt-dlp'

// 1. Search endpoint
app.get('/api/search', (req, res) => {
  const query = req.query.q
  if (!query || !query.trim()) {
    return res.json([])
  }

  execFile(
    binary,
    [`ytsearch12:${query}`, '--dump-json', '--flat-playlist', '--no-warnings'],
    { maxBuffer: 15 * 1024 * 1024 },
    (err, stdout) => {
      if (err) return res.json([])
      const lines = stdout.trim().split('\n').filter(Boolean)
      const results = lines
        .map((line) => {
          try {
            const j = JSON.parse(line)
            return {
              id: `yt-${j.id}`,
              title: j.title || 'Untitled Track',
              artist: j.uploader || j.channel || 'YouTube Artist',
              duration: j.duration || 180,
              thumbnailUrl:
                j.thumbnail ||
                j.thumbnails?.[0]?.url ||
                `https://img.youtube.com/vi/${j.id}/mqdefault.jpg`,
              platform: 'youtube',
              url: `https://www.youtube.com/watch?v=${j.id}`,
            }
          } catch {
            return null
          }
        })
        .filter(Boolean)
      res.json(results)
    }
  )
})

// 2. Track Info endpoint
app.get('/api/info', (req, res) => {
  const targetUrl = req.query.url
  if (!targetUrl) return res.status(400).json({ error: 'Missing url parameter' })

  execFile(
    binary,
    [targetUrl, '--dump-json', '--no-playlist', '--no-warnings'],
    { maxBuffer: 10 * 1024 * 1024 },
    (err, stdout) => {
      if (err) return res.status(500).json({ error: err.message })
      try {
        const j = JSON.parse(stdout)
        res.json({
          id: j.id,
          title: j.title,
          artist: j.uploader || j.channel || 'Artist',
          duration: j.duration || 180,
          thumbnailUrl:
            j.thumbnail ||
            j.thumbnails?.[0]?.url ||
            `https://img.youtube.com/vi/${j.id}/hqdefault.jpg`,
          platform: targetUrl.includes('soundcloud.com') ? 'soundcloud' : 'youtube',
          url: targetUrl,
        })
      } catch {
        res.status(500).json({ error: 'Failed to parse metadata' })
      }
    }
  )
})

// 3. Audio Stream endpoint: Streams actual audio bytes directly to the client
app.get('/api/stream', (req, res) => {
  const targetUrl = req.query.url
  if (!targetUrl) return res.status(400).send('Missing url parameter')

  res.setHeader('Content-Type', 'audio/webm')

  const proc = spawn(binary, [
    '-f',
    'bestaudio',
    '-o',
    '-',
    '--no-playlist',
    '--no-warnings',
    targetUrl,
  ])

  proc.stdout.pipe(res)

  req.on('close', () => {
    try {
      proc.kill()
    } catch {
      // ignore
    }
  })
})

// Serve static production build from /dist
const distPath = path.resolve(__dirname, 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`DeshDJ Audio Streaming Server running on port ${PORT}`)
})
