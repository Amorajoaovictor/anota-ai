$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'documentacao-projeto-organizador'
$outPath = Join-Path $outDir 'apresentacao-organizador-programadores.pptx'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Rgb([int]$r, [int]$g, [int]$b) { return [int]($r + (256 * $g) + (65536 * $b)) }

$C = @{
  Ink = Rgb 17 24 39
  Muted = Rgb 75 85 99
  Rule = Rgb 203 213 225
  Panel = Rgb 244 246 248
  Blue = Rgb 47 128 237
  LightBlue = Rgb 224 243 252
  Coral = Rgb 196 85 70
  White = Rgb 255 255 255
}

function Add-Text {
  param(
    $slide, [string]$text, [single]$left, [single]$top, [single]$width, [single]$height,
    [single]$size, [int]$color, [switch]$Bold, [ValidateSet('left','center','right')][string]$Align = 'left'
  )
  $shape = $slide.Shapes.AddTextbox(1, $left, $top, $width, $height)
  $shape.TextFrame.MarginLeft = 0
  $shape.TextFrame.MarginRight = 0
  $shape.TextFrame.MarginTop = 0
  $shape.TextFrame.MarginBottom = 0
  $shape.TextFrame.WordWrap = -1
  $shape.TextFrame.AutoSize = 0
  $shape.TextFrame.TextRange.Text = $text
  $font = $shape.TextFrame.TextRange.Font
  $font.Name = 'Aptos'
  $font.Size = $size
  $font.Color.RGB = $color
  $font.Bold = if ($Bold) { -1 } else { 0 }
  $shape.TextFrame.TextRange.ParagraphFormat.Alignment = switch ($Align) {
    'center' { 2 }
    'right' { 3 }
    default { 1 }
  }
  return $shape
}

function Add-Box {
  param($slide, [single]$left, [single]$top, [single]$width, [single]$height, [int]$fill, [int]$line = -1, [switch]$Round)
  $geometry = if ($Round) { 5 } else { 1 }
  $shape = $slide.Shapes.AddShape($geometry, $left, $top, $width, $height)
  $shape.Fill.Solid()
  $shape.Fill.ForeColor.RGB = $fill
  if ($line -eq -1) { $shape.Line.Visible = 0 } else { $shape.Line.ForeColor.RGB = $line; $shape.Line.Weight = 1 }
  return $shape
}

function Add-Rule {
  param($slide, [single]$x1, [single]$y1, [single]$x2, [single]$y2, [int]$color = $C.Rule, [single]$weight = 1, [switch]$Arrow)
  $line = $slide.Shapes.AddLine($x1, $y1, $x2, $y2)
  $line.Line.ForeColor.RGB = $color
  $line.Line.Weight = $weight
  if ($Arrow) { $line.Line.EndArrowheadStyle = 3 }
  return $line
}

function Add-Footer {
  param($slide, [int]$number)
  Add-Rule $slide 72 505 888 505 $C.Rule 0.8 | Out-Null
  Add-Text $slide 'ORGANIZADOR PARA PROGRAMADORES' 72 514 360 14 9 $C.Muted -Bold | Out-Null
  Add-Text $slide ("{0:00} / 10" -f $number) 820 514 68 14 9 $C.Muted -Align right | Out-Null
}

function Add-Title {
  param($slide, [string]$title, [int]$number, [string]$eyebrow = 'DEFESA DE IDEIA')
  Add-Text $slide $eyebrow.ToUpper() 72 42 420 18 11 $C.Blue -Bold | Out-Null
  Add-Text $slide $title 72 75 816 60 32 $C.Ink -Bold | Out-Null
  Add-Footer $slide $number
}

function Set-Notes {
  param($slide, [string[]]$sources)
  try {
    $body = $slide.NotesPage.Shapes.Placeholders.Item(2)
    $body.TextFrame.TextRange.Text = "[Sources]`r`n" + (($sources | ForEach-Object { "- $_" }) -join "`r`n")
  } catch { }
}

$ppt = New-Object -ComObject PowerPoint.Application
$ppt.Visible = 1
$presentation = $ppt.Presentations.Add()
$presentation.PageSetup.SlideWidth = 960
$presentation.PageSetup.SlideHeight = 540

