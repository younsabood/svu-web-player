/**
 * SVU Web Player CORS Proxy - Cloudflare Worker
 * 
 * Deployment Instructions:
 * 1. Log into Cloudflare Dashboard -> Workers
 * 2. Create a new service (e.g., svu-proxy)
 * 3. Paste this code into the Quick Edit box.
 * 4. Deploy and use the worker URL in your SVU Web Player frontend.
 */

export default {
    async fetch(request) {
      const url = new URL(request.url);
      
      // Handle Preflight (CORS)
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          }
        });
      }
  
      // Extract target URL from query param (e.g., ?target=https://sessions.svuonline.org/...)
      const targetUrl = url.searchParams.get("target");
  
      if (!targetUrl) {
        return new Response("Missing 'target' parameter", { status: 400 });
      }
  
      try {
        // Fetch the external resource
        const externalResponse = await fetch(targetUrl, {
          method: request.method,
          headers: {
            "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0",
          }
        });
  
        // Copy original headers and inject CORS headers
        const responseHeaders = new Headers(externalResponse.headers);
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  
        // Crucial for ArrayBuffer streaming
        responseHeaders.delete("X-Frame-Options");
  
        return new Response(externalResponse.body, {
          status: externalResponse.status,
          statusText: externalResponse.statusText,
          headers: responseHeaders
        });
  
      } catch (err) {
        return new Response(err.message || "Proxy Fetch Error", { status: 500 });
      }
    }
  };
  
