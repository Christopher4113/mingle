import { initEdgeStore } from "@edgestore/server";
import { createEdgeStoreNextHandler } from "@edgestore/server/adapters/next/app";

// Initialize EdgeStore
const es = initEdgeStore.create();

// Set up myPublicFiles with upload and delete functionality
const edgeStoreRouter = es.router({
  myPublicFiles: es.fileBucket({
    maxSize: 1024 * 1024 * 1, // 1MB
    accept: ["image/jpeg", "image/png", "image/webp"],
  })
  .beforeUpload(({ ctx, input, fileInfo }) => {
    console.log('beforeUpload', ctx, input, fileInfo);
    return true; // Allow upload
  })
  .beforeDelete(({ ctx, fileInfo }) => {
    console.log('beforeDelete', ctx, fileInfo);
    return true; // Allow delete
  }),
});

// Create the EdgeStore handler
const handler = createEdgeStoreNextHandler({
  router: edgeStoreRouter,
});

// Export the handler for GET and POST requests
export { handler as GET, handler as POST, handler as PUT };

// Export type for EdgeStoreRouter
export type EdgeStoreRouter = typeof edgeStoreRouter;
