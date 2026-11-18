# PLAN: tour da casa (sala, cozinha, área externa com piscina)

Branch: `tour-casa`, criada de `home-3d-v3` (326c941). É a v3 em prévia, com a rolagem uniforme. A produção continua em dbe3a00.
Regras: uma fase por vez; ao fim, atualizar PROJECT_MAP.md e este arquivo, fazer commit, escrever "FASE X OK" e PARAR. Máximo de 3 screenshots por fase (desktop, escala 0.5). Celular só na fase 6. Deploy só de prévia, na fase 7, depois do OK do Rafael.

## Linha de base (fase 0, tools/perf/measure.ps1, UHD 630, localhost)
| | KB transferidos (tour inteiro) | primeiro quadro | FPS parado / rolando (pior quadro) |
|---|---|---|---|
| desktop 1280 | 4.254 | 3,2–3,3 s | 57–60 / 57–59 (34–83 ms) |
| celular (iPhone 14 emulado) | 3.176 | 2,7 s | 60 / 59 (50 ms) |
Console: 0 erros.

## Decisões de base
- **Realismo pela luz:** estrutura e props estáticos assados no Blender (luz, sombra suave e AO no atlas, como hoje). Ao vivo no Three ficam os pisos (material próprio + lightMap), a água, os objetos animados, os efeitos do "momento do piso" e a porta de vidro.
- **Props:** primitivas e instâncias, modelados por script no Blender (lib.py) e assados. .glb de terceiros só da lista aprovada na fase 1 (≤ ~300 KB comprimido cada).
- **Layout da casa** (Three, Y para cima; reaproveita a grade atual):
  - SALA x -5..5, z -4..7. A câmera entra pelo sul.
  - COZINHA integrada a oeste: x -14..-5, z -4..4, aberta para a sala, sem parede.
  - Parede de vidro com porta de correr ao norte da cozinha (z -4).
  - ÁREA EXTERNA ao norte: x -18..0, z -22..-4. Céu aberto, deck, piscina, palmeiras e lanai opcional.
  - A garagem sai da rota. O módulo `garage.js` fica previsto, mas sem conteúdo.
- **Pisos:** sala = Metallic Epoxy (veios de pérola e carvão, verniz); cozinha = Polished Concrete (cinza claro, acetinado); externa = Polyaspartic/flake antiderrapante. Os chips de cor de flake vão para a externa.
- **"Momento do piso" por cômodo:** na pausa da câmera, ela desce e inclina para o chão; uma faixa de luz varre o piso (uniform `uSweep`); a cortina de revelação (uniform `uReveal`) passa de concreto cru a piso acabado, com borda suave em coordenadas do mundo. Aparece o cartão HTML do piso (nome, 2 a 3 benefícios e amostras clicáveis). Tudo via `onBeforeCompile` num material de piso compartilhado.

## Estrutura de módulos (fase 1)
```
js/hero-3d.js              entrada: canUse3D, carrega o vendor e chama tour/start
js/hero/core.js            renderer, cena, câmera, resize, tiers, loop no gsap.ticker, compileAsync, dispose
js/hero/assets.js          LoadingManager, GLB .gz, texturas (-m no celular), barra de progresso
js/hero/materials.js       pisos (metallic, concrete, flake) + shader de revelação e varredura; materiais assados
js/hero/lights.js          hemisfério, envMap/PMREM, spots com sombra, mistura interior/exterior
js/hero/props.js           helpers box/cyl/instanced e objetos ao vivo (água, chamas, amostra)
js/hero/cameraPath.js      curvas pos/look, curveAt(p), pausas, momento do piso, intro e respiração
js/hero/ui.js              hotspots, legendas, cartões de piso pinados (projeção)
js/hero/scenes/living.js   sala   (montagem ao vivo + carga do room-living.glb)
js/hero/scenes/kitchen.js  cozinha
js/hero/scenes/outdoor.js  área externa (céu, água, palmeiras animadas)
js/hero/scenes/garage.js   reservado (vazio)
```
Blender: `scripts/house/{living,kitchen,outdoor}.py` mais o `lib.py` atual; `bake_room.py` com configs `living|kitchen|outdoor`.

