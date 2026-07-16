import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cadesca",
    short_name: "Cadesca",
    description: "A verified student community for campus conversations and university life.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f8",
    theme_color: "#000000",
    icons: [
      {
        src: "/favicon-96x96.png",
        sizes: "96x96",
        type: "image/png"
      },
      {
        src: "/cadesca-mark.png",
        sizes: "560x560",
        type: "image/png"
      }
    ]
  };
}
