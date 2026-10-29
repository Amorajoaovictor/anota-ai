import {pathToFileURL} from 'node:url';
const root='C:/Users/joao.neri/observa/anota ai';
const skill='C:/Users/joao.neri/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations';
const {finalizePresentation}=await import(pathToFileURL(skill+'/container_tools/artifact_tool_utils.mjs'));
const r=await finalizePresentation({workspaceDir:root,candidatePath:root+'/.pitch-build/v2/candidate-final.pptx',finalPath:root+'/output/pitch-anota-ai/Pitch_Anota_Ai_tema.pptx',pythonExecutable:'C:/Users/joao.neri/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','18288000,10287000','--validate-heading-fit'],fontPolicy:{basis:'design',families:['Space Grotesk','DM Sans']},verifyArtifactToolImport:true,receiptPath:root+'/.pitch-build/v2/validation-final.json'});
console.log(r.finalPath);