## Fases
- [x] **FASE 0: mapa e plano.** PROJECT_MAP, PLAN, branch, linha de base, scripts de medição em tools/perf.
- [x] **FASE 1: arquitetura.**
  - Dividido em `js/hero/` (core, props, materials, lights, assets, cameraPath, ui, scenes/living|garage|outdoor) com `ctx`. `hero-3d.js` foi de 1.107 para ~360 linhas.
  - Visual idêntico: diferença de 0,03 a 0,04% dos pixels nos `?shot=0|1|2` (só poeira e chama, que se movem). FPS e peso iguais. `?old` e `?no3d` ok, console limpo.
  - Os módulos `kitchen.js` e `outdoor.js` novos nascem nas fases 3 e 4. `garage.js` fica com a garagem atual até sair da rota.
  - **Biblioteca de props** (procedural, sem licença de terceiros): tudo modelado por script no Blender (`lib.py`: box com chanfro, cilindro, tubo em curva, toro, planta, tecido simulado) e assado.
    - Sala: sofá modular, poltronas, mesa de centro com livros, vaso e bandeja, tapete, painel de pedra, lareira, prateleiras com luz, ripado, luminária de anéis, cortinas, quadros, plantas.
    - Cozinha: ilha, banquetas, pendentes, armários, bancada, backsplash, geladeira, cooktop, coifa, forno, cesta, tábua.
    - Externa: deck, borda da piscina, escada de inox, espreguiçadeiras, guarda-sol, palmeiras (tronco em curva com folhas), arbustos, luzes de jardim, pergolado.
    - Ao vivo no Three: água, chamas, amostra explodida, porta de correr, céu.
  - **Lista de .glb de terceiros: nenhum.** Proposta aguardando aprovação do Rafael: tudo procedural. Motivos: os .glb livres realistas que existem passam muito de ~300 KB (Poly Haven) ou são low-poly estilizados (Kenney, Quaternius); a pesquisa do carro já mostrou isso.
- [x] **FASE 2: SALA.** Feito:
  - Sofá modular em L, 2 poltronas de bouclé, luminária de anéis, LED nas prateleiras, quadro e planta (`house_living.py`). Cortinas translúcidas ao vivo.
  - `floorFx` (revelação concreto → acabado na abertura e faixa de luz no momento do piso) e cartão de piso em HTML.
  - Medido: 4.500 / 3.381 KB; 56–60 FPS; console limpo.
  - Pendências: room-a.glb.gz subiu para 456 KB (36,5 mil triângulos), a reduzir na fase 6 (anéis e chanfros). O metálico não tem amostras de cor no site, então o cartão não tem chips.
- **Itens originais da FASE 2:**
  - Itens: painel de pedra com prateleiras iluminadas e lareira linear, ripado, luminária de anéis, cove, cortinas translúcidas, quadros, plantas, sofá modular, poltronas, tapete, mesa de centro com objetos, parede de vidro com pôr do sol.
  - Piso metálico + momento do piso.
- [x] **FASE 3: COZINHA.** Feito:
  - Cozinha integrada no lugar da garagem (sem a parede sala/cozinha, `house_kitchen.py`): armários, bancada, backsplash, LED, cooktop e coifa, cuba e torneira, geladeira, torre de forno, ilha em cascata, 3 banquetas, 3 pendentes e objetos.
  - Piso de concreto polido (`concreteMat`) com revelação na primeira chegada e momento do piso; cartão "Polished Concrete". O texto do cômodo some enquanto o cartão aparece.
  - HTML: etapas "Living room / Kitchen / Pool deck"; os textos dos cômodos 2 e 3 trocados (o flake e os chips foram para o deck); hotspot 2 = concreto polido.
  - Medido: 3.880 / 2.910 KB; 57–60 FPS; console limpo.
- **Itens originais da FASE 3:**
  - Itens: ilha com banquetas e pendentes, armários, bancada, backsplash, eletrodomésticos simples, cesta, vasos, tábua.
  - Piso de concreto polido + momento do piso.
- [x] **FASE 4: ÁREA EXTERNA.** Feito:
  - Piscina externa: sem paredes nem teto, quintal x -15..-1.5, z -17..-4.5, piscina 7 x 3,6 m (`house_outdoor.py`). Borda, escada de inox com flanges e degraus, luzes na água, muro de pedra iluminado com o logo, mureta, cerca viva, 8 palmeiras, pergolado com 2 espreguiçadeiras e mesinha, guarda-sol, vasos e balizadores.
  - Luz: sol baixo a oeste + cúpula de céu emissiva (`NB_`). No site, cúpula com `sky.webp` (23 KB) e gramado em 4 faixas.
  - Deck de flake opaco (`deckFlakeMat`) com UV do mundo, revelação na chegada e momento do piso. Cartão "Polyaspartic Pool Deck" com as amostras de flake (trocar a cor funciona).
  - Corrigido: água verde (o gramado passava dentro da piscina); foto e moldura FS7 flutuando (a parede oeste da sala virou a abertura da cozinha).
  - Medido: 3.959 / 2.957 KB; 56–60 FPS; console limpo.
  - **Pendência (fase 6):** as palmeiras ficaram ralas (folhas finas parecem galhos secos). Engrossar e encher a coroa e assar a "c" de novo.
