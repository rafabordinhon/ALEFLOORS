# Redesign ALEFLOORS — Etapa 1: estrutura do site

Branch: `redesign-cinematico` (base: `19221e1`, o site publicado).
Status: aguardando a escolha da direção de arte (A ou B).

## Escopo

- **Home**: redesenhada por completo. É a única página com a cena 3D (Three.js).
- **Páginas internas** (Services, About, Contact, Blog, posts, Privacy, Terms, Thank you, 404):
  recebem o mesmo sistema visual (cabeçalho, rodapé, tipografia, cores, botões e cabeçalho
  de página escuro). Conteúdo e estrutura continuam os mesmos.
- **Stack**: HTML, CSS e JS puro. O `tools/build.py` continua gerando o `<head>`, o menu e o
  rodapé. O Three.js entra com versão fixa e só é carregado na home.
- **Idioma do site**: inglês (como hoje).

## Melhorias de código trazidas do commit rejeitado (`e5fd1e4`), sem o visual dele

- Ordem correta dos títulos em todas as páginas
- Cópias de 600px das imagens + `srcset` gerado pelo build
- FAQ em acordeão (`<details>`) + schema FAQPage
- Barra fixa Call / WhatsApp / Quote no celular
- Botão "Free Quote" no menu
- Menu mobile com foco preso (`inert`), timeout e validação de telefone no formulário,
  filtro do blog salvo na URL

## Home — seções e conteúdo (tudo real, salvo onde está marcado)

| # | Seção | Conteúdo |
|---|---|---|
| 0 | Header | Logo "ALE FLOORS / Floor Covering Specialist", menu (Home, Services, About, Contact, Blog), botão "Free Quote". Transparente sobre o hero, vira barra de vidro ao rolar |
| 1 | Hero (3D) | h1 a partir de "Floor Covering Specialist" + Central Florida; subtítulo com os serviços; botões "Get a Free Quote" (WhatsApp) e "See Our Work" (#work); cidades atendidas |
| 2 | Números | 9+ anos · 1533+ projetos · 1131+ clientes · **XX+ sq ft instalados (placeholder)** — contador animado |
| 3 | Serviços (bento) | Metallic Epoxy, Epoxy Garage Floor, Polyaspartic Pool Deck, 3D Epoxy, Polished Concrete, Floor Painting — textos e 3 destaques de cada um, link para service.html#… |
| 4 | Processo | As 4 camadas reais: Surface Preparation, Primer, Base & Flake, Topcoat |
| 5 | Obras (#work) | Antes/depois (piscina FS9→pool, garagem FS11→FS1) + galeria com lightbox (fotos maiores em destaque; FS em miniatura) |
| 6 | Cores | 18 flakes, 3 micro granite, 3 sólidas (sólidas viram cor CSS) + "custom color matching" |
| 7 | Depoimentos | Abella Smith, Mrs. Ransom, Joel Dawson (textos reais) |
| 8 | FAQ | As 4 perguntas da página Contact, em acordeão |
| 9 | Localização | Mapa (13581 Fordwell Dr, Orlando FL 32828), horário seg–sáb 8h–18h, cidades atendidas |
| 10 | CTA final + rodapé | "Ready to Transform Your Floor?" + WhatsApp, telefone, e-mail, links, Instagram **(placeholder)** |
| — | Fixos | Botão flutuante de WhatsApp (desktop), barra Call/WhatsApp/Quote (celular) |

## Placeholders conhecidos

- Metragem instalada (sq ft)
- Link do Instagram
- Fotos de obras em alta resolução (as atuais têm 300px; o lightbox mostra no tamanho real, sem ampliar)
- Fotos dos depoimentos parecem de banco de imagem (a decidir: manter, trocar por iniciais ou por fotos reais)
