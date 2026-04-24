import { env } from '../config/env';
import { BlogService } from './blog.service';

/**
 * Serviço de Server-Side Rendering para o blog.
 *
 * Motivação: a aplicação frontend é uma SPA Vite+React (client-side render).
 * Quando um crawler (Googlebot, Bingbot, Facebook, WhatsApp, LinkedIn, Twitter)
 * solicita /blog ou /blog/:slug, o nginx serve o index.html vazio do SPA.
 * Resultado: nenhum post era indexado e previews de compartilhamento estavam quebrados.
 *
 * Esta solução pragmática:
 *  - O nginx detecta user-agents de bots e faz proxy_pass para estes endpoints.
 *  - Para humanos, continua servindo o SPA normalmente.
 *  - O HTML retornado contém título, descrição, canonical, OG, Schema.org e
 *    o conteúdo do post completo, tudo que o crawler precisa indexar.
 *  - Inclui também um <script> client-side que redireciona humanos que chegarem
 *    direto nesta URL (caso de cache / misconfig) para o SPA real.
 */

const SITE_NAME = 'OlieCare';

function getSiteUrl(): string {
  // FRONTEND_URL vem do env (prod: https://oliecare.cloud)
  return (env.FRONTEND_URL || 'https://oliecare.cloud').replace(/\/$/, '');
}

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value: unknown): string {
  return escapeHtml(value);
}

/**
 * Converte markdown simples em HTML seguro e escapado.
 * Suporta: h1/h2/h3, **bold**, *italic*, listas, links, parágrafos.
 * Evita HTML arbitrário vindo do conteúdo (protege contra XSS).
 */