- **Itens originais da FASE 4:**
  - Céu de entardecer (skybox), deck flake/polyaspartic, piscina externa com borda.
  - Escada de inox na escala e fixada (reaproveitar a curva atual), espreguiçadeiras, guarda-sol, palmeiras, luzes de jardim e da água, pergolado ou cozinha externa se couber.
  - Momento do piso + chips de cor do flake.
- [x] **FASE 5: O TOUR.** Feito:
  - Curva nova (`cameraPath.js`): sala → cozinha contornando a ilha → porta → deck, com folgas conferidas.
  - Porta de vidro de correr ao vivo (`kitchen.js`, `ctx.setDoorOpen`): abre em p 0.58..0.70; a câmera cruza em ~0.73.
  - Luz: a hemisfera e o fundo vão do interior quente ao entardecer em p 0.62..0.88.
  - As etapas acendem certo (sala 0, cozinha a partir de 0.24, deck a partir de 0.68). Lenis, skip, teclado e etapas clicáveis já vinham da v3.
  - Medido: 3.962 / 2.961 KB; desktop 56 FPS; console limpo.
  - **Para a fase 6:** o celular emulado teve 1 quadro de 383 ms na rolagem. Hipótese: texturas da área externa (céu, gramado) chegam depois do `compileAsync` e só vão para a GPU na primeira vez que aparecem. Investigar com as marcas antes de corrigir.
- **Itens originais da FASE 5:**
  - Uma curva contínua sala → cozinha → porta de vidro que abre sozinha (pelo progresso) → externa.
  - Luz mudando aos poucos de interior quente para entardecer; transições suaves.
  - Lenis + ScrollTrigger (já prontos), "Skip the tour", teclado, etapas clicáveis (Living room, Kitchen, Pool deck).
- [x] **FASE 6: desempenho e mobile.** Feito:
  - Travamento investigado. A hipótese das texturas estava errada (elas chegam antes do `compileAsync`). Os quadros longos (67–100 ms) vinham do `backdrop-filter` + `filter: blur` na troca de cartões e textos. Em telas < 1024 px agora só há fade, com vidro fosco de 8 px: **0 quadros > 60 ms no passeio inteiro**.
  - Sala mais leve (anéis 44×6, chanfros com 3 segmentos): 452 → 364 KB. Palmeiras com coroa cheia (18 folhas largas): externa 416 → 477 KB.
  - Versão leve (sem 3D): parallax simples nas imagens estáticas (`--pp`), desligado com reduced-motion. Imagens estáticas regeneradas com a casa nova.
  - Já existiam e foram conferidos: tiers por FPS, pausa fora da tela, `dispose`, barra de progresso, textos em HTML.
  - **Carga sob demanda por cômodo: não fiz.** Carregar a externa no meio do passeio recompila shaders na hora e trava; os 3 cômodos carregam juntos por trás da barra de progresso.
  - Medido contra a linha de base: desktop 4.254 → 3.925 KB, celular 3.176 → 2.942 KB; primeiro quadro 3,2 → 3,1 s e 2,7 → 2,7 s; FPS no desktop 57–60 → 56–57 (UHD 630), no celular 59–60 → 60 (pior quadro 50 → 33 ms). Console limpo.
- **Itens originais da FASE 6:**
  - Tiers por FPS, versão leve com imagens estáticas e parallax, reduced-motion.
  - Carga sob demanda por cômodo com barra de progresso, pausa fora da tela e dispose.
  - Textos em HTML; regenerar as imagens estáticas; medir e comparar com a linha de base; 1 teste de celular.
- [x] **FASE 7: prévia.** https://6af290d9a70e146fe017eff7--alefloors.netlify.app (commit 10d3e16). Conferida com a CSP real: cena carrega, console limpo. Produção intacta. **Aguardando aprovação do Rafael.**
- **Item original da FASE 7:** `netlify deploy` sem --prod, enviar o link e PARAR.

## Critérios de aceite (todas as fases)
- Console sem erros.
- 60 fps em PC mediano.
- Nada flutuando, atravessando ou fora de escala.
- Conteúdo, links, WhatsApp, formulário e SEO intactos.

