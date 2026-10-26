import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Doctor Queue",
    short_name: "Doctor Queue",
    description: "Check public clinic queues and follow your token.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7faf8",
    theme_color: "#147d55",
    lang: "en-IN",
    categories: ["health", "medical", "utilities"]
  };
}