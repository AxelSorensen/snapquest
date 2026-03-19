// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },
  ssr: false,
  modules: ["@nuxtjs/tailwindcss"],
  runtimeConfig: {
    public: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
    },
  },

  components: [
    { path: "~/components", pathPrefix: false },
    { path: "app/components", pathPrefix: false },
  ],
});
