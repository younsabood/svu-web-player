export async function onRequest(context) {
    const { request } = context;
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

    const targetUrl = url.searchParams.get("target");
    if (!targetUrl) {
        return new Response("Missing 'target' parameter", { status: 400 });
    }

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