function renderMarkdownSafe(markdown: string): string {
  if (!markdown) return '';

  // Primeiro escapamos TODO o HTML existente no conteúdo (proteção XSS).
  let html = escapeHtml(markdown);

  // Depois aplicamos as regras de markdown em cima do texto já escapado.
  html = html
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold e italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links: [label](url) - só permite http/https
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>')
    // Listas
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, match => `<ul>${match}</ul>`);

  // Parágrafos: blocos separados por linha vazia viram <p>.
  html = html
    .split(/\n{2,}/)
    .map(block => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      // Se já começa com tag de bloco, não embrulhar.
      if (/^<(h\d|ul|ol|li|p|blockquote|pre|table)/i.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  return html;
}

// ==========================================
// CSS compartilhado (inline no HTML para não depender do SPA)
// ==========================================
const BASE_STYLES = `
  :root{color-scheme:light;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Inter,sans-serif;}
  *{box-sizing:border-box;}
  body{margin:0;background:#fafaf9;color:#1c1917;line-height:1.7;}
  a{color:#738251;text-decoration:none;}
  a:hover{text-decoration:underline;}
  header.site{background:#fff;border-bottom:1px solid #e7e5e4;padding:16px 24px;position:sticky;top:0;z-index:10;}
  header.site .wrap{max-width:1024px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;}
  header.site .brand{display:flex;align-items:center;gap:8px;font-weight:700;color:#3f4730;}
  header.site .brand .logo{width:32px;height:32px;background:#738251;color:#fff;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;}
  header.site nav a{color:#57534e;margin-left:16px;font-size:14px;font-weight:500;}
  header.site nav a[aria-current]{color:#738251;}
  main{max-width:800px;margin:0 auto;padding:32px 24px;}
  footer.site{background:#fff;border-top:1px solid #e7e5e4;padding:24px;margin-top:48px;text-align:center;color:#78716c;font-size:14px;}
  .cover{width:100%;max-height:420px;object-fit:cover;border-radius:16px;margin-bottom:24px;}
  .breadcrumb{font-size:14px;color:#78716c;margin-bottom:12px;}
  .breadcrumb a{color:#78716c;}
  .tag{display:inline-block;background:#ecf0e0;color:#3f4730;padding:4px 12px;border-radius:999px;font-size:13px;font-weight:500;margin-right:6px;margin-top:6px;}
  h1{font-size:34px;line-height:1.2;margin:12px 0 16px;color:#1c1917;}
  h2{font-size:24px;line-height:1.3;margin:32px 0 12px;color:#1c1917;}
  h3{font-size:20px;line-height:1.4;margin:24px 0 10px;color:#1c1917;}
  p{margin:0 0 16px;}
  ul,ol{padding-left:24px;margin:0 0 16px;}
  li{margin-bottom:6px;}
  .meta{display:flex;gap:16px;font-size:14px;color:#78716c;margin:16px 0 24px;padding-bottom:16px;border-bottom:1px solid #e7e5e4;flex-wrap:wrap;}
  .excerpt{font-size:18px;color:#57534e;margin-bottom:16px;}
  .cta{background:linear-gradient(135deg,#ecf0e0,#fef3f2);padding:32px;border-radius:16px;text-align:center;margin:48px 0;}
  .cta h2{margin-top:0;}
  .cta .btn{display:inline-block;background:#738251;color:#fff;padding:12px 24px;border-radius:12px;font-weight:600;margin:6px;}
  .cta .btn.ghost{background:#fff;color:#3f4730;border:1px solid #d6d3d1;}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:24px;margin-top:24px;}
  .card{background:#fff;border:1px solid #e7e5e4;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;}
  .card img{width:100%;aspect-ratio:16/9;object-fit:cover;}
  .card .body{padding:18px;flex:1;display:flex;flex-direction:column;}
  .card .cat{font-size:12px;color:#738251;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;}
  .card h2{font-size:18px;margin:0 0 8px;}
  .card p{font-size:14px;color:#57534e;flex:1;}
  .card .readmore{margin-top:12px;font-size:13px;font-weight:600;}
`;

// ==========================================
// Renderizar post individual
// ==========================================

export interface SsrPostOptions {
  slug: string;
}

export async function renderPostHtml(opts: SsrPostOptions): Promise<string> {
  const siteUrl = getSiteUrl();
  const post = await BlogService.getPublishedPostBySlug(opts.slug);

  const url = `${siteUrl}/blog/${post.slug}`;
  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt || 'Artigo do Blog OlieCare';
  const image = post.ogImageUrl || post.coverImageUrl || `${siteUrl}/og-image.png`;
  const authorName = post.author?.caregiver?.fullName || SITE_NAME;
  const publishedAt = post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined;
  const modifiedAt = post.updatedAt ? new Date(post.updatedAt).toISOString() : publishedAt;
  const keywords = post.seoKeywords && post.seoKeywords.length ? post.seoKeywords.join(', ') : undefined;

  const contentHtml = renderMarkdownSafe(post.content || '');

  // Schema.org BlogPosting
  const blogPostingSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    url,
    image,
    datePublished: publishedAt,
    dateModified: modifiedAt,
    author: {
      '@type': 'Person',
      name: authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/favicon-512.png`,
      },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    wordCount: (post.content || '').split(/\s+/).filter(Boolean).length,
  };
  if (post.category) {
    blogPostingSchema.articleSection = post.category.name;
  }
  if (keywords) {
    blogPostingSchema.keywords = keywords;
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl}/blog` },
      { '@type': 'ListItem', position: 3, name: title, item: url },
    ],
  };

  const faqSchema: Record<string, unknown> | null =
    post.schemaMarkup && typeof post.schemaMarkup === 'object' && 'faq' in (post.schemaMarkup as object)
      ? (() => {
          const faqArr = (post.schemaMarkup as { faq?: Array<{ question: string; answer: string }> }).faq;
          if (!Array.isArray(faqArr) || faqArr.length === 0) return null;
          return {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqArr.map(f => ({
              '@type': 'Question',
              name: f.question,
              acceptedAnswer: { '@type': 'Answer', text: f.answer },
            })),
          };
        })()
      : null;

  const tagsHtml = (post.tags || [])
    .map(t => `<a class="tag" href="${escapeAttr(`${siteUrl}/blog?tag=${t.slug}`)}">${escapeHtml(t.name)}</a>`)
    .join('');

  const categoryHtml = post.category
    ? `<a class="tag" href="${escapeAttr(`${siteUrl}/blog?category=${post.category.slug}`)}">${escapeHtml(post.category.name)}</a>`
    : '';

  const breadcrumbHtml = `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="${escapeAttr(siteUrl)}">Home</a> / <a href="${escapeAttr(`${siteUrl}/blog`)}">Blog</a>${
        post.category
          ? ` / <a href="${escapeAttr(`${siteUrl}/blog?category=${post.category.slug}`)}">${escapeHtml(post.category.name)}</a>`
          : ''
      } / <span>${escapeHtml(title)}</span>
    </nav>
  `;

  const publishedLabel = publishedAt
    ? new Date(publishedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return `<!doctype html>
<html lang="pt-BR" prefix="og: https://ogp.me/ns#">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} | ${SITE_NAME}</title>
<meta name="description" content="${escapeAttr(description)}">
${keywords ? `<meta name="keywords" content="${escapeAttr(keywords)}">` : ''}
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
<meta name="googlebot" content="index, follow">
<meta name="author" content="${escapeAttr(authorName)}">
<meta name="language" content="pt-BR">
<link rel="canonical" href="${escapeAttr(url)}">
<link rel="alternate" hreflang="pt-BR" href="${escapeAttr(url)}">
<link rel="alternate" hreflang="x-default" href="${escapeAttr(url)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="#738251">

<!-- Open Graph -->
<meta property="og:type" content="article">
<meta property="og:url" content="${escapeAttr(url)}">
<meta property="og:title" content="${escapeAttr(title)}">
<meta property="og:description" content="${escapeAttr(description)}">
<meta property="og:image" content="${escapeAttr(image)}">
<meta property="og:image:alt" content="${escapeAttr(title)}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:locale" content="pt_BR">
${publishedAt ? `<meta property="article:published_time" content="${escapeAttr(publishedAt)}">` : ''}
${modifiedAt ? `<meta property="article:modified_time" content="${escapeAttr(modifiedAt)}">` : ''}
${post.category ? `<meta property="article:section" content="${escapeAttr(post.category.name)}">` : ''}
${(post.tags || []).map(t => `<meta property="article:tag" content="${escapeAttr(t.name)}">`).join('\n')}

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:url" content="${escapeAttr(url)}">
<meta name="twitter:title" content="${escapeAttr(title)}">
<meta name="twitter:description" content="${escapeAttr(description)}">
<meta name="twitter:image" content="${escapeAttr(image)}">
<meta name="twitter:image:alt" content="${escapeAttr(title)}">

<style>${BASE_STYLES}</style>

<script type="application/ld+json">${JSON.stringify(blogPostingSchema)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
${faqSchema ? `<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>` : ''}

<!--
  Redireciona humanos que cheguem direto à versão SSR para o SPA real.
  Bots não executam JS, então continuam vendo este HTML completo.
-->
<script>
  (function(){
    try {
      var isBot = /bot|crawler|spider|crawling|facebookexternalhit|whatsapp|telegram|linkedin|slackbot|twitterbot|discord|pinterest|applebot|duckduckbot|yandex|baidu|bingbot|googlebot|google-inspection-tool|lighthouse|headlesschrome/i.test(navigator.userAgent);
      if (!isBot) {
        window.location.replace(${JSON.stringify(`/blog/${post.slug}`)});
      }
    } catch (e) {}
  })();
</script>
</head>
<body>
<header class="site">
  <div class="wrap">
    <a class="brand" href="/"><span class="logo">OC</span>${SITE_NAME}</a>
    <nav>
      <a href="/blog" aria-current="page">Blog</a>
      <a href="/">Home</a>
      <a href="/login">Entrar</a>
    </nav>
  </div>
</header>

<main>
  <article>
    ${post.coverImageUrl ? `<img class="cover" src="${escapeAttr(post.coverImageUrl)}" alt="${escapeAttr(title)}" width="1200" height="630">` : ''}
    ${breadcrumbHtml}
    ${categoryHtml}
    <h1>${escapeHtml(title)}</h1>
    ${post.excerpt ? `<p class="excerpt">${escapeHtml(post.excerpt)}</p>` : ''}
    <div class="meta">
      <span><strong>${escapeHtml(authorName)}</strong></span>
      ${publishedLabel ? `<time datetime="${escapeAttr(publishedAt)}">${escapeHtml(publishedLabel)}</time>` : ''}
      ${post.readingTimeMin ? `<span>${escapeHtml(post.readingTimeMin)} min de leitura</span>` : ''}
    </div>

    <div class="content">
      ${contentHtml}
    </div>

    ${tagsHtml ? `<div class="tags" style="margin-top:32px;padding-top:16px;border-top:1px solid #e7e5e4;">${tagsHtml}</div>` : ''}

    <section class="cta">
      <h2>Gostou deste artigo?</h2>
      <p>Acompanhe o desenvolvimento do seu bebê com o OlieCare.</p>
      <a class="btn" href="/register">Começar Grátis</a>
      <a class="btn ghost" href="/blog">Mais Artigos</a>
    </section>
  </article>
</main>

<footer class="site">
  <p>&copy; ${new Date().getFullYear()} ${SITE_NAME}. Todos os direitos reservados.</p>
  <p>
    <a href="/privacidade">Privacidade</a> &middot;
    <a href="/termos">Termos</a> &middot;
    <a href="/para-profissionais">Para Profissionais</a>
  </p>
</footer>
</body>
</html>`;
}

