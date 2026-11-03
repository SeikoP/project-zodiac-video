// Prepares OBS Studio for the show (Windows):
//   npm run obs            create profile "Zodiac Live" (1080×1920, 30 FPS) and import the scene
//   npm run obs -- --force replace them if they already exist
// Works with an installed OBS (%APPDATA%\obs-studio) and with the portable copy at
// %LOCALAPPDATA%\Programs\obs-studio (config inside it); --portable <dir> points at another portable folder.
// Writes only new files under %APPDATA%\obs-studio\basic\ (a profile folder and a scene collection file).
// It never touches your stream key or existing profiles. Start OBS afterwards and choose Profile ▸ Zodiac Live
// and Scene Collection ▸ Zodiac Live (they are selected automatically on a fresh OBS install).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');
if (!process.env.APPDATA) { console.error('Script này dành cho Windows (không có %APPDATA%).'); process.exit(1); }
const pAt = process.argv.indexOf('--portable');
const portableDir = pAt >= 0 ? path.resolve(process.argv[pAt + 1]) : path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'obs-studio');
const isPortable = pAt >= 0 || (fs.existsSync(path.join(portableDir, 'portable_mode.txt')) && !fs.existsSync(path.join(process.env.APPDATA, 'obs-studio', 'basic')));
// portable OBS keeps its configuration next to the program; an installed OBS uses %APPDATA%
const base = isPortable ? path.join(portableDir, 'config', 'obs-studio') : path.join(process.env.APPDATA, 'obs-studio');
console.log(`OBS ${isPortable ? 'portable' : 'đã cài'}: cấu hình tại ${base}`);

const NAME = 'Zodiac Live', DIR = 'Zodiac_Live';
const profileDir = path.join(base, 'basic', 'profiles', DIR);
const sceneFile = path.join(base, 'basic', 'scenes', `${DIR}.json`);

const basicIni = `[General]
Name=${NAME}

[Video]
BaseCX=1080
BaseCY=1920
OutputCX=1080
OutputCY=1920
FPSType=0
FPSCommon=30
ScaleType=bicubic

[Audio]
SampleRate=48000
ChannelSetup=Stereo

[Output]
Mode=Simple

[SimpleOutput]
VBitrate=4500
ABitrate=128
StreamEncoder=x264
`;

function write(file, text, label) {
  if (fs.existsSync(file) && !force) { console.log(`• ${label} đã có — giữ nguyên (thêm --force để thay): ${file}`); return false; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  console.log(`✔ ${label}: ${file}`);
  return true;
}

write(path.join(profileDir, 'basic.ini'), basicIni, 'Profile "Zodiac Live" (1080×1920, 30 FPS, 4500 kbps)');
const collection = JSON.parse(fs.readFileSync(path.join(root, 'obs', 'Zodiac-Live.json'), 'utf8'));
collection.name = NAME;
write(sceneFile, JSON.stringify(collection, null, 4), 'Scene collection "Zodiac Live" (Browser Source → http://127.0.0.1:4848/)');

// On a fresh OBS install (no global.ini yet) make the new profile and scene the defaults.
const globalIni = path.join(base, 'global.ini');
if (!fs.existsSync(globalIni)) {
  fs.writeFileSync(globalIni, `[General]\nFirstRun=true\n\n[Basic]\nProfile=${NAME}\nProfileDir=${DIR}\nSceneCollection=${NAME}\nSceneCollectionFile=${DIR}\n`);
  console.log('✔ Đặt Zodiac Live làm mặc định cho lần mở OBS đầu tiên');
} else console.log('• OBS đã từng chạy: mở OBS rồi chọn Profile ▸ Zodiac Live và Scene Collection ▸ Zodiac Live');

console.log('\nCòn lại (OBS không cho cài sẵn): dán Stream Key của TikTok ở Settings ▸ Stream (Service: Custom, Server + Key từ TikTok LIVE Studio/Live Center).');
