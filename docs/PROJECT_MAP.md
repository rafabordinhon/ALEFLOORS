# PROJECT_MAP: home 3D do ALEFLOORS

Leia isto e o docs/PLAN.md no início de cada fase. Não re-explore o projeto.

## Site
- HTML estático na raiz (index.html, service.html, ...), **sem bundler**. As partes comuns (head, header, footer, scripts por página, _headers com CSP, _redirects, sitemap) são geradas por `python tools/build.py`. Scripts de uma página entram em `PAGES[...]["js"/"modules"]` no build.py; nunca edite essas partes direto no HTML.
- CSP: `script-src 'self'`, então **toda lib fica em js/vendor/** (sem CDN). WebAssembly não é permitido.
- Deploy: push no `main` do GitHub gera produção no Netlify (site alefloors, id f5fad217-12f4-4c64-931a-db26b730df2a). Prévia: `netlify deploy --dir . --site <id>` **sem --prod**. Formulário Netlify `quote` em contact.html.
- No ar: commit dbe3a00 (v2). Rollback: tag `pre-home-3d-v2`.

## Home: arquivos-chave
- `index.html`: hero `#showroom` (seção alta, 300vh, com `.hero-stage` sticky). Dentro dele: `#heroCanvas`, as imagens estáticas `.hero-still` (fallback), `.room-panel` (texto por cômodo), `.hotspot` com `.spot-card`, `.flake-chip` (amostras de cor), `.room-nav` (etapas clicáveis), `.tour-controls` (seta e "Skip the tour"), `.hero-loader` e `.layer-labels`. Depois vem `#after-tour` (os números).
- `css/home.css`: estilos do hero, painéis, controles, legendas, loader e regras do Lenis (`html.lenis`).
- `js/home.js` (classic, ~260 linhas):
  - Lenis (lerp 0.08) com ScrollTrigger, rodando no `gsap.ticker`;
  - `initShowroom`: progresso 0..1 do hero, troca de cômodo (`ROOM_AT=[0,.24,.68]`), barra de etapas, seta, skip, cartões e evento `ale:flake`;
  - âncoras com `lenis.scrollTo`.
- `js/hero-3d.js` (~360 linhas): entrada, `canUse3D`, carregamento do vendor e de `js/hero/index.js`. `start()` cria o `ctx`, roda os módulos em ordem e mantém o loop (estado, resize, tiers, render, play/pause, dispose e a sequência de início).
- `js/hero/*.js`: cada um é `export default function build(ctx)`. Tira do `ctx` o que usa e devolve o que os seguintes usam. A ordem fica em `js/hero/index.js`:
  - `core` (renderer, cena, câmera, env, helpers mesh/box/load/canvasTexture, M);
  - `props` (paredes antigas, `framed`);
  - `materials` (pisos, Reflector, flake ao vivo);
  - `lights` (preenchimento, spots, feixes, poeira);
  - `scenes/living`, `assets` (GLB .gz + atlas + lightmap, loader), `scenes/garage`, `scenes/outdoor`;
  - `cameraPath` (curvas, `curveAt`, `roomAt`), `ui` (hotspots, `overCopy`).
  - O que muda no loop (`pixelRatio`, `explode`, `sampleSpin`, `idle`) é `let` no `start()`; o `pixelRatio` é espelhado em `ctx.pixelRatio`.
- `js/hero/floorFx.js` (depois de materials): `ctx.addFloorFx(mat, {x0,x1})` devolve `{reveal, sweep, sweepAmt}`, e o loop chama `ctx.updateFloorFx()`. Shader via `onBeforeCompile`: concreto cru → acabado (cortina em x, com borda quente) e faixa de luz em x. A sala usa no `metallicMat` (`ctx.livingFloor`).
- Momento do piso (no loop do `hero-3d.js`): `floorMoment` sobe em p 0.015..0.065 e desce em 0.12..0.17. A câmera desce 0.45 e inclina; o `.floor-card[data-room]` ganha `.is-on`. Os cartões ficam no `index.html` (HTML real) e o estilo em `home.css`.
- Blender, sala da casa: `scripts/house_living.py`; cozinha: `scripts/house_kitchen.py`. Os dois rodam no fim do `build_all.py`. A cozinha é o cômodo **"b"** no bake e nos arquivos (`room-b.*`, coleção `Cozinha`). A garagem saiu da cena; `js/hero/scenes/garage.js` só serve ao `?old`.
- `js/hero/scenes/kitchen.js`: `ctx.kitchenFloor` (floorFx no `concreteMat`). No loop, `moments[r]` por cômodo (sala 0.015..0.12, cozinha 0.40..0.55, externa na fase 4); a revelação da cozinha dispara na primeira chegada (`kitchenRevealAt`). `hero.is-floor-moment` esconde a legenda do cômodo.
- `tools/split-hero.mjs`: o script que fez a divisão (só histórico).
- Antes da fase 1, o `hero-3d.js` era monolítico (~1100 linhas). Detalhes antigos dele:
  - `canUse3D()`, `start()`, renderer (ACES, shadowMap só da amostra), Reflector no piso, RoomEnvironment (envMap);
  - carrega `assets/3d/room-{a,b,c}.glb(.gz)` com atlas assado (MeshBasic, toneMapped false) e lightMap nos pisos ao vivo;
  - câmera em `CatmullRomCurve3` (`pathPos`/`pathLook`, 7 pontos), `curveAt(p)` com pausas por cômodo, damp, intro e respiração;
  - amostra com vista explodida, cáusticas, poeira, fotos, logo, hotspots projetados;
  - tiers de qualidade (`?tier=`), `compileAsync` (inclui as variantes do reflexo), pausa fora da tela, `dispose()`, marcas `hero3d:*`.
  - Parâmetros: `?no3d`, `?shot=0|1|2` (gera as imagens estáticas), `?old`.
- `js/vendor/`: three.module.min.js 0.170.0, GLTFLoader, BufferGeometryUtils, Reflector, RoomEnvironment, gsap 3.12.5, ScrollTrigger, lenis 1.1.13.
- `assets/3d/`: GLBs quantizados (KHR_mesh_quantization) + .gz, atlas `*-atlas(-m).webp`, `*-floor-light(-m).webp`, `floor-metallic*.webp`, `view-sunset.webp`.

## Tour (fase 5)
- Curva em `cameraPath.js` (pontos 0, 3 e 6 = sala, cozinha, deck; `curveAt` pausa em 0..0.1, 0.42..0.58 e 0.9..1).
- Porta de correr: `kitchen.js` (`ctx.setDoorOpen(k)`), que o loop abre em p 0.58..0.70.
- Luz interior → entardecer: `ctx.hemi` + `scene.background`, misturados no loop em p 0.62..0.88.
- Etapas: Living room / Kitchen / Pool deck (`ROOM_AT=[0,.24,.68]` no home.js e `roomAt` iguais).

## Pipeline do Blender (fora do repo)
`C:\Users\rafael.bordinhon\ALEFLOORS-blender\scripts\`:
- `build_all.py`: monta a cena e salva `blend/03-v2-cena.blend`;
- `bake_room.py <a|b|c> 96 2048 1024`: bake Cycles na CPU, ~6 min por cômodo, com atlas AgX e lightmap do piso; peças `solo` com UV própria;
- `publish_assets.ps1 -Site <repo>`: quantiza, gera WebP e gzip;
- `lib.py`: helpers `Room.box/cyl/rod/torus/plant` em coordenadas do Three (T = Z para cima).
- Blender 5.2 em `C:\Program Files\Blender Foundation\Blender 5.2\`. Sem GPU (UHD 630).

## Coordenadas atuais (Three, Y para cima)
- Sala A: x -4.5..4.5, z -4.5..7 (janela ao norte em x 1.4..4.5).
- Garagem B: x -13.5..-4.5, z -4.5..4.5.
- Área externa C (fase 4): quintal x -15..-1.5, z -17..-4.5, a céu aberto, ao norte da cozinha (a porta da cozinha fica em z -4.5, x -9). Piscina x -12..-5, z -12.6..-9. Muro de pedra em z -15.2 (logo em z -15.03). `scenes/outdoor.js`: `pool`/`yard` (com `?old` a sala de piscina interna), cúpula do céu (r 70, câmera com far 120), gramado em 4 faixas, `ctx.outdoorFloor` (floorFx no `deckFlakeMat`, criado em materials.js).
- Blender: `scripts/house_outdoor.py` (+ `make_sky.py`). Objetos `NB_` (cúpula de céu, gramado) iluminam o bake mas não entram nele.
- Teto H=3.6. Portas de 3.4 x 3.

## Medir e testar
- `python -m http.server 8765 --bind 127.0.0.1`, depois `powershell -File tools/perf/measure.ps1 -Label X`: KB transferidos, primeiro quadro e FPS parado/rolando, no desktop e no celular emulado (agent-browser).
- `tools/perf/wheel-rec.js`: grava scrollY por quadro após um giro de rodinha.
- `tools/make-hero-stills.ps1`: regenera as imagens estáticas a partir de `?shot`.
