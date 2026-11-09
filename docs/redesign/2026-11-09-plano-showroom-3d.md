# Hero "Showroom 3D" — plano

**Goal:** trocar o fundo preto do hero por um passeio 3D, com luz quente, por 3 ambientes de showroom. Em cada ambiente o piso é a estrela.

**Referência:** vídeo do TikTok @webloved, com passeio em tela cheia por ambientes de luxo, paleta bege e carvão e interface mínima.

**Architecture:** o hero vira uma seção alta (cerca de 260vh) com um palco fixo (`position: sticky`). O progresso da rolagem move a câmera pelos ambientes. Cada ambiente tem uma legenda em vidro. Sem 3D, o mesmo palco faz uma transição suave entre 3 imagens geradas da própria cena.

## Ambientes (todos com conteúdo real)

| # | Piso | Paredes / peças | Legenda |
|---|---|---|---|
| 1 | Epóxi metálico (textura procedural grafite + veios perolados), espelhado | Nichos com fita de LED quente, a amostra em camadas num pedestal | h1 + subtítulo + botões (como hoje) |
| 2 | Flake "Outback" com verniz | Quadros com fotos reais de garagens | "Epoxy Garage Floor" + texto real + link |
| 3 | Concreto polido | Quadros com fotos de piscina/concreto | "Polished Concrete & Pool Decks" + texto real + link |

## Global Constraints
- Three.js 0.170.0 local (`js/vendor`), mais o Reflector (mesma versão).
- DPR ≤ 2 (1,5 no celular), reflexo em baixa resolução, pausa fora da tela e com aba oculta, `dispose()` ao sair.
- Fallback: sem WebGL, movimento reduzido, aparelho fraco ou `?no3d` mostram 3 imagens estáticas que trocam com a rolagem. As imagens 2 e 3 só baixam nesse caso.
- Texturas dos ambientes 2 e 3 carregam depois que o ambiente 1 aparece.
- Paleta: "night" vira carvão quente; bege/areia nas luzes e paredes; vermelho só nas ações.
- Animações de interface só com transform/opacity; a rolagem é amortecida (sem saltos).

## Review Focus
- Celular sem 3D: as 3 imagens trocam sem pular e o texto continua legível.
- Rolagem rápida até o fim do hero: a câmera chega ao ambiente 3 sem atravessar paredes.
- Redimensionar ou girar a tela: enquadramento e legendas continuam corretos.
- Teclado: os links das legendas só recebem foco quando a legenda está visível.
- Peso: o hero não pode atrasar o LCP (o texto aparece antes do 3D).
