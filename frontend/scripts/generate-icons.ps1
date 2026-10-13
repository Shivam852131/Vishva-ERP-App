Add-Type -AssemblyName System.Drawing

$resDir = "C:\Users\shiva\OneDrive\Desktop\vishva ERP app\frontend\android\app\src\main\res"
$assetDir = "C:\Users\shiva\OneDrive\Desktop\vishva ERP app\frontend\assets\images"

$mipmapSizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

$assetSizes = @{
    "icon.png" = 1024
    "adaptive-icon.png" = 1024
    "favicon.png" = 48
    "splash-image.png" = 200
}

function New-ViLogo([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Clip to rounded squircle
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $radius = $size * 0.22
    $diameter = $radius * 2
    $path.StartFigure()
    $path.AddArc(0, 0, $diameter, $diameter, 180, 90)
    $path.AddArc($size - $diameter, 0, $diameter, $diameter, 270, 90)
    $path.AddArc($size - $diameter, $size - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc(0, $size - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    $g.SetClip($path)

    # Background gradient: blue (#2563EB) top-left to teal (#0EA5E9) bottom-right
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF(0, 0)),
        (New-Object System.Drawing.PointF($size, $size)),
        [System.Drawing.Color]::FromArgb(255, 37, 99, 235),
        [System.Drawing.Color]::FromArgb(255, 14, 165, 233)
    )
    $g.FillRectangle($brush, 0, 0, $size, $size)

    # Draw "V"
    $vFontSize = $size * 0.48
    $vFont = New-Object System.Drawing.Font("Segoe UI", $vFontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $vBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $vWidth = $g.MeasureString("V", $vFont).Width
    $totalTextWidth = $size * 0.72
    $vX = ($size - $totalTextWidth) / 2 + $size * 0.02
    $vY = $size * 0.18
    $g.DrawString("V", $vFont, $vBrush, $vX, $vY)

    # Draw "i"
    $iFontSize = $size * 0.32
    $iFont = New-Object System.Drawing.Font("Segoe UI", $iFontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $iX = $vX + $vWidth * 0.68
    $iY = $size * 0.30
    $g.DrawString("i", $iFont, $vBrush, $iX, $iY)

    # Draw dot above "i"
    $dotSize = $size * 0.08
    $dotX = $iX + $g.MeasureString("i", $iFont).Width * 0.5 - $dotSize * 0.5
    $dotY = $iY - $dotSize - $size * 0.04
    $g.FillEllipse($vBrush, $dotX, $dotY, $dotSize, $dotSize)

    $brush.Dispose()
    $vFont.Dispose()
    $iFont.Dispose()
    $vBrush.Dispose()
    $path.Dispose()
    $g.Dispose()

    return $bmp
}

Write-Host "=========================================="
Write-Host "  Vishva ERP - Icon & Image Generator"
Write-Host "=========================================="
Write-Host ""

# ── 1. Generate Android mipmap icons ──
Write-Host "[1/3] Generating Android mipmap icons..."
foreach ($folder in $mipmapSizes.Keys) {
    $targetSize = $mipmapSizes[$folder]
    $targetDir = Join-Path $resDir $folder

    # ic_launcher.png (rounded square)
    $bitmap = New-ViLogo $targetSize
    $outPath = Join-Path $targetDir "ic_launcher.png"
    $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
    Write-Host "  $folder/ic_launcher.png ($targetSize x $targetSize)"

    # ic_launcher_round.png (circular)
    $bitmapSrc = New-ViLogo $targetSize
    $bitmapRound = New-Object System.Drawing.Bitmap($targetSize, $targetSize)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmapRound)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $circlePath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $circlePath.AddEllipse(0, 0, $targetSize, $targetSize)
    $graphics.SetClip($circlePath)
    $graphics.DrawImage($bitmapSrc, 0, 0, $targetSize, $targetSize)
    $outPath2 = Join-Path $targetDir "ic_launcher_round.png"
    $bitmapRound.Save($outPath2, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmapSrc.Dispose()
    $bitmapRound.Dispose()
    $circlePath.Dispose()
    Write-Host "  $folder/ic_launcher_round.png ($targetSize x $targetSize)"
}
Write-Host ""

# ── 2. Generate asset images ──
Write-Host "[2/3] Generating asset images..."
foreach ($name in $assetSizes.Keys) {
    $targetSize = $assetSizes[$name]
    $bitmap = New-ViLogo $targetSize
    $outPath = Join-Path $assetDir $name
    $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
    Write-Host "  $name ($targetSize x $targetSize)"
}
Write-Host ""

# ── 3. Generate web manifest icon ──
Write-Host "[3/3] Generating web manifest icon..."
$webIcon = New-ViLogo 512
$webIconPath = Join-Path $assetDir "icon-512.png"
$webIcon.Save($webIconPath, [System.Drawing.Imaging.ImageFormat]::Png)
$webIcon.Dispose()
Write-Host "  icon-512.png (512 x 512)"
Write-Host ""

Write-Host "=========================================="
Write-Host "  All images generated successfully!"
Write-Host "=========================================="
Write-Host ""
Write-Host "Generated files:"
Write-Host "  Android mipmap: 10 files (ic_launcher + ic_launcher_round x 5 densities)"
Write-Host "  Asset images: 5 files (icon, adaptive-icon, favicon, splash-image, icon-512)"
