/**
 * eBay Uploader Module
 * MODE A: Draft Mode — generates structured JSON/CSV for manual upload
 * MODE B: API Mode — integrates with eBay Trading API for direct draft creation
 */

import type { EbayOptimizedListing } from "./optimizer.js";

export interface EbayDraftPayload {
  id: string;
  title: string;
  description: string;
  price: number;
  categoryId: string;
  conditionId: string;
  itemSpecifics: Record<string, string>;
  pictureUrls: string[];
  quantity: number;
  format: "FixedPriceItem" | "Chinese";
  duration: "GTC" | "Days_7" | "Days_30";
  shippingService: string;
  returnPolicy: {
    returnsAccepted: boolean;
    returnPeriod: string;
    refundMethod: string;
  };
}

export interface UploadResult {
  success: boolean;
  mode: "draft" | "api";
  draftJson?: EbayDraftPayload;
  csvRows?: string;
  ebayItemId?: string;
  ebayListingUrl?: string;
  error?: string;
}

// ── Generate eBay-compatible draft payload ────────────────────────────────────
export function createEbayDraft(
  listing: EbayOptimizedListing,
  options: {
    price?: number;
    quantity?: number;
    imageUrls?: string[];
    useGTC?: boolean;
    shipService?: string;
  } = {}
): EbayDraftPayload {
  const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    title: listing.title,
    description: listing.description,
    price: options.price ?? 9.99,
    categoryId: listing.categoryId,
    conditionId: listing.conditionId,
    itemSpecifics: listing.itemSpecifics,
    pictureUrls: options.imageUrls ?? [],
    quantity: options.quantity ?? 1,
    format: "FixedPriceItem",
    duration: options.useGTC ? "GTC" : "Days_30",
    shippingService: options.shipService ?? "USPSFirstClass",
    returnPolicy: {
      returnsAccepted: true,
      returnPeriod: "Days_30",
      refundMethod: "MoneyBack",
    },
  };
}

// ── Convert draft to eBay Bulk Upload CSV ─────────────────────────────────────
export function draftToCsv(draft: EbayDraftPayload): string {
  const headers = [
    "Action", "SiteID", "Currency", "Title", "Category", "Price", "Quantity",
    "ConditionID", "Format", "Duration", "BuyItNowPrice",
    "Picture URL 1", "Picture URL 2", "Picture URL 3", "Picture URL 4",
    "Description", "ShippingService-1:Option", "ShippingService-1:Cost",
    "ReturnsAcceptedOption", "ReturnPeriod", "RefundOption",
    ...Object.keys(draft.itemSpecifics).map(k => `C:${k}`),
  ];

  const values = [
    "Add", "0", "USD", `"${draft.title.replace(/"/g, '""')}"`,
    draft.categoryId, draft.price, draft.quantity,
    draft.conditionId, draft.format, draft.duration, draft.price,
    ...[...Array(4)].map((_, i) => draft.pictureUrls[i] ?? ""),
    `"${draft.description.replace(/"/g, '""').replace(/\n/g, " ")}"`,
    draft.shippingService, "0",
    draft.returnPolicy.returnsAccepted ? "ReturnsAccepted" : "ReturnsNotAccepted",
    draft.returnPolicy.returnPeriod,
    draft.returnPolicy.refundMethod,
    ...Object.values(draft.itemSpecifics).map(v => `"${v}"`),
  ];

  return [headers.join(","), values.join(",")].join("\n");
}

// ── eBay Trading API (MODE B) — create draft listing ─────────────────────────
export async function publishViaEbayApi(
  draft: EbayDraftPayload,
  authToken: string
): Promise<UploadResult> {
  // Build AddItem XML request
  const itemSpecificsXml = Object.entries(draft.itemSpecifics)
    .map(([name, value]) => `
      <NameValueList>
        <Name>${escapeXml(name)}</Name>
        <Value>${escapeXml(value)}</Value>
      </NameValueList>`)
    .join("");

  const picturesXml = draft.pictureUrls.length
    ? `<PictureDetails>
        ${draft.pictureUrls.map(url => `<PictureURL>${escapeXml(url)}</PictureURL>`).join("\n")}
      </PictureDetails>`
    : "";

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<AddItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${authToken}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <Title>${escapeXml(draft.title)}</Title>
    <Description><![CDATA[${draft.description}]]></Description>
    <PrimaryCategory><CategoryID>${draft.categoryId}</CategoryID></PrimaryCategory>
    <StartPrice>${draft.price}</StartPrice>
    <Quantity>${draft.quantity}</Quantity>
    <ListingType>${draft.format}</ListingType>
    <ListingDuration>${draft.duration}</ListingDuration>
    <ConditionID>${draft.conditionId}</ConditionID>
    <Country>US</Country>
    <Currency>USD</Currency>
    <DispatchTimeMax>1</DispatchTimeMax>
    ${picturesXml}
    <ItemSpecifics>
      ${itemSpecificsXml}
    </ItemSpecifics>
    <ShippingDetails>
      <ShippingType>Flat</ShippingType>
      <ShippingServiceOptions>
        <ShippingServicePriority>1</ShippingServicePriority>
        <ShippingService>${draft.shippingService}</ShippingService>
        <ShippingServiceCost>0.00</ShippingServiceCost>
      </ShippingServiceOptions>
    </ShippingDetails>
    <ReturnPolicy>
      <ReturnsAcceptedOption>${draft.returnPolicy.returnsAccepted ? "ReturnsAccepted" : "ReturnsNotAccepted"}</ReturnsAcceptedOption>
      <ReturnPeriod>${draft.returnPolicy.returnPeriod}</ReturnPeriod>
      <RefundOption>${draft.returnPolicy.refundMethod}</RefundOption>
    </ReturnPolicy>
  </Item>
</AddItemRequest>`;

  try {
    const res = await fetch("https://api.ebay.com/ws/api.dll", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
        "X-EBAY-API-CALL-NAME": "AddItem",
        "X-EBAY-API-SITEID": "0",
      },
      body: xml,
      signal: AbortSignal.timeout(30000),
    });

    const responseXml = await res.text();
    const itemIdMatch = /<ItemID>(\d+)<\/ItemID>/.exec(responseXml);
    const errorsMatch = /<ShortMessage>([^<]+)<\/ShortMessage>/.exec(responseXml);

    if (itemIdMatch) {
      return {
        success: true,
        mode: "api",
        ebayItemId: itemIdMatch[1],
        ebayListingUrl: `https://www.ebay.com/itm/${itemIdMatch[1]}`,
      };
    }

    return {
      success: false,
      mode: "api",
      error: errorsMatch?.[1] ?? "eBay API returned an error. Check token and permissions.",
    };
  } catch (err) {
    return { success: false, mode: "api", error: String(err) };
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── MODE A: Full draft mode (no API needed) ───────────────────────────────────
export function generateDraftMode(
  listing: EbayOptimizedListing,
  options: Parameters<typeof createEbayDraft>[1]
): UploadResult {
  const draft = createEbayDraft(listing, options);
  const csvRows = draftToCsv(draft);
  return {
    success: true,
    mode: "draft",
    draftJson: draft,
    csvRows,
  };
}
