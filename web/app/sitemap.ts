import type { MetadataRoute } from "next";
import { looperPublicOrigin } from "../../electron/src/shared/product";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    changeFrequency: "weekly",
    priority: 1,
    url: looperPublicOrigin
  }];
}
