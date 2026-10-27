import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Pin both the upstream revision and checksum; visitors load the font from Pages.
const fontName = 'SourceHanSerifCN-VF.otf.woff2';
const fontUrl = 'https://raw.githubusercontent.com/adobe-fonts/source-han-serif/7889f11bf31170b5d092a083b357c8c8130f89e0/Variable/WOFF2/OTF/Subset/' + fontName;
const fontSha256 = '808cb3203bb9cdd6b166a8a656a0c7608a7dc2a31c41c2cd0374550cae445471';

export async function prepareFonts(dist) {
  const destination = path.join(dist, 'assets/fonts', fontName);
  let bytes;
  if (fs.existsSync(destination)) {
    bytes = fs.readFileSync(destination);
  } else {
    const response = await fetch(fontUrl, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Cannot download Source Han Serif: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (createHash('sha256').update(bytes).digest('hex') !== fontSha256) {
    throw new Error('Source Han Serif checksum mismatch.');
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
}
