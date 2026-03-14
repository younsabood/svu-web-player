import { FetchSvuClient } from "./src/server/fetch_svu_client.js";
import { normalizeSvuAction, runSvuMetadataAction } from "./src/server/svu_api_runtime.js";

export default {
    async fetch(request, env) {
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

        // 1. Handle SVU API requests
        if (url.pathname.startsWith('/api/svu')) {
            const action = normalizeSvuAction(url.pathname.replace('/api/svu/', ''));

            try {
                if (action === 'download') {
                    const downloadUrl = url.searchParams.get('url');
                    if (!downloadUrl) return new Response("Missing url", { status: 400 });
                    const dRes = await fetch(decodeURIComponent(downloadUrl), {
                        headers: { "User-Agent": "Mozilla/5.0" }
                    });
                    const dHeaders = new Headers(dRes.headers);
                    dHeaders.set("Access-Control-Allow-Origin", "*");
                    return new Response(dRes.body, { status: dRes.status, headers: dHeaders });
                }

                const svuClient = new FetchSvuClient();
                const result = await runSvuMetadataAction({
                    client: svuClient,
                    action,
                    searchParams: url.searchParams
                });

                return new Response(JSON.stringify({ success: true, data: result }), {
                    headers: { 
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*"
                    }
                });
            } catch (err) {
                console.error("Worker API Error:", err);
                return new Response(JSON.stringify({ success: false, error: err.message }), {
                    status: 500,
                    headers: { 
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*"
                    }
                });
            }
        }

        // 2. Handle Proxy logic (rest as before)
        const targetUrl = url.searchParams.get("target");
        if (targetUrl) {
            try {
                const externalResponse = await fetch(targetUrl, {
                    method: request.method,
                    headers: {
                        "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0",
                    }
                });

                const responseHeaders = new Headers(externalResponse.headers);
                responseHeaders.set("Access-Control-Allow-Origin", "*");
                responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
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

        // 3. Fallback: Serve static assets
        if (env.ASSETS) {
           return await env.ASSETS.fetch(request);
        }

        return new Response("Not Found", { status: 404 });
    }
};
