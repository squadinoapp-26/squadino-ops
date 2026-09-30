import type { MetadataRoute } from "next";

// This is the staff console: nothing here should ever appear in a search engine.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
