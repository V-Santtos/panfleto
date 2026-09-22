import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import { catalogApi } from "./server/catalogApi"
import { createCatalogRepository, type CatalogRepository } from "./server/catalogRepository"
import { cosmosProxy } from "./server/cosmosProxy"
import { kieBackgroundRemoval } from "./server/kieBackgroundRemoval"
import { productImageProxy } from "./server/productImageProxy"

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "")
  const supabaseConfig = {
    url: environment.SUPABASE_URL,
    serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY,
  }
  let catalogRepository: CatalogRepository | undefined
  const repositoryProvider = () => (catalogRepository ??= createCatalogRepository(supabaseConfig))
  return {
    plugins: [
      react(),
      catalogApi(supabaseConfig),
      productImageProxy(),
      kieBackgroundRemoval(environment.KIE_API_KEY),
      cosmosProxy(environment.COSMOS_TOKEN, environment.COSMOS_USER_AGENT, repositoryProvider),
    ],
    server: {
      host: "127.0.0.1",
      port: 4173,
      strictPort: true,
      proxy: {
        "/api/product-by-barcode": {
          target: "https://world.openfoodfacts.org",
          changeOrigin: true,
          headers: {
            "User-Agent": "OfertaLab/0.1 (local product lookup test)",
          },
          rewrite: (path) => path.replace(/^\/api\/product-by-barcode\//, "/api/v2/product/"),
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
    },
  }
})
