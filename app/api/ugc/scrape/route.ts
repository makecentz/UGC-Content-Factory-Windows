import { NextResponse } from "next/server";
import OpenAI from "openai";

type ScrapedProduct = {
  productName: string;
  productCategory: string;
  productDescription: string;
  productBenefits: string;
  offerText: string;
  ctaText: string;
  targetAudience: string;
};

function cleanHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 14000);
}

function meta(html: string, name: string) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["'][^>]*>`, "i")
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function title(html: string) {
  return meta(html, "og:title") || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || "";
}

function fallbackProduct(url: string, html: string): ScrapedProduct {
  const pageTitle = title(html).replace(/\s*[|–-]\s*.+$/, "");
  const description = meta(html, "og:description") || meta(html, "description");
  return {
    productName: pageTitle || new URL(url).hostname.replace(/^www\./, ""),
    productCategory: "Product",
    productDescription: description || cleanHtml(html).slice(0, 360),
    productBenefits: "",
    offerText: "",
    ctaText: "Shop now",
    targetAudience: ""
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const rawUrl = String(body.url || "").trim();
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid protocol.");
  } catch {
    return NextResponse.json({ error: "Enter a valid product URL starting with http:// or https://." }, { status: 400 });
  }

  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        "user-agent": "Mozilla/5.0 ReelPilot local product scraper",
        accept: "text/html,application/xhtml+xml"
      }
    });
    if (!response.ok) throw new Error(`Product page returned ${response.status}.`);
    const html = await response.text();
    const fallback = fallbackProduct(parsed.toString(), html);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ product: fallback, source: "metadata" });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const ai = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Extract product information from ecommerce page text for a UGC ad form. Return strict JSON with productName, productCategory, productDescription, productBenefits, offerText, ctaText, targetAudience. Use concise, editable marketing language. Do not invent medical or financial claims."
        },
        {
          role: "user",
          content: `URL: ${parsed.toString()}
Title: ${title(html)}
Description: ${meta(html, "description") || meta(html, "og:description")}
Page text:
${cleanHtml(html)}`
        }
      ]
    });
    const raw = ai.choices[0]?.message.content;
    const product = raw ? { ...fallback, ...(JSON.parse(raw) as Partial<ScrapedProduct>) } : fallback;
    return NextResponse.json({ product, source: "ai" });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Could not scrape that product page: ${error.message}`
            : "Could not scrape that product page."
      },
      { status: 400 }
    );
  }
}