---

# PLAN 2: realismo do tour (branch `tour-realismo`, só local)

Regras: sem push, sem deploy e sem build no Netlify até o Rafael dizer "pode publicar". Uma fase por vez: commit, "FASE X OK" e parar. Máximo de 3 screenshots por fase.

## FASE 0: diagnóstico (feito, nada alterado no site)
- **Palmeiras pixeladas, causa:** elas não têm textura própria. São geometria assada no `room-c-atlas.webp` (2048 px para o quintal inteiro), e o bake dá a cada face uma ilha de poucos texels de cor chapada. De perto, cada folha vira um mosaico de blocos. Não há alpha: a folha é uma fita de 24 faces, com borda reta.
- **O que não é a causa:** mipmaps (ligados, padrão do TextureLoader) e anisotropia (8, em `core.js` e `assets.js`).
- **Agravantes:** MSAA só no desktop (`antialias: !mobile`); o céu tem 2048 px para 360°, cerca de 285 texels na largura da tela; a qualidade adaptativa (`hero-3d.js` 149–165) baixa o pixel ratio em passos de 0,25 até 1 **também no desktop** quando mais da metade dos quadros passa de 26 ms (comum na UHD 630).
- **Como é feito hoje:**
  - Cozinha: `house_kitchen.py` (caixas do `lib.py`), tudo assado em `room-b-atlas` (MeshBasic, sem reflexo); ao vivo só o piso (`concreteMat`) e a porta de vidro (`kitchen.js`).
  - Palmeiras, sebes, pergolado, muro: `house_outdoor.py`, assados no `room-c-atlas`.
  - Céu: esfera r 70 com `sky.webp` (23 KB, gerado por `make_sky.py`), MeshBasic.
  - Água: `MeshPhysicalMaterial` com normal de ondas pintada em canvas e rolada; cáusticas em camadas de textura; sem reflexo do céu real (envMap é o RoomEnvironment).
  - Logo: canvas 1024×256 com as fontes do site num plano + halo (plano com gradiente), em `outdoor.js` 179–209.
- **Limite da CSP:** `script-src 'self'` sem WebAssembly. KTX2/Basis e Meshopt precisam de WASM; Draco só com o decodificador JS (lento, ~700 KB). Proposta: manter WebP + quantização + gzip, que já são usados.

## Assets propostos (aguardando OK)
| Asset | Fonte / licença | Download | Peso no site |
|---|---|---|---|
| HDRI `qwantani_dusk_2_puresky` 2k | Poly Haven, CC0 | 4,6 MB (.hdr) | céu WebP 4096×2048 ~250 KB + env .hdr 512 px ~150 KB |
| `oak_veneer_01` 1k (cor, normal, ARM) | Poly Haven, CC0 | 2,1 MB | 0 (entra no bake) + normal 512 ~40 KB |
| `marble_01` 1k | Poly Haven, CC0 | 0,5 MB | 0 (bake) |
| `Travertine009` 1K | ambientCG, CC0 | 3,3 MB (zip) | 0 (bake) |
| `palm_tree_bark` 1k (cor, normal) | Poly Haven, CC0 | 3,5 MB | WebP 512×1024 ~80 KB |
| Folha de palmeira (cartão com alpha) | feita por nós no Blender | 0 | WebP 2048×1024 ~150 KB |
| Schibsted Grotesk Bold, Newsreader Medium Italic | Google Fonts, SIL OFL 1.1 | ~0,5 MB | 0 (viram geometria do logo, ~30 KB) |
| `RGBELoader.js` (three 0.170) | three.js, MIT | ~10 KB | ~10 KB |
- Nenhum .glb de terceiros: o Poly Haven não tem palmeira (conferido nos 521 modelos) e os arbustos de lá pesam 2 MB ou mais.
- Estimativa: +0,6 a 0,8 MB no desktop (hoje 3,9 MB), menos no celular.

