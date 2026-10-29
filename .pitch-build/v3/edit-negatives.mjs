import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {FileBlob,PresentationFile} from '@oai/artifact-tool';
import sharp from 'sharp';
const root='C:/Users/joao.neri/observa/anota ai';
const build=root+'/.pitch-build/v3';
const skill='C:/Users/joao.neri/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations';
const {FontLibrary}=await import('file:///C:/Users/joao.neri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/node_modules/skia-canvas/lib/index.mjs');
FontLibrary.use({'Space Grotesk':root+'/.pitch-build/fonts/SpaceGrotesk.ttf','DM Sans':root+'/.pitch-build/fonts/DMSans.ttf'});
const deck=await PresentationFile.importPptx(await FileBlob.load(root+'/output/pitch-anota-ai/Pitch_Anota_Ai_tema.pptx'));
for(const [id,title] of [['sh/9072xkry','Sobrecarga'],['sh/cza94vmx','Espalhado']])deck.resolve(id).text.get(title).style={color:'#f3aaaa'};
for(const [i,id] of [[0,'im/lczil8jm'],[1,'im/gzm507ih']]){
 const img=deck.resolve(id), frame=img.frame, crop=img.crop, fit=img.fit;
 img.replace({blob:await fs.readFile(build+`/negative-${i}.png`),contentType:'image/png',alt:i===0?'Sobrecarga — ilustração em vermelho':'Demandas espalhadas — ilustração em vermelho',fit});
 img.frame=frame;img.crop=crop;
}
const draft=build+'/candidate.pptx';
await(await PresentationFile.exportPptx(deck)).save(draft);
const {finalizePresentation}=await import(pathToFileURL(skill+'/container_tools/artifact_tool_utils.mjs'));
const r=await finalizePresentation({workspaceDir:root,candidatePath:draft,finalPath:root+'/output/pitch-anota-ai/Pitch_Anota_Ai_final.pptx',pythonExecutable:'C:/Users/joao.neri/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','18288000,10287000','--validate-heading-fit'],fontPolicy:{basis:'design',families:['Space Grotesk','DM Sans']},verifyArtifactToolImport:true,receiptPath:build+'/validation.json'});
const final=await PresentationFile.importPptx(await FileBlob.load(r.finalPath));
const unchanged=[];
for(let i=0;i<12;i++){
 const blob=await final.export({slide:final.slides.items[i],format:'png',scale:1});
 const png=Buffer.from(await blob.arrayBuffer());
 await fs.writeFile(build+`/final-${String(i+1).padStart(2,'0')}.png`,png);
 if(i!==1 && i!==2){
 const a=await sharp(png).raw().toBuffer();
 const b=await sharp(root+`/.pitch-build/v2/final-${String(i+1).padStart(2,'0')}.png`).raw().toBuffer();
 if(!a.equals(b))throw new Error(`Slide ${i+1} teve alteração visual fora do escopo`);
 unchanged.push(i+1);
 }
}
console.log(JSON.stringify({file:r.finalPath,unchangedSlides:unchanged}));
