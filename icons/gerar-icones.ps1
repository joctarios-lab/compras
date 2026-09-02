# Gera os PNGs do icone do CESTA a partir da mesma geometria do icons/icon.svg.
#
# Usa System.Drawing (vem com o Windows) porque o repositorio nao tem — e nao
# deve ter — dependencia de build. Rode com:  powershell -File icons/gerar-icones.ps1
Add-Type -AssemblyName System.Drawing

$COBALTO = '#2A52C9'
$BRANCO  = '#FFFFFF'

function New-Icone {
  param([int]$Tam, [string]$Arquivo, [double]$Escala = 1.0)

  $bmp = New-Object System.Drawing.Bitmap($Tam, $Tam)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $k = $Tam / 512.0

  # --- fundo: quadrado de cantos arredondados, cor chapada ---
  $raio = 128.0 * $k
  $d = $raio * 2
  $fundo = New-Object System.Drawing.Drawing2D.GraphicsPath
  $fundo.AddArc(0, 0, $d, $d, 180, 90)
  $fundo.AddArc(($Tam - $d), 0, $d, $d, 270, 90)
  $fundo.AddArc(($Tam - $d), ($Tam - $d), $d, $d, 0, 90)
  $fundo.AddArc(0, ($Tam - $d), $d, $d, 90, 90)
  $fundo.CloseFigure()
  $brushFundo = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($COBALTO))
  $g.FillPath($brushFundo, $fundo)

  # A zona de seguranca do icone maskable: o desenho encolhe para o recorte
  # circular de alguns lancadores nao comer a alca.
  $g.TranslateTransform(($Tam / 2), ($Tam / 2))
  $g.ScaleTransform($Escala, $Escala)
  $g.TranslateTransform((-$Tam / 2), (-$Tam / 2))

  $branco = [System.Drawing.ColorTranslator]::FromHtml($BRANCO)

  # --- a alca: arco de 180 graus com pontas arredondadas ---
  # Centro (256, 232) e raio 84, como no SVG.
  $penAlca = New-Object System.Drawing.Pen($branco, (40.0 * $k))
  $penAlca.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $penAlca.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $cx = 256.0 * $k; $cy = 232.0 * $k; $r = 84.0 * $k
  $g.DrawArc($penAlca, ($cx - $r), ($cy - $r), ($r * 2), ($r * 2), 180, 180)

  # --- o corpo: trapezio de cantos arredondados, mais estreito embaixo ---
  $brushBranco = New-Object System.Drawing.SolidBrush($branco)
  $corpo = New-Object System.Drawing.Drawing2D.GraphicsPath
  $pontos = @(
    (New-Object System.Drawing.PointF((112.0 * $k), (252.0 * $k))),
    (New-Object System.Drawing.PointF((400.0 * $k), (252.0 * $k))),
    (New-Object System.Drawing.PointF((366.0 * $k), (412.0 * $k))),
    (New-Object System.Drawing.PointF((146.0 * $k), (412.0 * $k)))
  )
  $corpo.AddPolygon($pontos)
  $g.FillPath($brushBranco, $corpo)

  # --- as duas ripas, em negativo sobre o corpo ---
  $brushCobalto = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($COBALTO))
  foreach ($x in @(196.0, 282.0)) {
    $ripa = New-Object System.Drawing.Drawing2D.GraphicsPath
    $rr = 17.0 * $k; $dd = $rr * 2
    $x0 = $x * $k; $y0 = 300.0 * $k; $w = 34.0 * $k; $h = 112.0 * $k
    $ripa.AddArc($x0, $y0, $dd, $dd, 180, 90)
    $ripa.AddArc(($x0 + $w - $dd), $y0, $dd, $dd, 270, 90)
    $ripa.AddArc(($x0 + $w - $dd), ($y0 + $h - $dd), $dd, $dd, 0, 90)
    $ripa.AddArc($x0, ($y0 + $h - $dd), $dd, $dd, 90, 90)
    $ripa.CloseFigure()
    $g.FillPath($brushCobalto, $ripa)
  }

  $caminho = Join-Path $PSScriptRoot $Arquivo
  $bmp.Save($caminho, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "gerado: $Arquivo"
}

New-Icone -Tam 192 -Arquivo 'icon-192.png'
New-Icone -Tam 512 -Arquivo 'icon-512.png'
# O maskable encolhe para caber na zona de seguranca do recorte circular
New-Icone -Tam 512 -Arquivo 'icon-maskable.png' -Escala 0.78
