import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { Presentation, PresentationFile } from '@oai/artifact-tool';
const root = 'C:/Users/joao.neri/observa/anota ai';
const build = root + '/.pitch-build/v2';
await fs.mkdir(build,{recursive:true});
const output = root + '/output/pitch-anota-ai';
const skill = 'C:/Users/joao.neri/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations';
const python = 'C:/Users/joao.neri/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const {finalizePresentation} = await import(pathToFileURL(skill + '/container_tools/artifact_tool_utils.mjs'));
await fs.mkdir(output, {recursive:true});
const atlas = root + '/.pitch-build/illustrations-dark.png';
const meta = await sharp(atlas).metadata();
const assets = [];
for(let i=0;i<8;i++){
 const x=Math.round((i%4)*meta.width/4), y=Math.round(Math.floor(i/4)*meta.height/2);
 const right=Math.round(((i%4)+1)*meta.width/4), bottom=Math.round((Math.floor(i/4)+1)*meta.height/2);
 const bytes=await sharp(atlas).extract({left:x,top:y,width:right-x,height:bottom-y}).png().toBuffer();
 await fs.writeFile(build+`/asset-${i}.png`,bytes); assets.push(bytes);
}
const logo=await sharp(root+'/public/icon.svg').resize(700,700).png().toBuffer();
const deck=Presentation.create({slideSize:{width:1920,height:1080}});
const orange='#79dfb2', ink='#eef4f0', family='Space Grotesk', bodyFamily='DM Sans';
const {FontLibrary,Canvas}=await import('file:///C:/Users/joao.neri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/node_modules/skia-canvas/lib/index.mjs');
FontLibrary.use({'Space Grotesk':root+'/.pitch-build/fonts/SpaceGrotesk.ttf','DM Sans':root+'/.pitch-build/fonts/DMSans.ttf'});
const wallpaper=await fs.readFile(root+'/.pitch-build/dark-wallpaper.png');
const counts=[];
const measure=new Canvas(1,1).getContext('2d');
function text(slide,value,x,y,w,h,size=112,color=orange,bold=true,align='left'){
 const font=bold?family:bodyFamily;
 measure.font=`${bold?700:400} ${size}px "${font}"`;
 const maxWidth=Math.max(...value.split('\n').map(line=>measure.measureText(line).width));
 if(maxWidth>w-24)size=Math.floor(size*(w-24)/maxWidth);
 measure.font=`${bold?700:400} ${size}px "${font}"`;
 if(value.split('\n').some(line=>measure.measureText(line).width>w-12))throw new Error('Texto não cabe: '+value);
 const box=slide.shapes.add({geometry:'textbox',name:'Texto editável',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 box.text=value; box.text.style={typeface:bold?family:bodyFamily,fontSize:size,bold,color,alignment:align,verticalAlignment:'middle',autoFit:'none',insets:{top:0,right:0,bottom:0,left:0}};
 return box;
}
function picture(slide,bytes,x,y,w,h,alt){slide.images.add({blob:bytes,contentType:'image/png',fit:'contain',position:{left:x,top:y,width:w,height:h},alt});}
function newSlide(copy,notes){
 const words=copy.trim().split(/\s+/u).length;
 if(words>15)throw new Error(`Slide ${counts.length+1}: ${words} palavras`);
 counts.push(words);const s=deck.slides.add();s.background.fill='#090d0f';
 s.speakerNotes.textFrame.setText(notes);return s;
}
function background(slide){picture(slide,wallpaper,0,0,1920,1080,'Fundo da identidade Anota Aí');}
function hero(head,index,notes,{body='',side='right',size=146,label=''}={}){
 const s=newSlide([head,body,label].filter(Boolean).join(' '),notes+'\nImagem: ilustração conceitual gerada com IA, não captura da aplicação.');
 const tx=side==='right'?120:1060, ix=side==='right'?990:0;
 picture(s,assets[index],ix,85,1010,1010,head+' — ilustração conceitual');
 text(s,head,tx,body?285:390,820,body?290:285,Math.min(size*1.13,head.length>8?139:200));
 if(body)text(s,body,tx,635,810,235,64,ink,false);
 if(label)text(s,label,ix+225,995,550,45,27,'#8b9a9f',false,'center');
 return s;
}
let s=newSlide('Anota Aí Suas ideias, no projeto certo','Quando você cuida de vários projetos, uma demanda chega em áudio, outra em mensagem, outra na reunião. O Anota Aí nasce para organizar essas entradas no projeto certo.\nFonte: PRODUCT.md e prd.md. Logo original: public/icon.svg.');
background(s);
picture(s,logo,125,100,140,140,'Ícone original da aplicação');
text(s,'Anota Aí',120,345,1450,290,235,orange);
text(s,'Suas ideias,\nno projeto certo',130,710,1300,225,82,ink,false);
hero('Sobrecarga',0,'O problema começa quando acompanhar o trabalho depende da nossa memória. Trocar de ferramenta e reorganizar demandas consome a atenção que deveria estar na execução.\nFonte: prd.md, seção 3.',{size:137});
hero('Espalhado',1,'As demandas ficam distribuídas entre mensagens, áudios, anotações e quadros. O desafio é preservar o contexto de cada projeto quando uma informação nova chega.\nFonte: PRODUCT.md, contexto operacional.',{side:'left'});
hero('Você fala.\nVira tarefa.',2,'A entrada pode ser áudio ou texto. A IA sugere uma tarefa estruturada e identifica o projeto relacionado. O usuário revisa, corrige e confirma antes de gravar.\nFonte: prd.md 2.2 e src/server/inbox.ts.',{size:112});
hero('Foco',3,'O benefício é reunir as demandas e ter clareza sobre o próximo trabalho. Kanban, roadmap e plano do dia oferecem perspectivas sobre os mesmos dados. Não há promessa de ganho percentual de produtividade.\nFonte: prd.md, resumo executivo e PRODUCT.md.',{side:'left',size:166});
hero('Contexto',4,'O diferencial é consultar o contexto de cada projeto, incluindo vocabulário, aliases e decisões. A sugestão permanece sob revisão humana antes da gravação.\nFonte: PRODUCT.md, posicionamento e princípios.',{body:'A IA consulta o projeto.\nVocê confirma.',size:146});
hero('Tecnologia',5,'A base utiliza Next.js e PostgreSQL, com Prisma para acesso aos dados. Transcrição e IA usam uma fila de processamento. Essa separação ajuda a manter a criação manual disponível quando um serviço externo falha.\nFonte: package.json, PRODUCT.md e src/server/inbox.ts.',{body:'Next.js\nPostgreSQL\nIA',side:'left',size:132});
hero('Beta',6,'O aplicativo entrou em beta. Todas as funções principais estão rodando, conforme informação atual dos responsáveis. A imagem é uma ilustração conceitual, não a interface real.\nFonte: atualização fornecida pelo usuário nesta conversa.',{body:'Funções principais\nem operação',size:172,label:'Ilustração'});
const currency=process.argv[2];
if(!['USD','BRL','PENDING'].includes(currency))throw new Error('Moeda do custo depende de confirmação do usuário. Use USD ou BRL.');
const price=currency==='USD'?'≈ US$ 2':'≈ R$ 2';
if(currency!=='PENDING'){ s=newSlide(`${price} IA por mês Hospedagem opcional`,'Segundo os responsáveis, o custo atual do aplicativo é aproximadamente '+price+' por mês, referente ao uso de IA. Hospedagem é opcional. O valor descreve o uso atual e não projeta custo em escala.\nFonte: informação fornecida pelo usuário nesta conversa.');
background(s);
text(s,price,120,210,1640,350,290,orange);
text(s,'IA por mês',130,645,1530,125,94,ink,false);
text(s,'Hospedagem opcional',130,830,1530,85,60,'#b6c2be',false); }
s=newSlide('Código aberto Proposta sem lucro nesta fase','O projeto está sendo pensado para ser open source, sem pretensão de lucro neste primeiro momento. Não há plano comercial, preço de assinatura ou licença definidos nesta apresentação.\nFonte: informação fornecida pelo usuário nesta conversa.');
background(s);
text(s,'Código\naberto',120,220,1450,500,215,orange);
text(s,'Proposta sem lucro nesta fase',130,815,1620,125,72,ink,false);
s=newSlide('Equipe João Victor Amora Dev Fabrício Lessa Braga Gestão, PO, Scrum Master','João Victor Amora atua como desenvolvedor. Fabrício Lessa Braga atua na gestão, como Product Owner e Scrum Master.\nFonte: nomes e funções fornecidos pelo usuário nesta conversa.');
background(s);
text(s,'Equipe',120,85,1600,160,118);
picture(s,logo,1710,95,105,105,'Ícone original da aplicação');
text(s,'João Victor\nAmora',145,385,755,230,102,ink);
text(s,'Dev',145,710,755,90,67,orange,false);
text(s,'Fabrício Lessa\nBraga',1040,385,755,230,102,ink);
text(s,'Gestão, PO,\nScrum Master',1040,710,755,190,58,ink,false);
hero('Anota Aí',7,'O Anota Aí quer transformar o que chega no dia a dia em trabalho organizado, com contexto e revisão humana. O próximo passo é apresentar o fluxo do beta.\nFonte: PRODUCT.md e prd.md.',{body:'O próximo passo\nno projeto certo',size:153});
await fs.writeFile(build+'/word-counts.json',JSON.stringify(counts,null,2));
const draft=build+'/candidate-final.pptx';
await (await PresentationFile.exportPptx(deck)).save(draft);
for(let i=0;i<deck.slides.items.length;i++){
 const preview=await deck.export({slide:deck.slides.items[i],format:'png',scale:1});
 await fs.writeFile(build+`/slide-${String(i+1).padStart(2,'0')}.png`,new Uint8Array(await preview.arrayBuffer()));
}
const result=await finalizePresentation({workspaceDir:root,candidatePath:draft,finalPath:output+(currency==='PENDING'?'/Pitch_Anota_Ai_previa.pptx':'/Pitch_Anota_Ai_tema.pptx'),pythonExecutable:python,integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','18288000,10287000','--validate-heading-fit'],fontPolicy:{basis:'design',families:['Space Grotesk','DM Sans']},verifyArtifactToolImport:true,receiptPath:build+'/validation.json'});
console.log(JSON.stringify({slides:counts.length,wordsPerSlide:counts,final:output+(currency==='PENDING'?'/Pitch_Anota_Ai_previa.pptx':'/Pitch_Anota_Ai_tema.pptx'),validation:result}));

