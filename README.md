# Ale Floors — site

Site institucional (em inglês) da Ale Floors, empresa de pisos epóxi em Orlando, FL.
HTML + CSS + JavaScript puro, hospedado no Netlify. Não precisa de build para publicar.

## Estrutura

```
*.html                  páginas (index, service, about, contact, blog, blog-*, privacy, terms, thank-you, 404)
css/style.css           estilos compartilhados (menu, rodapé, botões, cabeçalho das páginas internas)
css/<página>.css        estilos específicos de cada página
js/script.js            menu, animações, depoimentos, antes/depois, carrossel, Google Analytics
js/blog.js              filtro + paginação do blog
js/contact.js           formulário (Netlify Forms + WhatsApp)
assets/images/          imagens em WebP; og/ = imagens de compartilhamento; favicon/
tools/build.py          sincroniza <head>, menu, rodapé e gera sitemap/robots/_headers/_redirects
tools/optimize-images.py converte novas fotos para WebP no tamanho certo
_headers, _redirects    configuração do Netlify (gerados pelo build.py)
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
- `SOCIAL` — links do Facebook/Instagram. Vazio = ícone escondido.
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