## Fases seguintes
- [x] **FASE 1: qualidade global de render.** Feito:
  - HDRI de entardecer (`assets/3d/env-dusk.hdr`, 512 px, 223 KB) via PMREM, usado pela água e pelo deck (`ctx.useDuskEnv(mat)`). O interior segue com o RoomEnvironment, porque a luz dele é assada. Tone mapping ACES e saída sRGB já estavam certos.
  - MSAA ligado também no celular; anisotropia 16 no desktop (8 no celular), agora também nas texturas de canvas.
  - Qualidade adaptativa: só aparelho fraco (celular, ≤ 4 GB ou ≤ 4 núcleos) baixa o pixel ratio; o desktop mantém e abre mão de efeitos (`minPixelRatio`).
  - Sombras de contato: `contactShadows.js` desenha uma vez, de baixo para cima, o que está a até 0,5 m do piso, borra e entrega ao shader dos pisos (`setFloorContact` no `floorFx.js`). Efeito ainda discreto sob as banquetas (pés finos); reforçar no bake da fase 2.
  - Tentativa descartada: plano transparente de sombra sobre o piso custava ~10 FPS na UHD 630 (47 contra 59).
  - Medido: desktop 4.162 KB, 60 / 58 FPS, primeiro quadro 3,3 s; celular 3.180 KB, 60 / 60 FPS, 2,7 s; console limpo.
  - Pendências: girar o env para casar com o sol do céu (fase 3, `envMapRotation`); o céu `sky-dusk` já foi gerado do HDRI (2048 px, fora do repo) e entra na fase 3. No Windows, rodar o `measure.ps1` pelo pwsh (`& ./tools/perf/measure.ps1`); o `powershell -File` é barrado pela política de execução.
- [x] **FASE 2: cozinha.** Feito (`house_kitchen.py` reescrito; o antigo ficou em `house_kitchen_v1.py`):
  - Armários shaker (almofada + moldura): baixos e colunas em grafite com puxadores de latão, altos e ilha em carvalho (`oak_veneer_01`). LED sob os altos e luz indireta em cima.
  - Pedra clara com veios (procedural 3D, contínua entre bancada, backsplash e cascata da ilha); bancada de 4 cm, ilha de 6 cm com cascata nas duas pontas.
  - Coifa em gesso com régua de inox, cooktop de indução, cuba embutida, torneira bica alta em latão, lava-louça integrada, torre com 2 fornos, geladeira de inox de duas portas com puxadores, despensa.
  - Objetos: cafeteira, tábuas, porta-facas, fruteira, livros, vaso com ramos, ervas em vasinhos, prateleiras abertas com cerâmicas, banquetas estofadas com apoio de pé em latão, 6 spots embutidos.
  - Pendentes ao vivo (`kitchen.js`): globo de vidro fumê, lâmpada quente e ferragens de latão; refletem no piso. A área em frente à ilha (lado leste) segue livre.
  - **Bake:** os móveis viram um objeto só com UV contínua e atlas próprio (`room-b-furn.*`, opção `group` do `bake_room.py`), com reflexo visto da câmera do passeio (`glossy_cam`) e denoise. `room-b.*` ficou só com paredes e teto (3 KB). Bake da cozinha: ~14 min.
  - `marble_01` (Poly Haven) não foi usado: é piso de placas bege, não mármore com veios. `Travertine009` fica para o logo.
  - Medido: desktop 4.330 KB, 60 / 57 FPS, 3,3 s; celular 3.296 KB, 60 / 59 FPS, 3,0 s; console limpo.
  - Pendência (fase 5): o atlas dos móveis desperdiça área com faces escondidas (fundos e bases das caixas); apagar essas faces antes do bake dá mais nitidez de graça.
- [x] **FASE 3: área da piscina.** Feito, com uma pendência de FPS no desktop (abaixo):
  - Palmeiras ao vivo (`js/hero/scenes/palms.js`): 8 próximas (mesmos lugares da sombra assada) + 12 distantes que somem na névoa. Tronco em tubo curvo com `palm-bark.webp` (72 KB); folhas em cartões arqueados com textura desenhada em canvas (cor + alpha separados), `alphaToCoverage` e balanço de vento no shader. Duas malhas no total; luz pintada nas cores dos vértices.
  - No Blender as palmeiras viraram `NB_` (só sombra). `bake_room.py` com `smart=True` no cômodo c (UV contínua). Travertino (`Travertine009`) na borda da piscina e no muro do logo; sebe com folhagem procedural. Bake c: ~7 min.
  - Céu: `sky-dusk.webp` (19 KB) feito do HDRI, com **correção de cor forte** (o HDRI puro sai quase branco) + silhueta de árvores e telhados em canvas num anel. `sky.webp` antigo removido.
  - Água: `Reflector` próprio com shader (`PoolWater` em `outdoor.js`): reflexo real do quintal, duas camadas de ondas, fresnel. Só um espelho por vez: piso da casa até p 0.66, piscina depois (`atPool` no loop). Sem espelhos (tier low) fica o material antigo (`waterPlain`). Cáusticas, pastilhas e luzes da água já existiam.
  - O espelho do piso da casa não desenha as palmeiras (`palmMeshes`).
  - Não feito: `envMapRotation` do env externo (o reflexo da água agora vem do espelho, o env pesa pouco); texturas PBR no pergolado (o veio em caixa sai atravessado nas vigas; ficou a madeira procedural).
  - Medido: celular 3.081 KB, 60 / 59–60 FPS. Desktop 4.105 KB, mas **FPS instável: 47 a 56 parado em 6 medições** (era 60 na fase 2).
  - **Pendência de FPS (diagnóstico):** não é o reflexo das palmeiras no piso (tirar não mudou) nem as palmeiras em si (sem elas deu 49 / 40, com elas 51 / 52 na mesma hora). As medições variam ±5 FPS entre si, logo depois de dois bakes de CPU. Próximo teste: medir o commit da fase 2 (`36ef156`) agora, na mesma condição da máquina, para separar ruído de custo real; se for custo, suspeitos na ordem: anel da silhueta (transparente, tela cheia atrás do vidro da sala), `alphaToCoverage` das folhas, MSAA do segundo espelho.
