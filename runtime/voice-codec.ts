import { Worker } from 'node:worker_threads'
import { createRequire } from 'node:module'
import { join } from 'node:path'

// WAV comes straight from Android TTS. No ffmpeg, executable or native addon is
// needed on the guest. A worker bounds malformed input / encoder stalls without
// blocking message processing or inheriting any TTS credentials.
const encoder = `
const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  const { encode, isWav, getWavFileInfo, isSilk } = require(workerData.codec);
  const wav = workerData.wav;
  if (!isWav(wav)) throw new Error('Expected WAV');
  const { fmt, chunkInfo } = getWavFileInfo(wav);
  const data = chunkInfo.find(chunk => chunk.chunkId === 'data');
  if (fmt.formatCode !== 1 || fmt.bitsPerSample !== 16 || ![1, 2].includes(fmt.numberOfChannels)
      || ![8000, 12000, 16000, 24000, 32000, 44100, 48000].includes(fmt.sampleRate)
      || !data || data.dataLength <= 0 || data.dataOffset + data.dataLength > wav.byteLength
      || fmt.bytesPerSec !== fmt.sampleRate * fmt.numberOfChannels * 2
      || fmt.bytesPerFrame !== fmt.numberOfChannels * 2
      || data.dataLength % fmt.bytesPerFrame !== 0
      || data.dataLength / fmt.bytesPerSec > 180) throw new Error('Unsupported WAV');
  const result = await encode(wav, 0);
  if (!isSilk(result.data) || result.duration <= 0 || result.duration > 180100) throw new Error('Invalid SILK');
  parentPort.postMessage(result.data);
})().catch(() => { process.exitCode = 1; });
`

export async function wavToSilk(wav: Uint8Array): Promise<Buffer> {
  if (!wav.length || wav.length > 10 * 1024 * 1024) throw new Error('Invalid voice size')
  // Resolve in the host, since eval workers otherwise resolve relative to cwd.
  const codec = createRequire(join(typeof __dirname === 'string' ? __dirname : process.cwd(), 'package.json')).resolve('silk-wasm')
  const worker = new Worker(encoder, { eval: true, execArgv: [], workerData: { codec, wav }, resourceLimits: { maxOldGenerationSizeMb: 128 } })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Voice encoding timed out')), 10000)
      worker.once('message', data => resolve(Buffer.from(data)))
      worker.once('error', reject)
      worker.once('exit', () => reject(new Error('Voice encoding stopped')))
    })
  } finally {
    clearTimeout(timer)
    await worker.terminate()
  }
}
