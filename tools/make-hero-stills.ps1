# Regenerates the hero's still images (assets/images/hero/showroom-{1,2,3}[-mobile].webp) from the 3D
# scene, so phones without WebGL, reduced motion and the first paint show the same rooms.
# Needs: a local server on the project folder, agent-browser (npm i -g agent-browser) and Pillow.
#   python -m http.server 8765 --bind 127.0.0.1
#   powershell -File tools/make-hero-stills.ps1 [-Base http://127.0.0.1:8765]
param([string]$Base = "http://127.0.0.1:8765")

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root "assets/images/hero"
$tmp = Join-Path $env:TEMP "ale-stills"
New-Item -ItemType Directory -Force $tmp | Out-Null
$session = "ale-stills"

# hide everything drawn over the canvas (text, buttons, header, the readability veil)
$hide = "const s=document.createElement('style');s.textContent='.site-header,.hero-inner,.room-caption,.room-nav,.tour-controls,.hero-loader,.hotspot,.spot-card,.whatsapp-float,.mobile-actions,.back-to-top{display:none!important}.hero-media::after{display:none!important}';document.head.appendChild(s);'ok'"
function Wait-3D {
    for ($k = 0; $k -lt 60; $k++) {
        $r = agent-browser --session $session eval "document.documentElement.classList.contains('has-3d')"
        if ("$r" -match "true") { Start-Sleep -Seconds 3; return $true }   # let photos and textures settle
        Start-Sleep -Milliseconds 500
    }
    return $false
}

$sizes = @(
    @{ suffix = "";        w = 1600; h = 1000; scale = 1 },
    @{ suffix = "-mobile"; w = 390;  h = 844;  scale = 2 }
)
foreach ($s in $sizes) {
    agent-browser --session $session set viewport $s.w $s.h $s.scale | Out-Null
    for ($i = 0; $i -lt 3; $i++) {
        agent-browser --session $session open "$Base/index.html?shot=$i" | Out-Null
        if (-not (Wait-3D)) { throw "3D scene did not start for shot $i" }
        agent-browser --session $session eval $hide | Out-Null
        $png = Join-Path $tmp ("showroom-{0}{1}.png" -f ($i + 1), $s.suffix)
        agent-browser --session $session screenshot $png | Out-Null
        Write-Host "captured $png"
    }
}
agent-browser --session $session close | Out-Null

python -I -c @"
import sys, glob, os
from PIL import Image
tmp, out = sys.argv[1], sys.argv[2]
for p in sorted(glob.glob(os.path.join(tmp, 'showroom-*.png'))):
    name = os.path.splitext(os.path.basename(p))[0] + '.webp'
    Image.open(p).convert('RGB').save(os.path.join(out, name), 'WEBP', quality=80, method=6)
    print('wrote', name)
"@ $tmp $out
