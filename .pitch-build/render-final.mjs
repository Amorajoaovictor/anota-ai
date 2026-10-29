import fs from 'node:fs/promises';
import {FileBlob,PresentationFile} from '@oai/artifact-tool';
const root='C:/Users/joao.neri/observa/anota ai';
const deck=await PresentationFile.importPptx(await FileBlob.load(root+'/output/pitch-anota-ai/Pitch_Anota_Ai.pptx'));
for(let i=0;i<deck.slides.items.length;i++){
const blob=await deck.export({slide:deck.slides.items[i],format:'png',scale:1});
await fs.writeFile(root+`/.pitch-build/final-${String(i+1).padStart(2,'0')}.png`,new Uint8Array(await blob.arrayBuffer()));
}
console.log('Rendered',deck.slides.items.length,'final slides');
