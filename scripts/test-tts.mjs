/* One-off test: generate a short ENGLISH speech WAV via the ZAI SDK (dev only). */
import { writeFileSync } from 'node:fs'

const ZAI = (await import('z-ai-web-dev-sdk')).default
const zai = await ZAI.create()

const text =
  'Welcome to our weekly product meeting. We decided the new smart audio feature launches on Sunday. ' +
  'Mohammed will handle the cloud deployment, and Alia will redesign the dashboard interface. ' +
  'The marketing team will prepare the launch announcement by Friday. Thank you all.'

const res = await zai.audio.tts.create({ input: text, response_format: 'wav' })
const buf = Buffer.from(await res.arrayBuffer())
writeFileSync('/tmp/qtb-test-en.wav', buf)
console.log('saved /tmp/qtb-test-en.wav bytes=', buf.length)
