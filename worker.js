import { FetchSvuClient } from "./src/server/fetch_svu_client.js";

let svuClient = null;

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
            if (!svuClient) svuClient = new FetchSvuClient();
            const action = url.pathname.replace('/api/svu/', '');

            try {
                const term = url.searchParams.get('term');
                const program = url.searchParams.get('program');
                const course = url.searchParams.get('course');
                const tutor = url.searchParams.get('tutor');
                const val = url.searchParams.get('val');
                const courseId = url.searchParams.get('courseId');

                let result;
                if (url.pathname === '/api/svu/init') {
                    result = await svuClient.initialize();
                } else {
                    switch (action) {
                        case 'term':
                            if (term) await svuClient.restoreState(term);
                            result = await svuClient.selectTerm(val);
                            break;
                        case 'program':
                            if (term) await svuClient.restoreState(term);
                            result = await svuClient.selectProgram(val);
                            break;
                        case 'course':
                            if (term) await svuClient.restoreState(term, program);
                            result = await svuClient.selectCourse(val);
                            break;
                        case 'tutor':
                            if (term) await svuClient.restoreState(term, program, course);
                            result = await svuClient.selectTutor(val);
                            break;
                        case 'class':
                            if (term) await svuClient.restoreState(term, program, course, tutor);
                            result = await svuClient.selectClass(val, courseId);
                            break;
                        case 'links':
                            const sessionInfo = JSON.parse(decodeURIComponent(url.searchParams.get('session')));
                            if (sessionInfo.term && sessionInfo.program && sessionInfo.course_id && sessionInfo.tutor && sessionInfo.class_name) {
                                await svuClient.restoreState(sessionInfo.term, sessionInfo.program, sessionInfo.course_id, sessionInfo.tutor, sessionInfo.class_name);
                            }
                            result = await svuClient.fetchSessionLinks(sessionInfo);
                            break;
                        default:
                            return new Response(JSON.stringify({ success: false, error: 'Unknown action' }), { status: 404 });
                    }
                }
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

        // 2. Handle Proxy logic (if target param is present)
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
        // When using Workers with Assets, the assets are served automatically if the worker doesn't respond, 
        // but since we provided a fetch handler, we must explicitly call env.ASSETS.fetch
        if (env.ASSETS) {
           return await env.ASSETS.fetch(request);
        }

        return new Response("Not Found", { status: 404 });
    }
};
