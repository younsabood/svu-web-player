import { FetchSvuClient } from "../../../src/server/fetch_svu_client.js";

let svuClient = null;

export async function onRequest(context) {
    const { request, env, params } = context;
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

    if (!svuClient) svuClient = new FetchSvuClient();
    
    // params.path is an array from the [[path]] matcher
    const action = params.path ? params.path[0] : url.pathname.split('/').pop();

    try {
        const term = url.searchParams.get('term');
        const program = url.searchParams.get('program');
        const course = url.searchParams.get('course');
        const tutor = url.searchParams.get('tutor');
        const val = url.searchParams.get('val');
        const courseId = url.searchParams.get('courseId');

        let result;
        if (action === 'init') {
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
                case 'download':
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
                case 'links':
                    const sessionParam = url.searchParams.get('session');
                    if (!sessionParam) throw new Error("Missing session parameter");
                    const sessionInfo = JSON.parse(decodeURIComponent(sessionParam));
                    if (sessionInfo.term && sessionInfo.program && sessionInfo.course_id && sessionInfo.tutor && sessionInfo.class_name) {
                        await svuClient.restoreState(sessionInfo.term, sessionInfo.program, sessionInfo.course_id, sessionInfo.tutor, sessionInfo.class_name);
                    }
                    result = await svuClient.fetchSessionLinks(sessionInfo);
                    break;
                default:
                    return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), { status: 404 });
            }
        }
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
