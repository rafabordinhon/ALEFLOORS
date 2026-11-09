# Redesign "Showroom" (opção B) — plano de implementação

**Goal:** Refazer o visual da ALEFLOORS na direção B ("Showroom": hero noturno com 3D, resto claro), mantendo conteúdo, contatos e melhorias de código.

**Architecture:** Site estático (HTML/CSS/JS puro, Netlify). `tools/build.py` continua gerando `<head>`, header e rodapé. Novo sistema visual em `css/base.css` (tokens, tipografia, botões, header, rodapé, utilitários de movimento) + um CSS por página. Three.js r170 servido localmente (`js/vendor/`), carregado só na home por `js/hero-3d.js` (módulo ES), com fallback de imagem estática.

**Tech Stack:** HTML5, CSS (custom properties), JS ES2020 sem framework, Three.js 0.170.0 (vendorizado), Python 3 + Pillow (build e imagens).

**Spec:** `docs/redesign/2026-11-09-etapa1-estrutura.md` + mensagem do cliente (etapas 2–5) + direção B escolhida.

## Global Constraints

- Fontes: Newsreader (títulos, com itálico) + Schibsted Grotesk (texto), Google Fonts com `display=swap`. Nada condensado.
- Cores: Noite `#121316`, Porcelana `#F5F6F4`, Grafite `#1E1F22`, Vermelho Ale `#CF3434`, Coral `#FF6B6B` (só no escuro), Areia `#C9B79C`, Ardósia `#5B5E66`.
- Um único `h1` por página; `alt` em todas as imagens; `width`/`height` em todas; lazy loading exceto no hero.
- Animações só com `transform` e `opacity` (cor só em hover); 200–400ms; easing `cubic-bezier(0.23, 1, 0.32, 1)`; tudo desligado ou reduzido com `prefers-reduced-motion`.
- Hover só em `@media (hover: hover) and (pointer: fine)`; `:active` com `scale(0.97)`.
- 3D: pixel ratio ≤ 2, pausa fora da tela e com aba oculta, `dispose()` de geometrias/texturas/materiais, texturas ≤ 512px.
- Fallback do 3D: sem WebGL, `prefers-reduced-motion`, `saveData` ou aparelho fraco (≤ 4 núcleos e ≤ 4 GB) → imagem estática com gradiente.
- Contatos e textos reais preservados; todo texto novo listado para o cliente.
- CSP em `_headers` não muda (Three.js é servido do próprio site).
- Testar em 375, 768 e 1280px, com console limpo.

## Review Focus

- Celular fraco ou sem WebGL: a página mostra a imagem estática e nada quebra (testar forçando `?no3d`).
- `prefers-reduced-motion`: sem 3D animado, sem revelação palavra por palavra, conteúdo visível de imediato.
- JS desligado ou com erro: todo o texto do hero fica visível (classes de animação só valem com `html.js`).
- Menu mobile aberto: foco preso no menu, Esc fecha, header legível sobre o hero e sobre o fundo claro.
- Redimensionar a janela ou girar o celular: canvas acompanha sem distorcer e sem vazar memória.

---

### Task 1: Trazer as melhorias de código do commit `e5fd1e4` (sem visual)

**Files:**
- Restore from `e5fd1e4`: `assets/icons.svg`, todos os `*-600.webp`, `tools/optimize-images.py`, `js/blog.js`, `js/contact.js`
- Modify: `js/script.js` (menu com `inert` + foco), `tools/build.py` (`icon()`, `whatsapp_link()`, `fix_images` com srcset, FAQ schema, data dos posts, botão "Free Quote", barra mobile)

- [ ] Step 1: `git checkout e5fd1e4 -- <arquivos acima>`
- [ ] Step 2: portar as funções do build; manter `INLINE_JS` (classe `js`) e o hash na CSP
- [ ] Step 3: `python tools/build.py` → sem erro; `git diff --stat` mostra só srcset/head/header/footer
- [ ] Step 4: Commit

### Task 2: Sistema visual base + header + rodapé

**Files:**
- Create: `css/base.css`
- Modify: `tools/build.py` (páginas com `"v2": True` recebem fontes novas, `base.css` e o novo header/rodapé; as outras continuam com `style.css` até a Task 6)

- [ ] Step 1: tokens (cores, fontes, escala tipográfica, espaçamentos, raios, easing) em `:root`
- [ ] Step 2: header transparente sobre o hero → barra de vidro clara ao rolar (`.scrolled`); menu mobile
- [ ] Step 3: botões (`.btn-primary`, `.btn-ghost`, `.btn-outline`), foco visível, `:active`
- [ ] Step 4: rodapé, WhatsApp flutuante (desktop), barra de ações (celular)
- [ ] Step 5: utilitários `[data-reveal]` (fade + blur) e `.split-words`
- [ ] Step 6: verificar no navegador em 375/768/1280 → Commit

### Task 3: Hero com Three.js (PARADA para aprovação)

**Files:**
- Create: `css/home.css`, `js/hero-3d.js`, `js/vendor/three.module.min.js` (0.170.0), `js/vendor/RoomEnvironment.js`, `assets/images/hero/` (texturas 512px + imagem de fallback)
- Modify: `index.html` (seção hero), `js/script.js` (revelação palavra por palavra)

**Interfaces:**
- `js/hero-3d.js` exporta nada; roda sozinho se `canUse3D()` for verdadeiro; marca `html.has-3d` quando o primeiro quadro é desenhado.
- `canUse3D(): boolean` — WebGL ok, sem reduced-motion, sem `saveData`, sem `?no3d`, não é aparelho fraco.

- [ ] Step 1: cena — amostra de piso "explodida" com 4 camadas reais (concreto, primer, base com flakes, verniz), luz de estúdio, sombra de contato
- [ ] Step 2: entrada — camadas caem uma a uma (único momento orquestrado); mouse → parallax com amortecimento; scroll → camadas se juntam e a amostra gira
- [ ] Step 3: desempenho — DPR ≤ 2, pausa fora da tela/aba oculta, `dispose()` em `pagehide`
- [ ] Step 4: fallback estático + `?no3d`
- [ ] Step 5: testar 375/768/1280, console, reduced-motion → Commit → **PARAR e mostrar ao cliente**

### Task 4: Seções da home (depois da aprovação)
Números (contador), serviços em bento, processo, obras (antes/depois + galeria com lightbox), cores, depoimentos, FAQ, localização, CTA final. Uma seção por commit, testada em 3 larguras.

### Task 5: Páginas internas
Services, About, Contact, Blog, posts, Privacy, Terms, Thank you, 404 passam para `base.css`; `style.css` antigo sai.

### Task 6: SEO, desempenho e revisão (Etapa 5)
sitemap/robots/schema (já gerados pelo build), OG, peso da página, crítica impeccable, screenshots com agent-browser.
