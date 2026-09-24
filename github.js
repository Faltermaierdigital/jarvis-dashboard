// Duenne Schicht ueber die GitHub REST API. Der Token lebt ausschliesslich in
// dieser Modul-Variable (Arbeitsspeicher) - kein localStorage, kein Cookie.

const API = "https://api.github.com";
let token = null;

export function setToken(t) { token = t; }
export function hasToken() { return !!token; }

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(API + path, {
    method,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const j = await res.json(); if (j.message) msg = `${res.status}: ${j.message}`; } catch {}
    throw new ApiError(res.status, msg);
  }
  return res;
}

export async function getJson(path) {
  return (await request(path)).json();
}

export async function checkAccess(owner, repo) {
  await getJson(`/repos/${owner}/${repo}`);
}

export async function listRuns(owner, repo, workflow, perPage = 50) {
  const j = await getJson(`/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?per_page=${perPage}`);
  return j.workflow_runs || [];
}

export async function dispatch(owner, repo, workflow, ref, inputs) {
  await request(`/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`, {
    method: "POST",
    body: inputs ? { ref, inputs } : { ref },
  });
}

export async function listArtifacts(owner, repo, name, perPage = 30) {
  const j = await getJson(`/repos/${owner}/${repo}/actions/artifacts?name=${encodeURIComponent(name)}&per_page=${perPage}`);
  return (j.artifacts || []).filter((a) => !a.expired);
}

// Laedt das Artifact-ZIP (GitHub leitet auf einen signierten Blob-Link um,
// der CORS erlaubt) und liest die JSON-Datei darin.
export async function readArtifactJson(owner, repo, artifactId, fileName = "result.json") {
  const res = await request(`/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`);
  const buf = await res.arrayBuffer();
  return JSON.parse(await unzipFile(buf, fileName));
}

// Minimaler ZIP-Leser (Central Directory, Stored + Deflate) ohne Fremdcode.
async function unzipFile(buf, wanted) {
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Artifact ist kein gültiges ZIP");
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  // Liegt genau eine Datei im ZIP, wird sie genommen, egal wie sie heisst.
  if (count === 1) wanted = dec.decode(new Uint8Array(buf, off + 46, dv.getUint16(off + 28, true)));
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const csize = dv.getUint32(off + 20, true);
    const nlen = dv.getUint16(off + 28, true);
    const elen = dv.getUint16(off + 30, true);
    const clen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = dec.decode(new Uint8Array(buf, off + 46, nlen));
    if (name === wanted || name.endsWith("/" + wanted)) {
      const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
      const data = new Uint8Array(buf, start, csize);
      if (method === 0) return dec.decode(data);
      if (method === 8) {
        const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return dec.decode(await new Response(stream).arrayBuffer());
      }
      throw new Error(`ZIP-Kompression ${method} nicht unterstützt`);
    }
    off += 46 + nlen + elen + clen;
  }
  throw new Error(`${wanted} nicht im Artifact gefunden`);
}
