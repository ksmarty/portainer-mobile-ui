// Generates PWA icons with no dependencies (pure Node).
// Draws a rounded-square tile with a vertical gradient (accent -> purple) and
// a white "container box" glyph, then writes PNGs with a from-scratch encoder.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

// ---- minimal PNG encoder ----------------------------------------------
function crc32(buf) {
  let c
  if (!crc32.table) {
    crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crc32.table[n] = c
    }
  }
  c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crc32.table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(8)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([out.subarray(4, 8), data])))
  return Buffer.concat([out, data, crc])
}

function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6 // RGBA
  const stride = w * 4
  const raw = Buffer.alloc((stride + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

// Signed distance to a rounded rectangle (negative inside).
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r)
  const qy = Math.abs(py - cy) - (hh - r)
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(ox, oy) - r
}

const hex = (s) => [s.slice(1, 3), s.slice(3, 5), s.slice(5, 7)].map((v) => parseInt(v, 16))
const TOP = hex('#3d7bfd')
const BOT = hex('#a78bfa')

function render(size, { maskable = false, opaque = false } = {}) {
  const s = size
  const buf = Buffer.alloc(s * s * 4)
  const c = s / 2
  const pad = (maskable ? 0.22 : 0.18) * s
  const tile = s - pad * 2
  const tileR = tile * 0.22
  const hw = tile / 2
  const hh = tile / 2
  const stroke = Math.max(2, tile * 0.05)
  const rg = tile * 0.07
  // glyph: rounded-rect frame + a small "lid" bar
  const gw = tile * 0.42
  const gh = tile * 0.3
  const gx = c
  const gy = c + tile * 0.02
  const barX = c
  const barY = gy - gh * 0.12
  const barW = gw * 0.7
  const barH = gh * 0.16

  for (let y = 0; y < s; y++) {
    const v = y / s
    const r = Math.round(TOP[0] + (BOT[0] - TOP[0]) * v)
    const g = Math.round(TOP[1] + (BOT[1] - TOP[1]) * v)
    const b = Math.round(TOP[2] + (BOT[2] - TOP[2]) * v)
    for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4
      if (sdRoundRect(x + 0.5, y + 0.5, c, c, hw, hh, tileR) > 0) {
        buf[i + 3] = opaque ? 255 : 0
        continue
      }
      buf[i] = r
      buf[i + 1] = g
      buf[i + 2] = b
      buf[i + 3] = 255
      const frame = Math.abs(sdRoundRect(x + 0.5, y + 0.5, gx, gy, gw, gh, rg)) <= stroke
      const bar = sdRoundRect(x + 0.5, y + 0.5, barX, barY, barW, barH, rg) <= 0
      if (frame || bar) {
        buf[i] = 255
        buf[i + 1] = 255
        buf[i + 2] = 255
      }
    }
  }
  return buf
}


const out = new URL('../public/', import.meta.url).pathname
const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, { opaque: true }],
]
for (const [name, size, opts] of targets) {
  writeFileSync(out + name, encodePNG(size, size, render(size, opts)))
  console.log('wrote public/' + name, size + 'x' + size)
}