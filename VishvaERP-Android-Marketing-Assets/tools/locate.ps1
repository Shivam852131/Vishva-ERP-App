# locate.ps1 - Find colored UI regions in a screenshot (exact pixel coordinates).
# Usage: .\locate.ps1 -Path <png> [-Filter cyan|white|red|purple|all] [-MinArea 400]
param(
    [Parameter(Mandatory = $true)][string]$Path,
    [string]$Filter = "cyan",
    [int]$MinArea = 400,
    # Optional crop: "x,y,w,h" to isolate adjacent elements
    [string]$Region = ""
)

$targetPath = $Path
$offsetX = 0; $offsetY = 0
if ($Region) {
    $parts = $Region -split ',' | ForEach-Object { [int]$_.Trim() }
    $rx = $parts[0]; $ry = $parts[1]; $rw = $parts[2]; $rh = $parts[3]
    Add-Type -AssemblyName System.Drawing
    $orig = New-Object System.Drawing.Bitmap($Path)
    $rect = New-Object System.Drawing.Rectangle($rx, $ry, $rw, $rh)
    $crop = $orig.Clone($rect, $orig.PixelFormat)
    $tmp = [System.IO.Path]::GetTempFileName() + ".png"
    $crop.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
    $crop.Dispose(); $orig.Dispose()
    $targetPath = $tmp
    $offsetX = $rx; $offsetY = $ry
}
function Write-Bands([string]$raw) {
    foreach ($line in ($raw -split "`n")) {
        if ($line -like "BAND*") {
            # shift coordinates back to full-screen space
            $m = [regex]::Match($line, 'y\[(\d+)-(\d+)\] x\[(\d+)-(\d+)\] center=\((\d+),(\d+)\) area=(\d+)')
            if ($m.Success) {
                $y0 = [int]$m.Groups[1].Value + $offsetY
                $y1 = [int]$m.Groups[2].Value + $offsetY
                $x0 = [int]$m.Groups[3].Value + $offsetX
                $x1 = [int]$m.Groups[4].Value + $offsetX
                $cx = [int]$m.Groups[5].Value + $offsetX
                $cy = [int]$m.Groups[6].Value + $offsetY
                Write-Output ("BAND y[{0}-{1}] x[{2}-{3}] center=({4},{5}) area={6}" -f $y0, $y1, $x0, $x1, $cx, $cy, $m.Groups[7].Value)
            }
        } else {
            Write-Output $line
        }
    }
}

$src = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Collections.Generic;

public class RegionFinder {
    public static string Run(string path, string filter, int minArea) {
        Bitmap bmp = new Bitmap(path);
        int w = bmp.Width, h = bmp.Height;
        Rectangle rect = new Rectangle(0, 0, w, h);
        BitmapData data = bmp.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        int stride = data.Stride;
        byte[] buf = new byte[stride * h];
        Marshal.Copy(data.Scan0, buf, 0, buf.Length);
        bmp.UnlockBits(data);
        bmp.Dispose();

        int[] rowCnt = new int[h];
        int[] rowMin = new int[h];
        int[] rowMax = new int[h];

        for (int y = 0; y < h; y++) {
            int off = y * stride;
            int cnt = 0, minx = -1, maxx = -1;
            for (int x = 0; x < w; x++) {
                int i = off + x * 4;
                int b = buf[i], g = buf[i+1], r = buf[i+2];
                bool match = false;
                switch (filter) {
                    case "cyan":   match = (r < 130 && g > 170 && b > 190); break;
                    case "white":  match = (r > 235 && g > 235 && b > 235); break;
                    case "red":    match = (r > 180 && g < 110 && b < 110); break;
                    case "purple": match = (r > 120 && r < 210 && g < 130 && b > 190); break;
                    default:       match = (r > 200 || g > 200 || b > 200); break;
                }
                if (match) { cnt++; if (minx < 0) minx = x; maxx = x; }
            }
            rowCnt[y] = cnt; rowMin[y] = minx; rowMax[y] = maxx;
        }

        var outp = new List<string>();
        outp.Add("SCREEN: " + w + "x" + h + " FILTER: " + filter);
        int s = -1, cmin = int.MaxValue, cmax = -1, ccount = 0;
        for (int y = 0; y <= h; y++) {
            bool active = (y < h) && rowCnt[y] > 0;
            if (active) {
                if (s < 0) s = y;
                if (rowMin[y] < cmin) cmin = rowMin[y];
                if (rowMax[y] > cmax) cmax = rowMax[y];
                ccount += rowCnt[y];
            } else {
                if (s >= 0 && ccount >= minArea) {
                    outp.Add(string.Format("BAND y[{0}-{1}] x[{2}-{3}] center=({4},{5}) area={6}",
                        s, y-1, cmin, cmax, (cmin+cmax)/2, (s+y-1)/2, ccount));
                }
                s = -1; cmin = int.MaxValue; cmax = -1; ccount = 0;
            }
        }
        return string.Join("\n", outp);
    }
}
"@

Add-Type -TypeDefinition $src -ReferencedAssemblies System.Drawing

$raw = [RegionFinder]::Run((Resolve-Path $targetPath).Path, $Filter, $MinArea)
Write-Bands $raw
if ($targetPath -ne $Path -and (Test-Path $targetPath)) { Remove-Item $targetPath -Force -ErrorAction SilentlyContinue }
