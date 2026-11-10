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
- [ ] **FASE 1: arquitetura.** Dividir o hero-3d.js nos módulos acima, **sem mudar o visual** (checar com `?shot=0|1|2` antes e depois, idênticos). Definir a biblioteca de props e a **lista de .glb (nome, fonte, licença, KB) para aprovação, antes de baixar.**
- [ ] **FASE 2: SALA.**
  - Itens: painel de pedra com prateleiras iluminadas e lareira linear, ripado, luminária de anéis, cove, cortinas translúcidas, quadros, plantas, sofá modular, poltronas, tapete, mesa de centro com objetos, parede de vidro com pôr do sol.
  - Piso metálico + momento do piso.
- [ ] **FASE 3: COZINHA.**
  - Itens: ilha com banquetas e pendentes, armários, bancada, backsplash, eletrodomésticos simples, cesta, vasos, tábua.
  - Piso de concreto polido + momento do piso.
- [ ] **FASE 4: ÁREA EXTERNA.**
  - Céu de entardecer (skybox), deck flake/polyaspartic, piscina externa com borda.
  - Escada de inox na escala e fixada (reaproveitar a curva atual), espreguiçadeiras, guarda-sol, palmeiras, luzes de jardim e da água, pergolado ou cozinha externa se couber.
  - Momento do piso + chips de cor do flake.
- [ ] **FASE 5: O TOUR.**
  - Uma curva contínua sala → cozinha → porta de vidro que abre sozinha (pelo progresso) → externa.
  - Luz mudando aos poucos de interior quente para entardecer; transições suaves.
  - Lenis + ScrollTrigger (já prontos), "Skip the tour", teclado, etapas clicáveis (Living room, Kitchen, Pool deck).
- [ ] **FASE 6: desempenho e mobile.**
  - Tiers por FPS, versão leve com imagens estáticas e parallax, reduced-motion.
  - Carga sob demanda por cômodo com barra de progresso, pausa fora da tela e dispose.
  - Textos em HTML; regenerar as imagens estáticas; medir e comparar com a linha de base; 1 teste de celular.
- [ ] **FASE 7: prévia.** `netlify deploy` sem --prod, enviar o link e PARAR.

## Critérios de aceite (todas as fases)
- Console sem erros.
- 60 fps em PC mediano.
- Nada flutuando, atravessando ou fora de escala.
- Conteúdo, links, WhatsApp, formulário e SEO intactos.