try {
  # 1 — Cover
  $s = $presentation.Slides.Add(1, 12)
  $s.Background.Fill.ForeColor.RGB = $C.White
  Add-Text $s 'DEFESA DE IDEIA  •  PROJETO DE PRODUTO' 72 44 470 18 12 $C.Blue -Bold | Out-Null
  Add-Text $s "Organizador para`nProgramadores" 72 126 500 115 46 $C.Ink -Bold | Out-Null
  Add-Text $s 'Uma experiência única para capturar ideias, organizar tarefas e acompanhar o roadmap.' 72 270 430 62 20 $C.Muted | Out-Null
  Add-Text $s 'Pergunta central: como reduzir a distância entre uma ideia e um plano executável?' 72 382 430 40 15 $C.Ink -Bold | Out-Null
  Add-Rule $s 600 115 600 396 $C.Rule 1 | Out-Null
  Add-Text $s 'UMA IDEIA' 650 92 150 18 11 $C.Muted -Bold | Out-Null
  Add-Box $s 650 136 190 54 $C.LightBlue $C.Blue -Round | Out-Null
  Add-Text $s 'texto livre' 650 153 190 22 17 $C.Ink -Bold -Align center | Out-Null
  Add-Rule $s 745 190 745 218 $C.Blue 2 -Arrow | Out-Null
  Add-Box $s 650 220 190 54 $C.Panel $C.Rule -Round | Out-Null
  Add-Text $s 'IA sugere' 650 237 190 22 17 $C.Ink -Bold -Align center | Out-Null
  Add-Rule $s 745 274 745 302 $C.Blue 2 -Arrow | Out-Null
  Add-Box $s 615 304 260 54 $C.White $C.Blue -Round | Out-Null
  Add-Text $s 'usuário revisa e confirma' 615 321 260 22 16 $C.Ink -Bold -Align center | Out-Null
  Add-Rule $s 690 358 650 408 $C.Blue 2 -Arrow | Out-Null
  Add-Rule $s 800 358 840 408 $C.Blue 2 -Arrow | Out-Null
  Add-Box $s 585 413 150 46 $C.Panel $C.Rule -Round | Out-Null
  Add-Text $s 'Kanban' 585 427 150 18 15 $C.Ink -Bold -Align center | Out-Null
  Add-Box $s 750 413 150 46 $C.Panel $C.Rule -Round | Out-Null
  Add-Text $s 'Roadmap' 750 427 150 18 15 $C.Ink -Bold -Align center | Out-Null
  Set-Notes $s @('documentacao-projeto-organizador/README.md','documentacao-projeto-organizador/05-ideacao-e-funcionalidades.md')

  # 2 — Problem
  $s = $presentation.Slides.Add(2, 12); Add-Title $s 'O problema é a falta de continuidade.' 2 'PROBLEMA'
  Add-Box $s 72 165 420 230 $C.Ink | Out-Null
  Add-Text $s '“Programadores precisam organizar ideias, tarefas e roadmaps, mas ferramentas fragmentadas e processos manuais dificultam o acompanhamento.”' 100 205 365 155 20 $C.White -Bold | Out-Null
  Add-Text $s 'PROBLEMA CENTRAL' 100 176 240 18 11 $C.LightBlue -Bold | Out-Null
  Add-Text $s 'Hoje, uma ideia precisa atravessar várias ferramentas antes de virar execução.' 560 168 300 84 20 $C.Ink -Bold | Out-Null
  $steps = @('1  Ideia surge','2  Nota separada','3  Tarefa criada','4  Kanban mantido','5  Roadmap atualizado')
  $y=286
  foreach($item in $steps){ Add-Text $s $item 560 $y 300 22 17 $C.Muted | Out-Null; $y += 34 }
  Add-Rule $s 560 423 860 423 $C.Rule 1 | Out-Null
  Add-Text $s 'Custo invisível' 560 439 140 20 14 $C.Coral -Bold | Out-Null
  Add-Text $s 'tempo gasto sincronizando informações em vez de avançar no projeto.' 705 439 190 32 14 $C.Muted | Out-Null
  Set-Notes $s @('documentacao-projeto-organizador/01-descricao-do-problema.md','documentacao-projeto-organizador/02-espaco-do-problema.md')

  # 3 — Fragmentation
  $s = $presentation.Slides.Add(3, 12); Add-Title $s 'Planejamento se perde na fragmentação.' 3 'CONTEXTO'
  Add-Text $s 'Cada ferramenta resolve uma parte. O usuário precisa criar a continuidade.' 72 155 780 30 20 $C.Muted | Out-Null
  $cols = @(
    @{x=72; title='CAPTURA'; body='Ideias aparecem durante o trabalho e são registradas onde for mais rápido.'; tag='nota'},
    @{x=352; title='EXECUÇÃO'; body='A ideia precisa ser reescrita como tarefa, prioridade, prazo e status.'; tag='Kanban'},
    @{x=632; title='DIREÇÃO'; body='O roadmap é atualizado em outro momento, muitas vezes manualmente.'; tag='roadmap'}
  )
  foreach($col in $cols){
    Add-Rule $s $col.x 216 ($col.x+210) 216 $C.Blue 3 | Out-Null
    Add-Text $s $col.title $col.x 232 210 20 13 $C.Blue -Bold | Out-Null
    Add-Text $s $col.body $col.x 266 210 88 18 $C.Ink | Out-Null
    Add-Text $s $col.tag $col.x 385 210 20 15 $C.Muted -Bold | Out-Null
  }
  Add-Box $s 72 440 770 36 $C.LightBlue | Out-Null
  Add-Text $s 'Oportunidade: unificar captura de ideias, organização de tarefas, visão de roadmap e assistência de IA.' 92 450 730 18 15 $C.Ink -Bold | Out-Null
  Set-Notes $s @('documentacao-projeto-organizador/02-espaco-do-problema.md','documentacao-projeto-organizador/03-coleta-de-dados.md')

  # 4 — Persona
  $s = $presentation.Slides.Add(4, 12); Add-Title $s 'Alex Dev precisa de um próximo passo claro.' 4 'USUÁRIO'
  Add-Box $s 72 160 240 270 $C.Panel $C.Rule | Out-Null
  $circle = Add-Box $s 137 190 110 110 $C.Blue -1 -Round
  Add-Text $s 'AD' 137 225 110 28 28 $C.White -Bold -Align center | Out-Null
  Add-Text $s 'Alex Dev' 102 320 180 26 22 $C.Ink -Bold -Align center | Out-Null
  Add-Text $s 'programador solo' 102 354 180 20 15 $C.Muted -Align center | Out-Null
  Add-Text $s 'HIPÓTESE A VALIDAR' 102 395 180 16 11 $C.Coral -Bold -Align center | Out-Null
  Add-Text $s 'Trabalha sozinho ou em equipe pequena e cuida de ideia, tarefa e planejamento.' 360 165 480 44 22 $C.Ink -Bold | Out-Null
  Add-Text $s 'O que ele quer fazer melhor' 360 245 220 22 17 $C.Blue -Bold | Out-Null
  Add-Text $s "• registrar ideias rapidamente`n• transformar ideia em tarefa`n• definir prioridade e status`n• visualizar próximos objetivos" 360 278 220 122 17 $C.Muted | Out-Null
  Add-Text $s 'O que hoje atrapalha' 650 245 190 22 17 $C.Blue -Bold | Out-Null
  Add-Text $s "• ferramentas diferentes`n• ideias esquecidas`n• prioridades desatualizadas`n• tempo perdido sincronizando" 650 278 210 122 17 $C.Muted | Out-Null
  Add-Text $s 'A persona nasceu de uma necessidade real do criador; entrevistas com 3 a 5 programadores devem testar se o problema se repete.' 360 425 500 34 14 $C.Ink -Bold | Out-Null
  Set-Notes $s @('documentacao-projeto-organizador/04-persona.md','documentacao-projeto-organizador/03-coleta-de-dados.md')

  # 5 — Solution
  $s = $presentation.Slides.Add(5, 12); Add-Title $s 'Uma única experiência conecta nota, tarefa e objetivo.' 5 'SOLUÇÃO'
  Add-Text $s 'O produto combina quatro capacidades em torno do mesmo projeto.' 72 155 650 28 20 $C.Muted | Out-Null
  $x=72; $items=@(
    @{t='ANOTAÇÕES'; b='capturar e pesquisar ideias por projeto ou etiqueta'},
    @{t='KANBAN'; b='criar, priorizar e mover tarefas entre colunas'},
    @{t='ROADMAP'; b='acompanhar objetivos, marcos e progresso'},
    @{t='IA'; b='sugerir estrutura, próximos passos e agrupamentos'}
  )
  foreach($it in $items){
    Add-Box $s $x 220 195 150 $C.Panel $C.Rule | Out-Null
    Add-Text $s $it.t ($x+20) 250 155 22 15 $C.Blue -Bold | Out-Null
    Add-Text $s $it.b ($x+20) 292 155 65 17 $C.Ink | Out-Null
    $x += 215
  }
  Add-Rule $s 72 404 857 404 $C.Blue 2 | Out-Null
  Add-Text $s 'Princípio de confiança' 72 424 190 22 16 $C.Blue -Bold | Out-Null
  Add-Text $s 'A IA pode propor. O usuário revisa e confirma antes de qualquer alteração no planejamento.' 270 424 585 24 18 $C.Ink -Bold | Out-Null
  Set-Notes $s @('documentacao-projeto-organizador/05-ideacao-e-funcionalidades.md')

  # 6 — Main flow
  $s = $presentation.Slides.Add(6, 12); Add-Title $s 'A IA propõe; o usuário decide.' 6 'FLUXO PRINCIPAL'
  Add-Text $s 'Linguagem natural vira plano executável sem perder controle.' 72 154 700 28 20 $C.Muted | Out-Null
  $centers = @(130, 300, 470, 640, 810)
  for($i=0;$i -lt 4;$i++){ Add-Rule $s ($centers[$i]+54) 274 ($centers[$i+1]-54) 274 $C.Blue 2 -Arrow | Out-Null }
  $labels = @(
    @{n='01'; t='Escreve'; b='uma ideia em texto livre'},
    @{n='02'; t='Recebe'; b='sugestões de tarefas e objetivo'},
    @{n='03'; t='Revisa'; b='edita, rejeita ou ajusta'},
    @{n='04'; t='Confirma'; b='aprova as alterações'},
    @{n='05'; t='Acompanha'; b='nota, Kanban e roadmap vinculados'}
  )
  for($i=0;$i -lt 5;$i++){
    $x=$centers[$i]-54
    Add-Box $s $x 215 108 118 $(if($i -eq 3){$C.LightBlue}else{$C.Panel}) $C.Rule -Round | Out-Null
    Add-Text $s $labels[$i].n ($x+12) 229 84 16 11 $C.Blue -Bold -Align center | Out-Null
    Add-Text $s $labels[$i].t ($x+10) 252 88 22 $(if($i -eq 4){15}else{17}) $C.Ink -Bold -Align center | Out-Null
    Add-Text $s $labels[$i].b ($x+10) 282 88 40 13 $C.Muted -Align center | Out-Null
  }
  Add-Box $s 250 390 460 44 $C.Ink | Out-Null
  Add-Text $s 'Sem confirmação, não há alteração automática.' 270 403 420 18 17 $C.White -Bold -Align center | Out-Null
  Set-Notes $s @('documentacao-projeto-organizador/05-ideacao-e-funcionalidades.md','documentacao-projeto-organizador/07-mapa-da-jornada.md')

  # 7 — Trust / failure
  $s = $presentation.Slides.Add(7, 12); Add-Title $s 'Confiança vem de controle e continuidade.' 7 'RISCOS E RESPOSTAS'
  Add-Text $s 'O cenário negativo não invalida a ideia; ele define as regras do produto.' 72 154 760 28 20 $C.Muted | Out-Null
  Add-Box $s 72 215 370 205 $C.Panel $C.Rule | Out-Null
  Add-Text $s 'SE A IA ERRAR' 98 242 220 18 13 $C.Coral -Bold | Out-Null
  Add-Text $s 'Uma prioridade inadequada ou tarefa incompleta pode deixar Kanban e roadmap inconsistentes.' 98 282 300 60 20 $C.Ink -Bold | Out-Null
  Add-Text $s 'Risco: automatizar antes de entender.' 98 370 300 22 15 $C.Coral -Bold | Out-Null
  Add-Text $s 'PROTEÇÕES' 520 215 220 18 13 $C.Blue -Bold | Out-Null
  Add-Text $s "01  mostrar sugestões antes de salvar`n02  permitir editar, rejeitar e cancelar`n03  confirmar alterações importantes`n04  manter vínculos entre nota, tarefa e objetivo" 520 252 330 126 18 $C.Ink -Bold | Out-Null
  Add-Rule $s 520 400 850 400 $C.Rule 1 | Out-Null
  Add-Text $s 'Se a IA estiver indisponível, o usuário continua criando notas, tarefas e objetivos manualmente.' 520 416 330 38 15 $C.Muted | Out-Null
  Set-Notes $s @('documentacao-projeto-organizador/06-cenarios-positivo-negativo.md','documentacao-projeto-organizador/09-documento-de-requisitos.md')

  # 8 — MVP / journey
  $s = $presentation.Slides.Add(8, 12); Add-Title $s 'O MVP prova um fluxo, não um ecossistema inteiro.' 8 'ESCOPO INICIAL'
  Add-Text $s 'A primeira versão precisa demonstrar uma transformação completa.' 72 154 700 28 20 $C.Muted | Out-Null
  Add-Rule $s 102 270 820 270 $C.Rule 2 | Out-Null
  $journey = @('Dashboard','Notas','Análise IA','Revisão','Kanban','Roadmap')
  $jx = @(102,245,388,531,674,817)
  for($i=0;$i -lt 6;$i++){
    $dot = Add-Box $s ($jx[$i]-11) 259 22 22 $(if($i -eq 2){$C.Blue}else{$C.Ink}) -1 -Round
    Add-Text $s ("0{0}" -f ($i+1)) ($jx[$i]-22) 225 44 18 11 $C.Blue -Bold -Align center | Out-Null
    Add-Text $s $journey[$i] ($jx[$i]-55) 302 110 20 15 $C.Ink -Bold -Align center | Out-Null
  }
  Add-Text $s 'Dentro' 72 385 100 20 16 $C.Blue -Bold | Out-Null
  Add-Text $s 'fluxo principal, vínculos entre objetos, revisão da IA e caminho manual.' 190 385 410 22 16 $C.Ink | Out-Null
  Add-Text $s 'Depois' 72 425 100 20 16 $C.Coral -Bold | Out-Null
  Add-Text $s 'colaboração em equipe, notificações e integrações externas.' 190 425 410 22 16 $C.Muted | Out-Null
  Set-Notes $s @('documentacao-projeto-organizador/07-mapa-da-jornada.md','documentacao-projeto-organizador/10-prototipo-alta-fidelidade.md')

  # 9 — Requirements
  $s = $presentation.Slides.Add(9, 12); Add-Title $s 'O primeiro recorte já tem critérios objetivos de sucesso.' 9 'REQUISITOS'
  $r = @(
    @{y=165; n='01'; t='Organizar'; b='notas, tarefas, Kanban, objetivos e marcos'},
    @{y=245; n='02'; t='Relacionar'; b='nota, tarefa e roadmap permanecem vinculados'},
    @{y=325; n='03'; t='Assistir'; b='IA sugere tarefas, prioridade e próximos passos'},
    @{y=405; n='04'; t='Preservar controle'; b='usuário edita, rejeita e confirma; manual continua disponível'}
  )
  foreach($item in $r){
    Add-Text $s $item.n 72 $item.y 40 22 16 $C.Blue -Bold | Out-Null
    Add-Text $s $item.t 130 $item.y 180 22 18 $C.Ink -Bold | Out-Null
    Add-Text $s $item.b 330 $item.y 520 22 17 $C.Muted | Out-Null
    Add-Rule $s 130 ($item.y+43) 850 ($item.y+43) $C.Rule 0.8 | Out-Null
  }
  Add-Box $s 72 462 778 28 $C.LightBlue | Out-Null
  Add-Text $s 'Aceitação: só salvar após confirmação; vínculos preservados; alterações importantes editáveis ou reversíveis.' 88 468 744 16 13 $C.Ink -Bold | Out-Null
  Set-Notes $s @('documentacao-projeto-organizador/09-documento-de-requisitos.md')

  # 10 — Validation / close
  $s = $presentation.Slides.Add(10, 12); Add-Title $s 'A proposta é simples de entender e possível de validar.' 10 'DEFESA'
  Add-Text $s 'O argumento' 72 155 170 22 18 $C.Blue -Bold | Out-Null
  Add-Text $s 'Programadores não precisam de mais uma ferramenta isolada. Precisam de continuidade entre ideia, execução e direção.' 72 193 365 88 25 $C.Ink -Bold | Out-Null
  Add-Rule $s 500 160 500 440 $C.Rule 1 | Out-Null
  Add-Text $s 'Próximos passos de validação' 560 155 300 22 18 $C.Blue -Bold | Out-Null
  Add-Text $s "01  observar perdas de ideia e prioridade por uma semana`n02  entrevistar 3 a 5 programadores semelhantes`n03  desenhar o fluxo em Figma`n04  testar se a revisão antes da confirmação gera confiança" 560 202 300 150 18 $C.Ink -Bold | Out-Null
  Add-Box $s 560 380 300 76 $C.Ink | Out-Null
  Add-Text $s "Pergunta para discussão`nO que faria você confiar essa organização à IA?" 580 393 260 58 14 $C.White -Bold -Align center | Out-Null
  Add-Text $s 'As conclusões ainda são hipóteses: a coleta com outros usuários e o protótipo interativo estão pendentes.' 72 455 780 22 14 $C.Muted | Out-Null
  Set-Notes $s @('documentacao-projeto-organizador/03-coleta-de-dados.md','documentacao-projeto-organizador/08-model-business-canvas.md','documentacao-projeto-organizador/10-prototipo-alta-fidelidade.md','documentacao-projeto-organizador/README.md')

  $presentation.SaveAs($outPath, 24)
  Write-Output "Created: $outPath"
}
finally {
  if ($presentation) { $presentation.Close() }
  if ($ppt) { $ppt.Quit() }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}






