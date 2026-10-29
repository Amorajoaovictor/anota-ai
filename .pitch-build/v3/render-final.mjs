import fs from 'node:fs/promises';
import {FileBlob,PresentationFile} from '@oai/artifact-tool';
const root='C:/Users/joao.neri/observa/anota ai';
const {FontLibrary}=await import('file:///C:/Users/joao.neri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/node_modules/skia-canvas/lib/index.mjs');
FontLibrary.use({'Space Grotesk':root+'/.pitch-build/fonts/SpaceGrotesk.ttf','DM Sans':root+'/.pitch-build/fonts/DMSans.ttf'});
const deck=await PresentationFile.importPptx(await FileBlob.load(root+'/output/pitch-anota-ai/Pitch_Anota_Ai_cores.pptx'));
for(let i=0;i<deck.slides.items.length;i++){
const blob=await deck.export({slide:deck.slides.items[i],format:'png',scale:1});
await fs.writeFile(root+`/.pitch-build/v3/final-${String(i+1).padStart(2,'0')}.png`,new Uint8Array(await blob.arrayBuffer()));
}
console.log('Rendered',deck.slides.items.length,'final slides');
