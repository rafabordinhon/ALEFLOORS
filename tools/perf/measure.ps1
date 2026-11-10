# Mede a home: bytes transferidos, cena pronta e FPS (parado e rolando), desktop e celular emulado.
param([string]$Url = "http://127.0.0.1:8765/", [string]$Label = "")
$s = "ale-perf"
$m = Join-Path $PSScriptRoot "measure.js"
$js = "window.__m = 'running'; " + (Get-Content $m -Raw).TrimEnd().TrimEnd(';') + ".then(r => { window.__m = r; }); 'started'"
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($js))
foreach ($v in @(@{n='desktop'; w=1280; h=800}, @{n='celular'; dev='iPhone 14'})) {
    agent-browser --session $s close 2>&1 | Out-Null
    if ($v.dev) { agent-browser --session $s set device $v.dev 2>&1 | Out-Null } else { agent-browser --session $s set viewport $v.w $v.h 2>&1 | Out-Null }
    agent-browser --session $s open $Url 2>&1 | Out-Null
    agent-browser --session $s eval -b $b64 2>&1 | Out-Null
    $r = $null
    for ($i = 0; $i -lt 45; $i++) { Start-Sleep -Seconds 1; $r = agent-browser --session $s eval "window.__m" 2>&1; if ("$r" -match 'initialKB') { break } }
    $o = ("$r" | ConvertFrom-Json) | ConvertFrom-Json
    $first = agent-browser --session $s eval "Math.round((performance.getEntriesByName('hero3d:first-frame')[0]||{}).startTime||0)" 2>&1
    $sent = agent-browser --session $s eval "Math.round(performance.getEntriesByType('resource').reduce((a,r)=>a+r.transferSize,0)/1024)" 2>&1
    "{0,-8} {1,-8} transferido={2} KB  primeiro-quadro={3} ms  FPS parado={4} (pior {5} ms)  rolando={6} (pior {7} ms)  erros={8}" -f $Label, $v.n, $sent, $first, $o.idle.fps, $o.idle.worstFrameMs, $o.scroll.fps, $o.scroll.worstFrameMs, ((agent-browser --session $s errors 2>&1) -join ' ').Length
}
agent-browser --session $s close 2>&1 | Out-Null

