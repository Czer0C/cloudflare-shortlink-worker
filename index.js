// src/templates/populated-worker/src/index.js
import renderHtml from "./renderHtml.js";

var src_default = {
  async fetch(request, env) {
    const { DATABASE_2, SECRET } = env;
    
    const headers = new Map(request.headers);
    const token = headers.get('auth');
    const params = [...new URLSearchParams(request.url).values()];
    const key = params?.[0];

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, HEAD, OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Headers' : 'x-worker-key,Content-Type,x-custom-metadata,Content-MD5,x-amz-meta-fileid,x-amz-meta-account_id,x-amz-meta-clientid,x-amz-meta-file_id,x-amz-meta-opportunity_id,x-amz-meta-client_id,x-amz-meta-webhook',
      'Access-Control-Allow-Credentials' : 'true',
      'Allow': 'GET, POST, PUT, DELETE, HEAD, OPTIONS'
    };

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (token !== SECRET.key_a && key !== SECRET.key_a) {
      return new Response(JSON.stringify({ message: "Unauthenticated access" }), {
        headers: corsHeaders
      });
    }

    const pathCodeParam = request.url.split('/').slice(-1)[0].split('?')[0];

    switch (request.method) {
      case "GET": {
        if (pathCodeParam.length >= 6) {
          const { results, success } = await DATABASE_2.prepare(`select * from link where code = ?1`).bind(pathCodeParam).run();
          const target = results?.[0];

          return new Response(JSON.stringify(success ? target : { success: false, message: "INVALID SLASH CODE" }), {
            headers: corsHeaders
          });
        }

        const { results, success } = await DATABASE_2.prepare(`select * from link`).run();
        return new Response(JSON.stringify({ results }), { headers: corsHeaders });
      }

      case "POST": {
        const body = await request.json();
        const url = body?.url;

        if (typeof url !== 'string' || !url) {
          return new Response(JSON.stringify({ message: "Invalid URL" }), { headers: corsHeaders });
        }

        const { results } = await DATABASE_2.prepare(`select url from link where url = ?1`).bind(url).run();
        if (results?.length > 0) {
          return new Response(JSON.stringify({ message: "Already existed" }), { headers: corsHeaders });
        }

        const shortCode = Math.random().toString(36).substring(6);
        const timeNow = new Date().toISOString();
        const { success, ...rest } = await DATABASE_2.prepare(
          `insert into link (url, code, time_created, time_updated) values (?, ?, ?, ?)`
        ).bind(url, shortCode, timeNow, timeNow).run();

        return new Response(JSON.stringify(success ? { ...rest } : { success }), { headers: corsHeaders });
      }

      case "PUT": {
        const body = await request.json();
        const url = body?.url;

        if (!pathCodeParam?.length) {
          return new Response(JSON.stringify({ success: false, message: "Invalid code updating", pathCodeParam }), { headers: corsHeaders });
        }

        const { success, ...rest } = await DATABASE_2.prepare(`update link set url = ?1 where code = ?2`).bind(url, pathCodeParam).run();
        return new Response(JSON.stringify(success ? { ...rest, message: "UPDATED SUCCESSFULLY" } : { success }), { headers: corsHeaders });
      }

      case "DELETE": {
        if (!pathCodeParam?.length) {
          return new Response(JSON.stringify({ success: false, message: "Invalid code updating", pathCodeParam }), { headers: corsHeaders });
        }

        const { success, ...rest } = await DATABASE_2.prepare(`delete from link where code = ?1`).bind(pathCodeParam).run();
        return new Response(JSON.stringify(success ? { ...rest, message: "DELETED SUCCESSFULLY" } : { success }), { headers: corsHeaders });
      }

      default:
        return new Response(JSON.stringify({ message: "Method Not Allowed" }), {
          status: 405,
          headers: corsHeaders
        });
    }
  }
};

export { src_default as default };
