import { FetchSvuClient } from "../../../src/server/fetch_svu_client.js";
import { normalizeSvuAction, runSvuMetadataAction } from "../../../src/server/svu_api_runtime.js";

export async function onRequest(context) {
    const { request, params } = context;
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

    const action = normalizeSvuAction(params.path || url.pathname.split('/').pop());

    try {
        if (action === 'download') {
            const downloadUrl = url.searchParams.get('url');
            if (!downloadUrl) throw new Error("Missing url parameter");
            const downloadRes = await fetch(decodeURIComponent(downloadUrl), {
                headers: { "User-Agent": "Mozilla/5.0" }
            });
            const downloadHeaders = new Headers(downloadRes.headers);
            downloadHeaders.set("Access-Control-Allow-Origin", "*");
            return new Response(downloadRes.body, {
                status: downloadRes.status,
                headers: downloadHeaders
            });
        }

        const client = new FetchSvuClient();
        const result = await runSvuMetadataAction({
            client,
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
        console.error("Pages Function API Error:", err);
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    }
}
