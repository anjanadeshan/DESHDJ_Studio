import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { spawn, execFile } from 'child_process'
import path from 'path'
import fs from 'fs'

function getAudioStreamPlugin(): Plugin {
  return {
    name: 'audio-stream-plugin',
    configureServer(server) {
      const localExe = path.resolve(process.cwd(), 'yt-dlp.exe')
      const binary = fs.existsSync(localExe) ? localExe : 'yt-dlp'

      // 1. YouTube & SoundCloud Search endpoint
      server.middlewares.use('/api/search', (req, res) => {
        const urlObj = new URL(req.url || '', 'http://localhost')
        const query = urlObj.searchParams.get('q') || ''
        if (!query.trim()) {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify([]))
          return
        }

        execFile(
          binary,
          [`ytsearch12:${query}`, '--dump-json', '--flat-playlist', '--no-warnings'],
          { maxBuffer: 15 * 1024 * 1024 },
          (err, stdout) => {
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
            if (err) {
              res.end(JSON.stringify([]))
              return
            }
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
            res.end(JSON.stringify(results))
          }
        )
      })

      // 2. Video / Track Info endpoint
      server.middlewares.use('/api/info', (req, res) => {
        const urlObj = new URL(req.url || '', 'http://localhost')
        const targetUrl = urlObj.searchParams.get('url')
        if (!targetUrl) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Missing url parameter' }))
          return
        }

        execFile(
          binary,
          [targetUrl, '--dump-json', '--no-playlist', '--no-warnings'],
          { maxBuffer: 10 * 1024 * 1024 },
          (err, stdout) => {
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
            if (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message }))
              return
            }
            try {
              const j = JSON.parse(stdout)
              res.end(
                JSON.stringify({
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
              )
            } catch {
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'Failed to parse metadata' }))
            }
          }
        )
      })

      // 3. Audio stream endpoint: Streams actual audio bytes directly to the browser
      server.middlewares.use('/api/stream', (req, res) => {
        const urlObj = new URL(req.url || '', 'http://localhost')
        const targetUrl = urlObj.searchParams.get('url')
        if (!targetUrl) {
          res.statusCode = 400
          res.end('Missing url parameter')
          return
        }

        res.setHeader('Access-Control-Allow-Origin', '*')
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

        proc.stderr.on('data', () => {
          // ignore or debug
        })

        req.on('close', () => {
          try {
            proc.kill()
          } catch {
            // ignore
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), getAudioStreamPlugin()],
  build: {
    emptyOutDir: false,
  },
})
