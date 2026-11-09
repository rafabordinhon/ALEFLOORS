"""Keep the shared parts of every page in sync.

Run from the project folder after changing a page:   python tools/build.py

The site is still plain HTML (no build step is needed to deploy). This script
only rewrites the parts that must be identical on every page, so you edit them
in ONE place (this file) instead of in 20 HTML files:

  * <head>: title/description are read from each page; canonical URL, Open Graph
    (WhatsApp/Facebook previews), favicons, fonts, stylesheets and structured data
    are generated.
  * Header (logo + menu, with the current page highlighted).
  * Footer, back-to-top button, floating WhatsApp button and scripts.
  * "Related Articles" sidebar on blog posts, and each post's category label
    (taken from the data-category of its card in blog.html).
  * width/height/loading attributes on images (prevents layout shift, lazy-loads).
  * sitemap.xml, robots.txt, _headers (security + cache) and _redirects.

To add a blog post: copy an existing blog-*.html, edit it, add its card to
blog.html (with data-category), put its image in assets/images/4-blog/ named
after the post, run tools/optimize-images.py and then this script.

Requires Pillow for image sizes:  pip install pillow
"""
import base64
import datetime
import hashlib
import html
import json
import re
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # image sizes are skipped without Pillow
    Image = None

ROOT = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# SETTINGS — edit these
# ---------------------------------------------------------------------------
SITE_URL = "https://alefloors.netlify.app"   # change when you connect a custom domain
GA_ID = ""                                   # Google Analytics 4 ID, e.g. "G-ABC123XYZ" ("" = off)
SOCIAL = {                                   # leave "" to hide the icon
    "facebook": "",
    "instagram": "",
}
PHONE_DISPLAY = "+1 (347) 998-6695"
PHONE_TEL = "+13479986695"
WHATSAPP_NUMBER = "13479986695"
EMAIL = "alefloors10@gmail.com"
ADDRESS = {"street": "13581 Fordwell Dr", "city": "Orlando", "region": "FL", "zip": "32828"}
HOURS = {"days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], "opens": "08:00", "closes": "18:00"}
AREAS = ["Orlando, FL", "Tampa, FL", "Daytona Beach, FL"]

# Per-page settings (pages not listed use the defaults below; blog-*.html are blog posts)
PAGES = {
    "index.html": {"nav": "index.html", "schema": "business", "css": ["home"], "js": ["home"], "modules": ["hero-3d"]},
    "service.html": {"nav": "service.html", "css": ["services"]},
    "about.html": {"nav": "about.html", "css": ["about"], "schema": "business"},
    "contact.html": {"nav": "contact.html", "css": ["contact"], "js": ["contact"], "schema": "business"},
    "blog.html": {"nav": "blog.html", "css": ["blog"], "js": ["blog"]},
    "privacy.html": {},
    "terms.html": {},
    "thank-you.html": {"noindex": True},
    "404.html": {"noindex": True},
}

# Old addresses that now point somewhere else (301 = permanent)
REDIRECTS = {
    "/blog-3d-epoxy-flooring-designs": "/blog-3d-epoxy",
    "/blog-metallic-epoxy-design-trends": "/blog-metallic-trends",
    "/blog-polished-concrete-vs-epoxy-comparison": "/blog-concrete-vs-epoxy",
}

NAV_ITEMS = [("index.html", "Home"), ("service.html", "Services"), ("about.html", "About"),
                ("contact.html", "Contact"), ("blog.html", "Blog")]

# Runs before the page renders so scroll animations don't flash. Its hash goes into the CSP.
INLINE_JS = "document.documentElement.classList.add('js');"

# Blog posts: first published on this site (Feb 2026); "updated" = month of the last build
POSTS_PUBLISHED = "2026-02-24"

# Fonts (Google Fonts) and browser theme color
FONTS = ("https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..500"
            "&amp;family=Schibsted+Grotesk:wght@400..700&amp;display=swap")
THEME_COLOR = "#17130f"

# ---------------------------------------------------------------------------


def icon(name: str, cls: str = "icon") -> str:
    """Inline reference to an icon in assets/icons.svg (one icon set for the whole site)."""
    return f'<svg class="{cls}" aria-hidden="true"><use href="assets/icons.svg#{name}"></use></svg>'


def whatsapp_link(text: str = "Hi Ale Floors! I'd like a free quote.") -> str:
    return f"https://wa.me/{WHATSAPP_NUMBER}?text=" + re.sub(r"[^A-Za-z0-9!'.]", lambda m: "%%%02X" % ord(m.group(0)), text)




def page_url(name: str) -> str:
    """Clean URL (Netlify serves about.html at /about)."""
    if name == "index.html":
        return SITE_URL + "/"
    return SITE_URL + "/" + name[:-5]


def settings_for(name: str) -> dict:
    if name.startswith("blog-"):
        cfg = {"nav": "blog.html", "css": ["blog"], "schema": "post"}
    else:
        cfg = dict(PAGES.get(name, {}))
    return cfg


def get_meta(text: str, name: str):
    title = re.search(r"<title>(.*?)</title>", text, re.S)
    desc = re.search(r'<meta name="description" content="([^"]*)"', text)
    if not title or not desc:
        raise SystemExit(f"{name}: needs a <title> and a <meta name=\"description\"> in its <head>")
    return html.unescape(title.group(1).strip()), html.unescape(desc.group(1).strip())


def json_ld(data: dict) -> str:
    return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "</script>"


def business_schema() -> dict:
    data = {
        "@context": "https://schema.org",
        "@type": "HomeAndConstructionBusiness",
        "name": "Ale Floors",
        "description": "Epoxy flooring, epoxy flake garage floors, metallic and 3D epoxy, polyaspartic pool decks, polished concrete and floor painting in Central Florida.",
        "url": SITE_URL + "/",
        "image": SITE_URL + "/assets/images/og/default.jpg",
        "logo": SITE_URL + "/assets/images/favicon/icon-512.png",
        "telephone": PHONE_TEL,
        "email": EMAIL,
        "address": {"@type": "PostalAddress", "streetAddress": ADDRESS["street"], "addressLocality": ADDRESS["city"],
                    "addressRegion": ADDRESS["region"], "postalCode": ADDRESS["zip"], "addressCountry": "US"},
        "areaServed": AREAS,
        "openingHoursSpecification": [{"@type": "OpeningHoursSpecification", "dayOfWeek": HOURS["days"],
                                       "opens": HOURS["opens"], "closes": HOURS["closes"]}],
    }
    same_as = [url for url in SOCIAL.values() if url]
    if same_as:
        data["sameAs"] = same_as
    return data


def post_schema(name: str, title: str, desc: str, image: str) -> dict:
    org = {"@type": "Organization", "name": "Ale Floors", "url": SITE_URL + "/"}
    return {"@context": "https://schema.org", "@type": "BlogPosting", "headline": title.split(" | ")[0],
            "description": desc, "image": image, "url": page_url(name), "mainEntityOfPage": page_url(name),
            "datePublished": POSTS_PUBLISHED, "dateModified": datetime.date.today().replace(day=1).isoformat(),
            "author": org, "publisher": {**org, "logo": {"@type": "ImageObject", "url": SITE_URL + "/assets/images/favicon/icon-512.png"}}}


def build_head(name: str, title: str, desc: str, cfg: dict, faq=None) -> str:
    og_file = ROOT / "assets/images/og" / (name[:-5] + ".jpg")
    og_image = SITE_URL + "/" + (og_file.relative_to(ROOT).as_posix() if og_file.exists() else "assets/images/og/default.jpg")
    t, d = html.escape(title, quote=False).replace('"', "&quot;"), html.escape(desc, quote=False).replace('"', "&quot;")
    lines = [
        '<meta charset="UTF-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
        f"<title>{t}</title>",
        f'<meta name="description" content="{d}">',
    ]
    if cfg.get("noindex"):
        lines.append('<meta name="robots" content="noindex">')
    else:
        lines.append(f'<link rel="canonical" href="{page_url(name)}">')
    lines += [
        f'<meta name="theme-color" content="{THEME_COLOR}">',
        f'<meta property="og:type" content="{"article" if cfg.get("schema") == "post" else "website"}">',
        '<meta property="og:site_name" content="Ale Floors">',
        f'<meta property="og:title" content="{t}">',
        f'<meta property="og:description" content="{d}">',
        f'<meta property="og:url" content="{page_url(name)}">',
        f'<meta property="og:image" content="{og_image}">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta property="og:locale" content="en_US">',
        '<meta name="twitter:card" content="summary_large_image">',
        '<link rel="icon" href="favicon.ico" sizes="48x48">',
        '<link rel="icon" type="image/png" sizes="32x32" href="assets/images/favicon/favicon-32.png">',
        '<link rel="apple-touch-icon" href="assets/images/favicon/apple-touch-icon.png">',
        '<link rel="preconnect" href="https://fonts.googleapis.com">',
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        f'<link rel="stylesheet" href="{FONTS}">',
        '<link rel="stylesheet" href="css/base.css">',
    ]
    page_css = cfg.get("css", [])
    if "home" not in page_css:
        page_css = ["pages"] + page_css   # shared styles for the inner pages
    lines += [f'<link rel="stylesheet" href="css/{css}.css">' for css in page_css]
    lines.append(f"<script>{INLINE_JS}</script>")
    if cfg.get("preload"):
        lines.append(f'<link rel="preload" as="image" href="{cfg["preload"]}" fetchpriority="high">')
    if cfg.get("schema") == "business":
        lines.append(json_ld(business_schema()))
    elif cfg.get("schema") == "post":
        lines.append(json_ld(post_schema(name, title, desc, og_image)))
    if faq:
        lines.append(json_ld({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}))
    return "<head>\n" + "".join(f"    {line}\n" for line in lines) + "</head>"


DARK_FIRST_SECTIONS = ("hero", "page-header", "article-header")


def starts_dark(content: str) -> bool:
    """True when the page opens with a dark band, so the header starts with light text."""
    first = re.search(r'<section class="([\w-]+)', content)
    return bool(first and first.group(1) in DARK_FIRST_SECTIONS)


def build_header(name: str, cfg: dict) -> str:
    items = []
    for href, label in NAV_ITEMS:
        current = ""
        if href == cfg.get("nav"):
            current = ' class="active"' + (' aria-current="page"' if href == name else "")
        items.append(f'                    <li><a href="{href}"{current}>{label}</a></li>')
    return f"""<body>
    <a class="skip-link" href="#main">Skip to main content</a>

    <!-- Header (generated by tools/build.py — edit it there) -->
    <header class="site-header{" over-dark" if cfg.get("_starts_dark") else ""}" id="navbar">
        <nav class="site-nav container-wide" aria-label="Main">
            <a href="index.html" class="logo" aria-label="Ale Floors home">
                <span class="logo-name">Ale <em>Floors</em></span>
                <span class="logo-tagline">Floor Covering Specialist</span>
            </a>
            <ul class="nav-menu" id="navMenu">
{chr(10).join(items)}
                <li class="nav-menu-phone"><a href="tel:{PHONE_TEL}">{icon("phone")}<span>{PHONE_DISPLAY}</span></a></li>
            </ul>
            <a href="contact.html" class="btn btn-primary btn-small nav-cta">Free Quote</a>
            <button type="button" class="hamburger" id="hamburger" aria-label="Open menu" aria-expanded="false" aria-controls="navMenu">
                <span></span>
                <span></span>
            </button>
        </nav>
    </header>

    <main id="main">"""


def build_footer(cfg: dict) -> str:
    social = []
    for key, url in SOCIAL.items():
        if url:
            social.append(f'<a href="{html.escape(url)}" target="_blank" rel="noopener" aria-label="Ale Floors on {key.title()}">{icon(key)}</a>')
        elif key == "instagram":
            # PLACEHOLDER: set SOCIAL["instagram"] at the top of this file to show the real link
            social.append(f'<span class="footer-social-placeholder" title="Instagram link coming soon">{icon(key)}<span>Instagram (coming soon)</span></span>')
    social_block = "\n                        ".join(social)
    scripts = ["script"] + cfg.get("js", [])
    script_tags = "\n".join(f'    <script src="js/{js}.js" defer></script>' for js in scripts)
    script_tags += "".join(f'\n    <script type="module" src="js/{m}.js"></script>' for m in cfg.get("modules", []))
    year = datetime.date.today().year
    days = HOURS["days"]
    hours_text = f"{days[0][:3]}–{days[-1][:3]}, 8 AM – 6 PM" if (HOURS["opens"], HOURS["closes"]) == ("08:00", "18:00") else f'{days[0][:3]}–{days[-1][:3]}, {HOURS["opens"]}–{HOURS["closes"]}'
    full_address = f'{ADDRESS["street"]}, {ADDRESS["city"]}, {ADDRESS["region"]} {ADDRESS["zip"]}'
    maps = "https://www.google.com/maps/search/?api=1&amp;query=" + "+".join(full_address.split())
    areas = ", ".join(a.split(",")[0] for a in AREAS[:-1]) + " and " + AREAS[-1].split(",")[0]
    # pages with their own call-to-action section don't repeat it in the footer
    footer_cta = "" if cfg.get("_has_cta") else f"""
            <div class="footer-cta">
                <p class="footer-cta-title">Ready to transform <em>your floor?</em></p>
                <div class="footer-cta-actions">
                    <a href="{whatsapp_link()}" class="btn btn-primary" target="_blank" rel="noopener">{icon("whatsapp")}<span>Get a Free Quote</span></a>
                    <a href="tel:{PHONE_TEL}" class="btn btn-ghost">{icon("phone")}<span>{PHONE_DISPLAY}</span></a>
                </div>
            </div>"""
    return f"""    </main>

    <!-- Footer (generated by tools/build.py — edit it there) -->
    <footer class="site-footer">
        <div class="container-wide">{footer_cta}
            <div class="footer-grid">
                <div class="footer-about">
                    <a href="index.html" class="logo" aria-label="Ale Floors home">
                        <span class="logo-name">Ale <em>Floors</em></span>
                        <span class="logo-tagline">Floor Covering Specialist</span>
                    </a>
                    <p class="footer-tagline">Our family takes care of yours.</p>
                    <p>We serve both homes and businesses in {areas}, adapting our services to the specific needs of each client.</p>
                    <div class="footer-social">
                        {social_block}
                    </div>
                </div>
                <div>
                    <h2 class="footer-heading">Explore</h2>
                    <ul>
                        <li><a href="index.html">Home</a></li>
                        <li><a href="service.html">Services</a></li>
                        <li><a href="about.html">About us</a></li>
                        <li><a href="contact.html">Contact</a></li>
                        <li><a href="blog.html">Blog</a></li>
                    </ul>
                </div>
                <div>
                    <h2 class="footer-heading">Services</h2>
                    <ul>
                        <li><a href="service.html#metallic">Metallic Epoxy</a></li>
                        <li><a href="service.html#garage">Garage Floors</a></li>
                        <li><a href="service.html#pool">Pool Decks</a></li>
                        <li><a href="service.html#epoxy-3d">3D Epoxy</a></li>
                        <li><a href="service.html#polished">Polished Concrete</a></li>
                    </ul>
                </div>
                <div>
                    <h2 class="footer-heading">Get in touch</h2>
                    <ul class="footer-contact">
                        <li>{icon("phone")}<a href="tel:{PHONE_TEL}">{PHONE_DISPLAY}</a></li>
                        <li>{icon("whatsapp")}<a href="{whatsapp_link()}" target="_blank" rel="noopener">WhatsApp</a></li>
                        <li>{icon("mail")}<a href="mailto:{EMAIL}">{EMAIL}</a></li>
                        <li>{icon("clock")}<span>{hours_text}</span></li>
                        <li>{icon("map-pin")}<a href="{maps}" target="_blank" rel="noopener">{full_address}</a></li>
                    </ul>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; {year} Ale Floors. All rights reserved.</p>
                <p><a href="privacy.html">Privacy Policy</a><span aria-hidden="true"> / </span><a href="terms.html">Terms of Service</a></p>
            </div>
        </div>
    </footer>

    <!-- Desktop: floating WhatsApp + back to top. Phones: fixed action bar. -->
    <a href="{whatsapp_link()}" class="whatsapp-float" target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp">{icon("whatsapp")}</a>
    <button type="button" class="back-to-top" id="backToTop" aria-label="Back to top">{icon("arrow-up")}</button>
    <nav class="mobile-actions" aria-label="Quick contact">
        <a href="tel:{PHONE_TEL}">{icon("phone")}<span>Call</span></a>
        <a href="{whatsapp_link()}" target="_blank" rel="noopener">{icon("whatsapp")}<span>WhatsApp</span></a>
        <a href="contact.html" class="mobile-actions-quote">{icon("calendar-check")}<span>Free Quote</span></a>
    </nav>

{script_tags}
</body>
</html>
"""


def blog_index() -> list:
    """Posts in the order of blog.html, with category, title and image."""
    text = (ROOT / "blog.html").read_text(encoding="utf-8")
    posts = []
    for card in re.findall(r'<article class="blog-post"(.*?)</article>', text, re.S):
        slug = re.search(r'href="(blog-[^"]+)\.html"', card).group(1)
        posts.append({
            "slug": slug,
            "category": re.search(r'data-category="([^"]+)"', card).group(1),
            "title": re.sub(r"<[^>]+>", "", re.search(r"<h2>(.*?)</h2>", card, re.S).group(1)).strip(),
            "image": re.search(r'<img\b[^>]*\ssrc="([^"]+)"', card).group(1),
        })
    return posts


def build_sidebar(slug: str, posts: list) -> str:
    me = next((p for p in posts if p["slug"] == slug), None)
    others = [p for p in posts if p["slug"] != slug]
    if me:
        others.sort(key=lambda p: p["category"] != me["category"])  # same topic first (stable sort)
    related = "".join(f"""
                            <a href="{p['slug']}.html" class="related-post-item">
                                <img src="{p['image']}" alt="" sizes="120px">
                                <span class="related-post-title">{p['title']}</span>
                            </a>""" for p in others[:3])
    return f"""<aside class="article-sidebar">
                    <div class="sidebar-widget cta-widget">
                        <h2 class="sidebar-title">Need Expert Advice?</h2>
                        <p>Get personalized recommendations and a free quote for your project.</p>
                        <a href="contact.html" class="btn btn-primary btn-small">Get a Free Quote</a>
                    </div>

                    <div class="sidebar-widget">
                        <h2 class="sidebar-title">Related Articles</h2>
                        <div class="related-posts">{related}
                        </div>
                        <a href="blog.html" class="btn btn-outline btn-block">View All Articles</a>
                    </div>
                </aside>"""


_size_cache = {}


def image_size(src: str):
    if Image is None or src.startswith(("http:", "https:", "data:")):
        return None
    if src not in _size_cache:
        path = ROOT / src
        _size_cache[src] = Image.open(path).size if path.exists() else None
    return _size_cache[src]


def fix_images(body: str) -> str:
    """Add width/height (stops layout shift), lazy loading and srcset to every <img>.

    srcset is added when a smaller copy exists next to the image (photo-600.webp,
    created by tools/optimize-images.py), so phones download the small version.
    An image with data-no-srcset is left alone.
    """
    def repl(match):
        tag = match.group(0)
        src = re.search(r'\ssrc="([^"]+)"', tag)
        size = image_size(src.group(1)) if src else None
        if size and "width=" not in tag:
            tag = tag.replace("<img ", f'<img width="{size[0]}" height="{size[1]}" ', 1)
        hero = 'fetchpriority="high"' in tag
        featured = "article-featured-image" in tag
        if not (hero or featured) and "loading=" not in tag:
            tag = tag.replace("<img ", '<img loading="lazy" decoding="async" ', 1)
        if src and size and "srcset=" not in tag and "data-no-srcset" not in tag and src.group(1).endswith(".webp"):
            small = src.group(1)[:-5] + "-600.webp"
            if (ROOT / small).exists():
                sizes = "100vw" if hero else "(max-width: 968px) 100vw, 760px" if featured else "(max-width: 768px) 100vw, 600px"
                extra = "" if " sizes=" in tag else f' sizes="{sizes}"'
                tag = tag.replace(f' src="{src.group(1)}"', f' src="{src.group(1)}" srcset="{small} 600w, {src.group(1)} {size[0]}w"{extra}', 1)
        return tag
    return re.sub(r"<img\b[^>]*>", repl, body)


def process(path: Path, posts: list) -> None:
    name = path.name
    cfg = settings_for(name)
    text = path.read_text(encoding="utf-8")
    title, desc = get_meta(text, name)

    if '<main id="main">' in text:
        content_start = text.index('<main id="main">') + len('<main id="main">')
    else:
        content_start = text.index("</nav>") + len("</nav>")
    if "</main>" in text:
        content_end = text.index("</main>")
        content_end = text.rindex("\n", 0, content_end) + 1
    else:
        content_end = text.index("<!-- Footer -->") if "<!-- Footer -->" in text else text.index("<footer")
        content_end = text.rindex("\n", 0, content_end) + 1

    content = text[content_start:content_end]
    if name.startswith("blog-"):
        slug = name[:-5]
        content = re.sub(r"<aside class=\"article-sidebar\">.*?</aside>", lambda m: build_sidebar(slug, posts), content, flags=re.S)
        me = next((p for p in posts if p["slug"] == slug), None)
        if me:
            content = re.sub(r'<div class="article-category">[^<]*</div>', f'<div class="article-category">{me["category"]}</div>', content)
    content = fix_images(content)
    if not content.endswith("\n"):
        content += "\n"

    # FAQ structured data from <details class="faq-item"><summary>Q</summary> ... <p>A</p></details>
    faq = [(html.unescape(re.sub(r"<[^>]+>", "", q)).strip(), html.unescape(re.sub(r"<[^>]+>", "", a)).strip())
           for q, a in re.findall(r'<details class="faq-item"[^>]*>\s*<summary[^>]*>(.*?)</summary>.*?<p>(.*?)</p>', content, re.S)]

    html_tag = '<html lang="en"' + (f' data-ga-id="{GA_ID}"' if GA_ID else "") + ">"
    new = ("<!DOCTYPE html>\n" + html_tag + "\n" + build_head(name, title, desc, cfg, faq) + "\n"
           + build_header(name, {**cfg, "_starts_dark": starts_dark(content)})
           + content.rstrip() + "\n\n"
           + build_footer({**cfg, "_has_cta": 'class="cta-section"' in content}))
    if new != text:
        path.write_text(new, encoding="utf-8", newline="\n")
        print("updated", name)


def write_support_files(pages: list) -> None:
    today = datetime.date.today().isoformat()
    urls = [p.name for p in pages if not settings_for(p.name).get("noindex")]
    urls.sort(key=lambda n: (n != "index.html", n.startswith("blog-"), n))
    sitemap = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    sitemap += [f"  <url><loc>{page_url(n)}</loc><lastmod>{today}</lastmod></url>" for n in urls]
    sitemap.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(sitemap) + "\n", encoding="utf-8", newline="\n")

    (ROOT / "robots.txt").write_text(
        "User-agent: *\nAllow: /\nDisallow: /tools/\n\nSitemap: " + SITE_URL + "/sitemap.xml\n",
        encoding="utf-8", newline="\n")

    js_hash = base64.b64encode(hashlib.sha256(INLINE_JS.encode()).digest()).decode()
    google = "https://www.googletagmanager.com"
    analytics = "https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com"
    csp = "; ".join([
        "default-src 'self'",
        f"script-src 'self' 'sha256-{js_hash}' {google}",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        f"img-src 'self' data: {analytics}",
        f"connect-src 'self' {analytics}",
        "frame-src https://www.google.com https://maps.google.com",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
    ])
    headers = f"""# Generated by tools/build.py — edit it there.
/*
  Content-Security-Policy: {csp}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()

/assets/*
  Cache-Control: public, max-age=2592000

/favicon.ico
  Cache-Control: public, max-age=2592000

/tools/*
  X-Robots-Tag: noindex
"""
    (ROOT / "_headers").write_text(headers, encoding="utf-8", newline="\n")

    lines = ["# Generated by tools/build.py — edit it there."]
    for old, new in REDIRECTS.items():
        lines.append(f"{old}  {new}  301")
        lines.append(f"{old}.html  {new}  301")
    # project files that should not be public when the whole folder is deployed
    lines.append("/tools/*  /404.html  404!")
    lines.append("/README.md  /404.html  404!")
    (ROOT / "_redirects").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


def main() -> None:
    pages = sorted(ROOT.glob("*.html"))
    posts = blog_index()
    for page in pages:
        process(page, posts)
    write_support_files(pages)
    print("sitemap.xml, robots.txt, _headers and _redirects written")


if __name__ == "__main__":
    main()
