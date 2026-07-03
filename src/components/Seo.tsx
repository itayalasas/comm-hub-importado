import { useEffect } from 'react';

const BRAND_NAME = 'SendCraft';
const DEFAULT_IMAGE = '/og-image.svg';

export interface SeoProps {
  title: string;
  description: string;
  path?: string;
  canonicalUrl?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  noIndex?: boolean;
  keywords?: string[];
  themeColor?: string;
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
}

function getOrCreateMeta(selector: string, attrName: string, attrValue: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrValue);
    document.head.appendChild(element);
  }
  return element;
}

function setMetaName(name: string, content: string) {
  const element = getOrCreateMeta(`meta[name="${name}"]`, 'name', name);
  element.setAttribute('content', content);
}

function setMetaProperty(property: string, content: string) {
  const element = getOrCreateMeta(`meta[property="${property}"]`, 'property', property);
  element.setAttribute('content', content);
}

function setLinkRel(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

function removeMeta(selector: string) {
  const element = document.head.querySelector(selector);
  if (element) {
    element.remove();
  }
}

function resolveAbsoluteUrl(pathOrUrl: string | undefined, fallbackPath: string): string {
  if (pathOrUrl && /^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  if (typeof window === 'undefined') {
    return pathOrUrl || fallbackPath;
  }

  const basePath = pathOrUrl || fallbackPath;
  const normalizedPath = basePath.startsWith('/') ? basePath : `/${basePath}`;
  return new URL(normalizedPath, window.location.origin).toString();
}

export function Seo({
  title,
  description,
  path,
  canonicalUrl,
  image = DEFAULT_IMAGE,
  type = 'website',
  noIndex = false,
  keywords,
  themeColor = '#061827',
  structuredData,
}: SeoProps) {
  const structuredDataString = structuredData ? JSON.stringify(structuredData) : '';

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const fullTitle = title.includes(BRAND_NAME) ? title : `${title} | ${BRAND_NAME}`;
    const resolvedPath = path || window.location.pathname;
    const resolvedCanonical = resolveAbsoluteUrl(canonicalUrl, resolvedPath);
    const resolvedImage = resolveAbsoluteUrl(image, '/og-image.svg');

    document.title = fullTitle;

    setMetaName('description', description);
    setMetaName('robots', noIndex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large');
    setMetaName('theme-color', themeColor);

    if (keywords && keywords.length > 0) {
      setMetaName('keywords', keywords.join(', '));
    } else {
      removeMeta('meta[name="keywords"]');
    }

    setLinkRel('canonical', resolvedCanonical);

    setMetaProperty('og:site_name', BRAND_NAME);
    setMetaProperty('og:type', type);
    setMetaProperty('og:title', fullTitle);
    setMetaProperty('og:description', description);
    setMetaProperty('og:url', resolvedCanonical);
    setMetaProperty('og:image', resolvedImage);
    setMetaProperty('og:image:alt', `${BRAND_NAME} preview image`);

    setMetaName('twitter:card', 'summary_large_image');
    setMetaName('twitter:title', fullTitle);
    setMetaName('twitter:description', description);
    setMetaName('twitter:image', resolvedImage);

    const existingScript = document.getElementById('seo-structured-data');
    if (existingScript) {
      existingScript.remove();
    }

    if (structuredDataString) {
      const script = document.createElement('script');
      script.id = 'seo-structured-data';
      script.type = 'application/ld+json';
      script.textContent = structuredDataString;
      document.head.appendChild(script);
    }
  }, [canonicalUrl, description, image, keywords, noIndex, path, structuredDataString, themeColor, title, type]);

  return null;
}
