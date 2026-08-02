import type { MetadataRoute } from "next";
import { looperPublicOrigin } from "../../electron/src/shared/product";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        allow: ["/"],
        disallow: ["/api/"],
        userAgent: "*"
      }
    ],
    sitemap: `${looperPublicOrigin}/sitemap.xml`
  };
}
