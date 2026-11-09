# Ale Floors — site

Site institucional (em inglês) da Ale Floors, empresa de pisos epóxi em Orlando, FL.
HTML + CSS + JavaScript puro, hospedado no Netlify. Não precisa de build para publicar.

## Estrutura

```
*.html                  páginas (index, service, about, contact, blog, blog-*, privacy, terms, thank-you, 404)
css/base.css            sistema visual: cores, fontes, botões, menu, rodapé, animações, FAQ
css/home.css            home (hero 3D, números, serviços, obras, cores, depoimentos, mapa)
css/pages.css           páginas internas (cabeçalho escuro, títulos, CTA, páginas legais)
css/<página>.css        estilos específicos de cada página interna
js/script.js            menu, header, animações, contadores, antes/depois, Google Analytics
js/home.js              home: quadro de cores e lightbox da galeria
js/hero-3d.js           hero: passeio 3D por 3 ambientes de showroom (Three.js); sem WebGL/celular fraco
                        mostra as imagens showroom-1..3 (geradas da cena com ?shot=0|1|2)
js/vendor/              Three.js 0.170.0 (servido pelo próprio site)
js/blog.js              filtro + paginação do blog
js/contact.js           formulário (Netlify Forms + WhatsApp)
assets/icons.svg        todos os ícones do site
assets/images/          imagens em WebP (+ cópias -600 para celular); hero/ = texturas e fallback do 3D
tools/build.py          sincroniza <head>, menu, rodapé e gera sitemap/robots/_headers/_redirects
tools/optimize-images.py converte novas fotos para WebP no tamanho certo
tools/make-hero-textures.py gera as texturas do 3D (piso metálico, flake, concreto, reboco)
_headers, _redirects    configuração do Netlify (gerados pelo build.py)
docs/redesign/          estrutura e plano do redesign
```

## Ver localmente

Abra a pasta no VS Code e use a extensão **Live Server**, ou rode `python -m http.server 8000`
e acesse http://localhost:8000. (O envio do formulário só funciona no Netlify.)

## Depois de editar

1. Fotos novas: coloque em `assets/images/...` (JPG/PNG) e rode `python tools/optimize-images.py`.
2. Rode `python tools/build.py` — ele atualiza menu, rodapé, SEO e o sitemap de todas as páginas.
3. Publique (arraste a pasta no painel do Netlify ou faça push, se o Netlify estiver ligado ao Git).

O menu, o rodapé e o `<head>` são gerados: **edite-os em `tools/build.py`**, não no HTML.
Título e descrição de cada página ficam no `<head>` da própria página.

## Configurações em `tools/build.py`

- `SITE_URL` — troque quando tiver domínio próprio.
- `GA_ID` — ID do Google Analytics 4 (ex.: `G-ABC123`). Vazio = desligado.
- `SOCIAL` — links do Facebook/Instagram. Instagram vazio = aparece "Instagram (coming soon)" no rodapé.
- Telefone, e-mail, endereço, horário e cidades atendidas (usados no rodapé e no Google).

## Novo post no blog

1. Copie um `blog-*.html`, troque título, descrição, conteúdo e imagem.
2. Imagem em `assets/images/4-blog/<nome-do-post-sem-blog->.png` e rode `optimize-images.py`
   (gera também a imagem de compartilhamento).
3. Adicione o card em `blog.html` com `data-category` = `Maintenance`, `Guides` ou `Design Ideas`.
4. Rode `python tools/build.py`.

## Netlify

- O site `alefloors` está ligado a este repositório (github.com/rafabordinhon/ALEFLOORS).
  **Todo push na branch `main` publica automaticamente.** Não há comando de build; a pasta publicada é a raiz.
- Para voltar a uma versão anterior: painel do Netlify → *Deploys* → escolha o deploy → *Publish deploy*.
- **Formulários**: a detecção está ativada e os pedidos aparecem em *Forms → quote*.
  Configure o aviso por e-mail em *Site configuration → Notifications → Emails and webhooks*.
- **Domínio**: ao conectar um domínio, atualize `SITE_URL` em `tools/build.py` e rode o build.
