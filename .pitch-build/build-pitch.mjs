import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { Presentation, PresentationFile } from '@oai/artifact-tool';
const root = 'C:/Users/joao.neri/observa/anota ai';
const build = root + '/.pitch-build';
const output = root + '/output/pitch-anota-ai';
const skill = 'C:/Users/joao.neri/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations';
const python = 'C:/Users/joao.neri/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const {finalizePresentation} = await import(pathToFileURL(skill + '/container_tools/artifact_tool_utils.mjs'));
await fs.mkdir(output, {recursive:true});
const atlas = build + '/illustrations.png';
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
const orange='#F77900', ink='#151917', family='Arial';
const counts=[];
function text(slide,value,x,y,w,h,size=112,color=orange,bold=true,align='left'){
 const box=slide.shapes.add({geometry:'textbox',name:'Texto editável',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 box.text=value; box.text.style={typeface:family,fontSize:size,bold,color,alignment:align,verticalAlignment:'middle',autoFit:'none',insets:{top:0,right:0,bottom:0,left:0}};
 return box;
}
function picture(slide,bytes,x,y,w,h,alt){slide.images.add({blob:bytes,contentType:'image/png',fit:'contain',position:{left:x,top:y,width:w,height:h},alt});}
function newSlide(copy,notes){
 const words=copy.trim().split(/\s+/u).length;
 if(words>15)throw new Error(`Slide ${counts.length+1}: ${words} palavras`);
 counts.push(words);const s=deck.slides.add();s.background.fill='#FFFFFF';
 s.speakerNotes.textFrame.setText(notes);return s;
}
function hero(head,index,notes,{body='',side='right',size=146,label=''}={}){
 const s=newSlide([head,body,label].filter(Boolean).join(' '),notes+'\nImagem: ilustração conceitual gerada com IA, não captura da aplicação.');
 const tx=side==='right'?145:1080, ix=side==='right'?1060:70;
 picture(s,assets[index],ix,180,790,790,head+' — ilustração conceitual');
 text(s,head,tx,body?325:405,775,body?235:230,size);
 if(body)text(s,body,tx,590,775,230,61,ink,false);
 if(label)text(s,label,ix+110,958,560,55,33,'#696D69',false,'center');
 return s;
}
let s=newSlide('Anota Aí Suas ideias, no projeto certo','Quando você cuida de vários projetos, uma demanda chega em áudio, outra em mensagem, outra na reunião. O Anota Aí nasce para organizar essas entradas no projeto certo.\nFonte: PRODUCT.md e prd.md. Logo original: public/icon.svg.');
text(s,'Anota Aí',145,295,1060,210,170,ink);
text(s,'Suas ideias,\nno projeto certo',145,555,1050,230,77,orange,false);
picture(s,logo,1310,340,445,445,'Ícone original da aplicação');
hero('Sobrecarga',0,'O problema começa quando acompanhar o trabalho depende da nossa memória. Trocar de ferramenta e reorganizar demandas consome a atenção que deveria estar na execução.\nFonte: prd.md, seção 3.',{size:137});
hero('Espalhado',1,'As demandas ficam distribuídas entre mensagens, áudios, anotações e quadros. O desafio é preservar o contexto de cada projeto quando uma informação nova chega.\nFonte: PRODUCT.md, contexto operacional.',{side:'left'});
hero('Você fala.\nVira tarefa.',2,'A entrada pode ser áudio ou texto. A IA sugere uma tarefa estruturada e identifica o projeto relacionado. O usuário revisa, corrige e confirma antes de gravar.\nFonte: prd.md 2.2 e src/server/inbox.ts.',{size:112});
hero('Foco',3,'O benefício é reunir as demandas e ter clareza sobre o próximo trabalho. Kanban, roadmap e plano do dia oferecem perspectivas sobre os mesmos dados. Não há promessa de ganho percentual de produtividade.\nFonte: prd.md, resumo executivo e PRODUCT.md.',{side:'left',size:166});
hero('Contexto',4,'O diferencial é consultar o contexto de cada projeto, incluindo vocabulário, aliases e decisões. A sugestão permanece sob revisão humana antes da gravação.\nFonte: PRODUCT.md, posicionamento e princípios.',{body:'A IA consulta o projeto.\nVocê confirma.',size:146});
hero('Tecnologia',5,'A base utiliza Next.js e PostgreSQL, com Prisma para acesso aos dados. Transcrição e IA usam uma fila de processamento. Essa separação ajuda a manter a criação manual disponível quando um serviço externo falha.\nFonte: package.json, PRODUCT.md e src/server/inbox.ts.',{body:'Next.js\nPostgreSQL\nIA',side:'left',size:132});
hero('MVP',6,'O produto está em desenvolvimento. Para uma demonstração, apresente uma entrada de áudio ou texto, mostre a proposta da IA, confirme a tarefa e abra o projeto. A imagem é uma ilustração conceitual, não a interface real.\nFonte: PRODUCT.md e código do projeto.',{body:'Em desenvolvimento',size:172,label:'Ilustração'});
const currency=process.argv[2];
if(!['USD','BRL','PENDING'].includes(currency))throw new Error('Moeda do custo depende de confirmação do usuário. Use USD ou BRL.');
const price=currency==='USD'?'≈ US$ 2':'≈ R$ 2';
if(currency!=='PENDING'){ s=newSlide(`${price} IA por mês Hospedagem opcional`,'Segundo os responsáveis, o custo atual do aplicativo é aproximadamente '+price+' por mês, referente ao uso de IA. Hospedagem é opcional. O valor descreve o uso atual e não projeta custo em escala.\nFonte: informação fornecida pelo usuário nesta conversa.');
text(s,price,145,245,1630,310,246,orange,true,'center');
text(s,'IA por mês',145,590,1630,110,90,ink,false,'center');
text(s,'Hospedagem opcional',145,785,1630,90,61,ink,false,'center'); }
s=newSlide('Proposta de código aberto Sem lucro nesta fase','O projeto está sendo pensado para ser open source, sem pretensão de lucro neste primeiro momento. Não há plano comercial, preço de assinatura ou licença definidos nesta apresentação.\nFonte: informação fornecida pelo usuário nesta conversa.');
text(s,'Proposta de\ncódigo aberto',170,245,1580,370,152,orange,true,'center');
text(s,'Sem lucro nesta fase',170,700,1580,115,76,ink,false,'center');
s=newSlide('Equipe João Victor Amora Dev Fabrício Lessa Braga Gestão, PO, Scrum Master','João Victor Amora atua como desenvolvedor. Fabrício Lessa Braga atua na gestão, como Product Owner e Scrum Master.\nFonte: nomes e funções fornecidos pelo usuário nesta conversa.');
text(s,'Equipe',145,95,1600,160,145);
text(s,'João Victor\nAmora',145,385,755,230,102,ink);
text(s,'Dev',145,710,755,90,67,orange,false);
text(s,'Fabrício Lessa\nBraga',1040,385,755,230,102,ink);
text(s,'Gestão, PO,\nScrum Master',1040,710,755,190,58,orange,false);
hero('Anota Aí',7,'O Anota Aí quer transformar o que chega no dia a dia em trabalho organizado, com contexto e revisão humana. O próximo passo é apresentar o fluxo do MVP.\nFonte: PRODUCT.md e prd.md.',{body:'O próximo passo\nno projeto certo',size:153});
await fs.writeFile(build+'/word-counts.json',JSON.stringify(counts,null,2));
const draft=build+'/candidate.pptx';
await (await PresentationFile.exportPptx(deck)).save(draft);
for(let i=0;i<deck.slides.items.length;i++){
 const preview=await deck.export({slide:deck.slides.items[i],format:'png',scale:.5});
 await fs.writeFile(build+`/slide-${String(i+1).padStart(2,'0')}.png`,new Uint8Array(await preview.arrayBuffer()));
}
const result=await finalizePresentation({workspaceDir:root,candidatePath:draft,finalPath:output+(currency==='PENDING'?'/Pitch_Anota_Ai_previa.pptx':'/Pitch_Anota_Ai.pptx'),pythonExecutable:python,integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','18288000,10287000','--validate-heading-fit'],fontPolicy:{basis:'design',families:['Arial']},verifyArtifactToolImport:true,receiptPath:build+'/validation.json'});
console.log(JSON.stringify({slides:counts.length,wordsPerSlide:counts,final:output+(currency==='PENDING'?'/Pitch_Anota_Ai_previa.pptx':'/Pitch_Anota_Ai.pptx'),validation:result}));
