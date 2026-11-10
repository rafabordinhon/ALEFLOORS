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
- [ ] **FASE 7: prévia.** `netlify deploy` sem --prod, enviar o link e PARAR.

## Critérios de aceite (todas as fases)
- Console sem erros.
- 60 fps em PC mediano.
- Nada flutuando, atravessando ou fora de escala.
- Conteúdo, links, WhatsApp, formulário e SEO intactos.
