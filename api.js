export async function onRequest(context) {
  const url = new URL(context.request.url);
  let path = url.searchParams.get("path") || "";
  path = path.replace(/^\/+/, "");

  let host, clean;
  if (path.startsWith("stats/")) {
    host = "api.nhle.com";
    clean = path;
  } else if (path.startsWith("api-web.nhle.com/")) {
    host = "api-web.nhle.com";
    clean = path.slice("api-web.nhle.com/".length);
  } else if (path.startsWith("v1/")) {
    host = "api-web.nhle.com";
    clean = path;
  } else {
    return json({error:"Endpoint NHL non autorisé"},400);
  }

  const target = new URL(`https://${host}/${clean}`);
  for (const [k,v] of url.searchParams.entries()) {
    if (k !== "path") target.searchParams.set(k,v);
  }

  try {
    const r = await fetch(target.toString(), {
      headers: {
        "User-Agent":"RATSDUBET-NHL/1.0",
        "Accept":"application/json"
      },
      cf:{cacheTtl:60,cacheEverything:true}
    });
    const body = await r.text();
    return new Response(body,{
      status:r.status,
      headers:{
        "content-type":r.headers.get("content-type")||"application/json",
        "cache-control":"public, max-age=60"
      }
    });
  } catch(e) {
    return json({error:String(e)},502);
  }
}

function json(x,status=200){
  return new Response(JSON.stringify(x),{
    status,
    headers:{"content-type":"application/json","cache-control":"no-store"}
  });
}