// ==========================================
// Renderizar listagem /blog
// ==========================================

export interface SsrListOptions {
  page?: number;
  category?: string;
  tag?: string;
  q?: string;
}

export async function renderListHtml(opts: SsrListOptions = {}): Promise<string> {
  const siteUrl = getSiteUrl();
  const page = opts.page && opts.page > 0 ? opts.page : 1;

  const result = await BlogService.listPublishedPosts({
    page,
    limit: 24,
    categorySlug: opts.category,
    tagSlug: opts.tag,
    q: opts.q,
  });

  const title = opts.category
    ? `Blog OlieCare - Categoria ${opts.category}`
    : opts.tag
      ? `Blog OlieCare - Tag ${opts.tag}`
      : `Blog | ${SITE_NAME} - Cuidados com Bebê`;
  const description = 'Artigos baseados em evidências sobre cuidados com bebês, amamentação, sono infantil, desenvolvimento e dicas para pais e profissionais de saúde.';
  const canonical = `${siteUrl}/blog${page > 1 ? `?page=${page}` : ''}`;

  const blogSchema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `Blog ${SITE_NAME}`,
    description,
    url: `${siteUrl}/blog`,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/favicon-512.png`,
      },
    },
    blogPost: result.data.slice(0, 10).map(p => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `${siteUrl}/blog/${p.slug}`,
      datePublished: p.publishedAt ? new Date(p.publishedAt).toISOString() : undefined,
      image: p.coverImageUrl || undefined,
      description: p.excerpt || undefined,
    })),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl}/blog` },
    ],
  };

  const postsHtml = result.data
    .map(p => {
      const postUrl = `${siteUrl}/blog/${p.slug}`;
      return `
        <article class="card">
          ${p.coverImageUrl ? `<a href="${escapeAttr(postUrl)}"><img src="${escapeAttr(p.coverImageUrl)}" alt="${escapeAttr(p.title)}" loading="lazy"></a>` : ''}
          <div class="body">
            ${p.category ? `<div class="cat">${escapeHtml(p.category.name)}</div>` : ''}
            <h2><a href="${escapeAttr(postUrl)}">${escapeHtml(p.title)}</a></h2>
            ${p.excerpt ? `<p>${escapeHtml(p.excerpt)}</p>` : ''}
            <a class="readmore" href="${escapeAttr(postUrl)}">Ler artigo &rarr;</a>
          </div>
        </article>
      `;
    })
    .join('\n');

  // Paginação
  const prevUrl = page > 1 ? `${siteUrl}/blog?page=${page - 1}` : null;
  const nextUrl = page < result.pagination.totalPages ? `${siteUrl}/blog?page=${page + 1}` : null;

  const paginationHtml =
    result.pagination.totalPages > 1
      ? `
        <nav aria-label="Paginação" style="margin-top:32px;display:flex;gap:12px;justify-content:center;">
          ${prevUrl ? `<a class="btn ghost" style="padding:8px 16px;border-radius:8px;border:1px solid #d6d3d1;" href="${escapeAttr(prevUrl)}">&larr; Anterior</a>` : ''}
          <span style="padding:8px 16px;">Página ${page} de ${result.pagination.totalPages}</span>
          ${nextUrl ? `<a class="btn ghost" style="padding:8px 16px;border-radius:8px;border:1px solid #d6d3d1;" href="${escapeAttr(nextUrl)}">Próxima &rarr;</a>` : ''}
        </nav>
      `
      : '';

  return `<!doctype html>
<html lang="pt-BR" prefix="og: https://ogp.me/ns#">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeAttr(description)}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<meta name="language" content="pt-BR">
<link rel="canonical" href="${escapeAttr(canonical)}">
${prevUrl ? `<link rel="prev" href="${escapeAttr(prevUrl)}">` : ''}
${nextUrl ? `<link rel="next" href="${escapeAttr(nextUrl)}">` : ''}
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="#738251">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:url" content="${escapeAttr(canonical)}">
<meta property="og:title" content="${escapeAttr(title)}">
<meta property="og:description" content="${escapeAttr(description)}">
<meta property="og:image" content="${escapeAttr(`${siteUrl}/og-image.png`)}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:locale" content="pt_BR">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:url" content="${escapeAttr(canonical)}">
<meta name="twitter:title" content="${escapeAttr(title)}">
<meta name="twitter:description" content="${escapeAttr(description)}">
<meta name="twitter:image" content="${escapeAttr(`${siteUrl}/og-image.png`)}">

<style>${BASE_STYLES}</style>

<script type="application/ld+json">${JSON.stringify(blogSchema)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>

<script>
  (function(){
    try {
      var isBot = /bot|crawler|spider|crawling|facebookexternalhit|whatsapp|telegram|linkedin|slackbot|twitterbot|discord|pinterest|applebot|duckduckbot|yandex|baidu|bingbot|googlebot|google-inspection-tool|lighthouse|headlesschrome/i.test(navigator.userAgent);
      if (!isBot) {
        window.location.replace('/blog' + window.location.search);
      }
    } catch (e) {}
  })();
</script>
</head>
<body>
<header class="site">
  <div class="wrap">
    <a class="brand" href="/"><span class="logo">OC</span>${SITE_NAME}</a>
    <nav>
      <a href="/blog" aria-current="page">Blog</a>
      <a href="/">Home</a>
      <a href="/login">Entrar</a>
    </nav>
  </div>
</header>

<main>
  <h1>Blog ${SITE_NAME}</h1>
  <p class="excerpt">Artigos sobre cuidados com bebês, amamentação, sono infantil e desenvolvimento. Conteúdo baseado em evidências para pais, cuidadores e profissionais de saúde.</p>

  ${result.data.length === 0 ? `<p>Nenhum artigo encontrado.</p>` : `<div class="grid">${postsHtml}</div>`}

  ${paginationHtml}
</main>

<footer class="site">
  <p>&copy; ${new Date().getFullYear()} ${SITE_NAME}. Todos os direitos reservados.</p>
  <p>
    <a href="/privacidade">Privacidade</a> &middot;
    <a href="/termos">Termos</a> &middot;
    <a href="/para-profissionais">Para Profissionais</a>
  </p>
</footer>
</body>
</html>`;
}

export function renderNotFoundHtml(slugOrPath: string): string {
  const siteUrl = getSiteUrl();
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Artigo não encontrado | ${SITE_NAME}</title>
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="${escapeAttr(`${siteUrl}/blog`)}">
<style>${BASE_STYLES}</style>
</head>
<body>
<main>
  <h1>Artigo não encontrado</h1>
  <p>Não encontramos nenhum artigo publicado com o identificador informado${slugOrPath ? ` (<code>${escapeHtml(slugOrPath)}</code>)` : ''}.</p>
  <p><a class="btn" href="/blog">Ver todos os artigos</a></p>
</main>
</body>
</html>`;
}
