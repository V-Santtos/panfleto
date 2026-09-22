import { createApiRouter } from "../server/apiRouter.js"

export const config = { maxDuration: 60 }

export default createApiRouter(process.env)
