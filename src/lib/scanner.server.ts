// Server-only compliance detection rules. Pure functions over HTML strings.

export type Severity = "critical" | "high" | "medium" | "low";
export type Category =
  | "accessibility"
  | "privacy"
  | "cookies"
  | "security"
  | "legal"
  | "forms"
  | "trust";

export type DetectedFinding = {
  title: string;
  category: Category;
  severity: Severity;
  page_url: string;
  description: string;
  why_matters: string;
  suggested_fix: string;
  confidence: number;
};

const LEGAL_KEYWORDS = {
  privacy: [/privacy[-_\s]?policy/i, /privacy/i],
  terms: [/terms/i, /conditions/i, /tos/i, /legal/i],
  contact: [/contact/i],
  about: [/about/i],
};

function count(re: RegExp, text: string) {
  return (text.match(re) || []).length;
}

function extractLinks(html: string): string[] {
  const out: string[] = [];
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push((m[1] + " " + m[2]).toLowerCase());
  }
  return out;
}

function hasLinkMatching(links: string[], patterns: RegExp[]): boolean {
  return links.some((l) => patterns.some((p) => p.test(l)));
}

export function analyzeHtml(pageUrl: string, html: string, responseHeaders: Record<string, string> = {}): DetectedFinding[] {
  const findings: DetectedFinding[] = [];
  const isHttps = pageUrl.startsWith("https://");
  const links = extractLinks(html);

  // 1. Missing image alt text
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const imgsMissingAlt = imgs.filter((i) => !/\balt\s*=\s*["'][^"']*["']/i.test(i)).length;
  if (imgsMissingAlt > 0) {
    findings.push({
      title: `${imgsMissingAlt} image${imgsMissingAlt > 1 ? "s" : ""} missing alt text`,
      category: "accessibility",
      severity: imgsMissingAlt > 5 ? "high" : "medium",
      page_url: pageUrl,
      description: `Detected ${imgsMissingAlt} <img> element(s) without an alt attribute out of ${imgs.length} total images.`,
      why_matters: "Screen readers cannot describe images without alt text, blocking WCAG 2.1 Success Criterion 1.1.1 conformance and exposing the organization to ADA/EAA complaints.",
      suggested_fix: "Add descriptive alt attributes to informative images and alt=\"\" to decorative ones. Review CMS templates so authors cannot publish images without alt values.",
      confidence: 0.95,
    });
  }

  // 2. Form inputs without labels
  const inputs = html.match(/<input\b[^>]*>/gi) || [];
  const textInputs = inputs.filter((i) => !/type\s*=\s*["'](hidden|submit|button|image|reset)["']/i.test(i));
  const unlabeledInputs = textInputs.filter((i) => {
    if (/aria-label\s*=/i.test(i) || /aria-labelledby\s*=/i.test(i) || /placeholder\s*=/i.test(i) === false && false) return false;
    const idMatch = i.match(/\bid\s*=\s*["']([^"']+)["']/i);
    if (idMatch && new RegExp(`<label\\b[^>]*for\\s*=\\s*["']${idMatch[1]}["']`, "i").test(html)) return false;
    if (/aria-label\s*=/i.test(i)) return false;
    return true;
  }).length;
  if (unlabeledInputs > 0) {
    findings.push({
      title: `${unlabeledInputs} form input${unlabeledInputs > 1 ? "s" : ""} missing an accessible label`,
      category: "accessibility",
      severity: "high",
      page_url: pageUrl,
      description: `Detected ${unlabeledInputs} input element(s) without an associated <label>, aria-label, or aria-labelledby.`,
      why_matters: "Inputs without programmatic labels prevent assistive technology from announcing the field's purpose and violate WCAG 3.3.2 Labels or Instructions.",
      suggested_fix: "Label each input with a <label for=\"id\"> or aria-label. Audit form components to enforce a required label prop.",
      confidence: 0.9,
    });
  }

  // 3. Heading structure
  const h1s = count(/<h1\b/gi, html);
  if (h1s === 0) {
    findings.push({
      title: "Page has no <h1> heading",
      category: "accessibility",
      severity: "medium",
      page_url: pageUrl,
      description: "No <h1> element was found in the rendered HTML.",
      why_matters: "The primary heading establishes document structure for screen readers, SEO, and reading-mode tools. Its absence weakens page comprehension.",
      suggested_fix: "Add exactly one descriptive <h1> that reflects the page's primary purpose.",
      confidence: 0.9,
    });
  } else if (h1s > 1) {
    findings.push({
      title: `Page contains ${h1s} <h1> headings`,
      category: "accessibility",
      severity: "low",
      page_url: pageUrl,
      description: `Detected ${h1s} <h1> elements; best practice is exactly one per document.`,
      why_matters: "Multiple top-level headings fragment the document outline and confuse assistive technology.",
      suggested_fix: "Demote secondary <h1> elements to <h2>/<h3> to reflect the true information hierarchy.",
      confidence: 0.75,
    });
  }

  // 4. Viewport meta
  if (!/<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(html)) {
    findings.push({
      title: "Missing responsive viewport meta tag",
      category: "accessibility",
      severity: "medium",
      page_url: pageUrl,
      description: "No <meta name=\"viewport\"> tag detected in the document head.",
      why_matters: "Without a viewport declaration, mobile browsers render at desktop width and force pinch-zoom, degrading mobile accessibility and Core Web Vitals.",
      suggested_fix: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> inside <head>.",
      confidence: 0.98,
    });
  }

  // 5. Privacy policy link
  if (!hasLinkMatching(links, LEGAL_KEYWORDS.privacy)) {
    findings.push({
      title: "No privacy policy link detected",
      category: "privacy",
      severity: "critical",
      page_url: pageUrl,
      description: "No hyperlink referencing a privacy policy was found in the page.",
      why_matters: "GDPR Art. 13, CCPA §1798.130, and UK DPA all require a conspicuously linked privacy notice at the point of collection. Its absence is a direct regulatory exposure.",
      suggested_fix: "Expose a Privacy Policy link in the global footer and near every data-collection surface. Document the notice's version and last-updated date.",
      confidence: 0.9,
    });
  }

  // 6. Terms link
  if (!hasLinkMatching(links, LEGAL_KEYWORDS.terms)) {
    findings.push({
      title: "No terms or legal link detected",
      category: "legal",
      severity: "high",
      page_url: pageUrl,
      description: "No hyperlink referencing terms of service, terms and conditions, or a legal page was found.",
      why_matters: "Terms establish the contractual relationship with visitors and limit liability. Missing terms weaken enforceability of usage restrictions.",
      suggested_fix: "Link to Terms of Service from the global footer. Review with counsel before publication.",
      confidence: 0.85,
    });
  }

  // 7. Contact page
  if (!hasLinkMatching(links, LEGAL_KEYWORDS.contact)) {
    findings.push({
      title: "No contact page or contact link detected",
      category: "trust",
      severity: "medium",
      page_url: pageUrl,
      description: "No hyperlink referencing a contact page or contact method was found.",
      why_matters: "Regulators (FTC, EU DSA Art. 12) and payment processors require identifiable contact information. Its absence undermines trust and marketplace eligibility.",
      suggested_fix: "Expose a Contact link and a physical or legal address in the footer.",
      confidence: 0.85,
    });
  }

  // 8. Cookie consent
  const hasCookieBanner = /cookie/i.test(html) && /(consent|accept|preferences|manage)/i.test(html);
  const hasTrackingScripts = /gtag|google-analytics|googletagmanager|facebook\.net|hotjar|segment\.io|mixpanel/i.test(html);
  if (hasTrackingScripts && !hasCookieBanner) {
    findings.push({
      title: "Tracking scripts detected without visible consent controls",
      category: "cookies",
      severity: "critical",
      page_url: pageUrl,
      description: "Analytics or advertising scripts were detected without any surfaced cookie consent language.",
      why_matters: "GDPR/ePrivacy require prior consent before setting non-essential cookies. Deploying trackers without a consent surface exposes the organization to DPA fines.",
      suggested_fix: "Deploy a compliant CMP (e.g. OneTrust, Cookiebot) that blocks non-essential tags until consent is granted. Document the consent record retention policy.",
      confidence: 0.85,
    });
  }

  // 9. Insecure form action
  const forms = html.match(/<form\b[^>]*>/gi) || [];
  const insecureForms = forms.filter((f) => /action\s*=\s*["']http:\/\//i.test(f)).length;
  if (insecureForms > 0) {
    findings.push({
      title: `${insecureForms} form${insecureForms > 1 ? "s" : ""} submit over insecure HTTP`,
      category: "security",
      severity: "critical",
      page_url: pageUrl,
      description: `Detected ${insecureForms} <form> element(s) with an http:// action attribute.`,
      why_matters: "Form submissions over unencrypted HTTP expose credentials and personal data to network attackers, violating PCI-DSS 4.0 §4.2 and GDPR Art. 32.",
      suggested_fix: "Validate every form action uses https://. Enforce HSTS at the edge to prevent downgrade attacks.",
      confidence: 0.98,
    });
  }

  // 10. Mixed content
  if (isHttps && /["'](http:\/\/[^"']+)["']/.test(html)) {
    const mixed = (html.match(/["']http:\/\/[^"']+["']/g) || []).length;
    findings.push({
      title: `Mixed content: ${mixed} insecure resource reference${mixed > 1 ? "s" : ""}`,
      category: "security",
      severity: "high",
      page_url: pageUrl,
      description: `Detected ${mixed} reference(s) to http:// resources on an https:// page.`,
      why_matters: "Mixed content is blocked by modern browsers and undermines the integrity guarantees of TLS. Users see broken pages or security warnings.",
      suggested_fix: "Rewrite all subresource URLs to https:// or protocol-relative. Add a Content-Security-Policy: upgrade-insecure-requests header.",
      confidence: 0.85,
    });
  }

  // 11. Security headers (if we have response headers)
  if (Object.keys(responseHeaders).length > 0) {
    const missing: string[] = [];
    if (!responseHeaders["strict-transport-security"]) missing.push("Strict-Transport-Security");
    if (!responseHeaders["content-security-policy"]) missing.push("Content-Security-Policy");
    if (!responseHeaders["x-content-type-options"]) missing.push("X-Content-Type-Options");
    if (!responseHeaders["referrer-policy"]) missing.push("Referrer-Policy");
    if (missing.length >= 2) {
      findings.push({
        title: `Missing security headers: ${missing.join(", ")}`,
        category: "security",
        severity: missing.length >= 3 ? "high" : "medium",
        page_url: pageUrl,
        description: `Response is missing recommended security headers: ${missing.join(", ")}.`,
        why_matters: "These headers form the browser's defense in depth against XSS, MIME sniffing, protocol downgrade, and referrer leakage. Their absence is flagged by SOC 2 CC6.6 and ISO 27001 A.13.1 audits.",
        suggested_fix: "Configure the edge/CDN to add the missing headers. Validate with securityheaders.com and document the baseline in the SSDLC policy.",
        confidence: 0.95,
      });
    }
  }

  // 12. Personal data collection without disclosure cues
  const collectsPII = /type\s*=\s*["'](email|tel|password)["']/i.test(html) ||
    /\bname\s*=\s*["'][^"']*(email|phone|ssn|dob|address)[^"']*["']/i.test(html);
  const hasDisclosureNearby = /(privacy|consent|gdpr|we (collect|use|store))/i.test(html);
  if (collectsPII && !hasDisclosureNearby) {
    findings.push({
      title: "Form collects personal data without disclosure language",
      category: "forms",
      severity: "high",
      page_url: pageUrl,
      description: "Detected email/phone/password inputs on a page with no visible privacy disclosure text.",
      why_matters: "GDPR Art. 13 and CCPA §1798.100 require a just-in-time notice at the point of collection describing purpose and legal basis.",
      suggested_fix: "Add a disclosure sentence beneath the form linking to the full privacy policy. Log consent where a lawful basis of consent is used.",
      confidence: 0.75,
    });
  }

  // 13. Skip link (accessibility)
  if (!/<a\b[^>]*href\s*=\s*["']#(main|content|skip)/i.test(html)) {
    findings.push({
      title: "No skip-to-content link detected",
      category: "accessibility",
      severity: "low",
      page_url: pageUrl,
      description: "No skip-navigation anchor was found as the first focusable element.",
      why_matters: "Keyboard users must tab through the entire header to reach content, violating WCAG 2.4.1 Bypass Blocks.",
      suggested_fix: "Add a visually-hidden <a href=\"#main\">Skip to content</a> as the first focusable element in <body>.",
      confidence: 0.7,
    });
  }

  // 14. Document language
  if (!/<html\b[^>]*\blang\s*=/i.test(html)) {
    findings.push({
      title: "Missing lang attribute on <html>",
      category: "accessibility",
      severity: "low",
      page_url: pageUrl,
      description: "The root <html> element has no lang attribute.",
      why_matters: "Assistive technology relies on lang to select correct pronunciation and text processing rules. WCAG 3.1.1 conformance requires it.",
      suggested_fix: "Add lang=\"en\" (or the correct BCP 47 code) to the <html> element in the base template.",
      confidence: 0.98,
    });
  }

  return findings;
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 25,
  high: 12,
  medium: 5,
  low: 2,
};

export function computeScore(findings: DetectedFinding[]): number {
  const penalty = findings.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function categoryBreakdown(findings: DetectedFinding[]) {
  const out: Record<string, number> = {};
  for (const f of findings) out[f.category] = (out[f.category] || 0) + 1;
  return out;
}
