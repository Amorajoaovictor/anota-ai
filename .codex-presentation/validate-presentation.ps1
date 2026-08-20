param(
  [Parameter(Mandatory=$true)][string]$PptxPath
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $PptxPath)) {
  throw "Presentation not found: $PptxPath"
}

$ppt = New-Object -ComObject PowerPoint.Application
$presentation = $null
try {
  $presentation = $ppt.Presentations.Open((Resolve-Path -LiteralPath $PptxPath), $true, $true, $false)
  if ($presentation.Slides.Count -ne 10) {
    throw "Expected 10 slides, found $($presentation.Slides.Count)"
  }
  $allText = foreach ($slide in $presentation.Slides) {
    foreach ($shape in $slide.Shapes) {
      if ($shape.HasTextFrame -and $shape.TextFrame.HasText) { $shape.TextFrame.TextRange.Text }
    }
  }
  $joined = ($allText -join "`n")
  $required = @(
    'Organizador para Programadores',
    'fragmentação',
    'Programador solo',
    'IA',
    'confirmar',
    'indisponível',
    'requisitos',
    'validação'
  )
  foreach ($term in $required) {
    if ($joined -notmatch [regex]::Escape($term)) { throw "Missing required content: $term" }
  }
  Write-Output "PASS: 10 slides and required defense content found."
}
finally {
  if ($presentation) { $presentation.Close() }
  if ($ppt) { $ppt.Quit() }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}