- [x] **FASE 4: logo.** Feito:
  - Muro de travertino (já assado na fase 3) com letras-caixa 3D em bronze escuro, 6 cm afastadas, 3,36 m de largura. "Ale" em Schibsted Grotesk Bold e "Floors" em Newsreader Medium Italic (TTF estáticos do Fontsource, SIL OFL), extrudadas com chanfro no Blender: `scripts/make_logo.py` → `logo.glb` (54 KB em gzip, 4,5 mil triângulos).
  - Halo quente atrás das letras: `logo-halo.webp` (4 KB), as próprias letras borradas, num plano aditivo; acende em p 0.80..0.94 (`ctx.logoGlow` no loop).
  - Reflete na piscina pelo espelho da água (fase 3). A placa branca com canvas ficou só no `?old`.
  - Medido: celular 3.140 KB, 60 / 59 FPS; desktop 4.164 KB, 47 / 48 FPS (a pendência de FPS do desktop da fase 3 continua aberta para a fase 5); console limpo.
- [x] **FASE 5: desempenho e teste local.** Feito; **aguardando o "pode publicar" do Rafael**:
  - FPS do desktop resolvido. Comparação intercalada com a fase 2 na mesma hora: fase 2 = 60, fases 3–4 = 54–55. O custo estava espalhado (quintal, folhas, silhueta, logo), sem um culpado único; a máquina também oscila ±5 FPS depois de bakes, o que confundiu as primeiras medições.
  - Correção: o espelho do piso da casa não redesenha o quintal (`yardOnly` no `hero-3d.js`: troncos, folhas, `room-c`, logo, silhueta) e ficou sem MSAA próprio (`multisample: 0`). Resultado: 58–60 parado, 56 rolando.
  - `?off=nome,nome` esconde objetos pelo nome (sky, ring, trunks, fronds, logo, room-a|b|c) para achar custo de quadro.
  - Imagens estáticas da versão leve regeneradas (`make-hero-stills.ps1`); `ASSET_V` e as estáticas do `index.html` em `?v=20261111`. `?no3d` e reduced-motion seguem mostrando as estáticas.
  - Teste local com a agent-browser (desktop 1280 e iPhone 14): cozinha, travessia da porta e deck sem erros no console, cartões e amostras de cor no lugar.
  - **Antes e depois** (linha de base = fim do tour-casa):
    | | KB transferidos | primeiro quadro | FPS parado / rolando |
    |---|---|---|---|
    | desktop antes | 3.925 | 3,1 s | 56–57 / 56–57 |
    | desktop depois | 4.171 | 3,3 s | 59 / 56 |
    | celular antes | 2.942 | 2,7 s | 60 / 60 |
    | celular depois | 3.141 | 2,9 s | 60 / 60 |
  - Formatos: texturas em WebP, modelos quantizados + gzip (o logo só com gzip, porque precisa das normais). KTX2, Draco e Meshopt ficaram de fora por causa da CSP sem WebAssembly. Objetos repetidos: palmeiras em 2 malhas; móveis da cozinha em 1.
  - Não feito: apagar as faces escondidas antes do bake dos móveis (nitidez extra); `envMapRotation` do env externo.
  - **Publicação (só com o "pode publicar"):** criar uma tag do `main` atual, levar esta branch ao `main` e fazer um único deploy de produção.
