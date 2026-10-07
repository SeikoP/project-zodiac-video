import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rendererDir = path.resolve(scriptDir, "..");
const packageRoot = process.env.ZODIAC_PACKAGE_ROOT ? path.resolve(process.env.ZODIAC_PACKAGE_ROOT) : path.resolve(rendererDir, "..");

const wavData = (profile) => {
  const sampleRate = 44100;
  const count = Math.ceil(sampleRate * Number(profile.duration_ms) / 1000);
  const data = Buffer.alloc(count * 2);
  const amplitude = Math.pow(10, Number(profile.peak_db) / 20);
  let randomState = 1;
  let filtered = 0;
  const cutoff = Number(profile.lowpass_hz ?? 3500);
  const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
  for (let i = 0; i < count; i++) {
    const phase = 2 * Math.PI * Number(profile.frequency_hz ?? 440) * i / sampleRate;
    let value = 0;
    if (profile.wave === "sine") value = Math.sin(phase);
    else if (profile.wave === "triangle") value = (2 / Math.PI) * Math.asin(Math.sin(phase));
    else {
      randomState = (1664525 * randomState + 1013904223) >>> 0;
      const white = (randomState / 4294967295) * 2 - 1;
      filtered += alpha * (white - filtered);
      value = profile.wave === "soft_noise" ? filtered * 0.7 : filtered;
    }
    const envelope = Math.exp(-5 * i / count);
    const sample = Math.max(-1, Math.min(1, value * amplitude * envelope));
    data.writeInt16LE(Math.round(sample * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
};

export const generateSfx = async (production, outputDir = path.join(packageRoot, ".runtime", "sfx")) => {
  await mkdir(outputDir, {recursive: true});
  for (const [token, profile] of Object.entries(production.visual_system.sfx_profiles)) {
    if (profile.source !== "procedural") throw new Error("Unsupported SFX source for " + token + ".");
    await writeFile(path.join(outputDir, token + ".wav"), wavData(profile));
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const production = JSON.parse(await readFile(path.join(packageRoot, "production.json"), "utf8"));
  await generateSfx(production);
  console.log("Prepared declared SFX files.");
}
