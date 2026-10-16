const { test } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/download');

const pdf = Buffer.from('%PDF-1.4\n\x00\xff\n%%EOF\n', 'latin1');
const body = { pdf: pdf.toString('base64'), filename: 'Curriculo_João.pdf' };
function request(data = body, overrides = {}) {
  const result = { headers: {} };
  const res = {
    setHeader(key, value) { result.headers[key.toLowerCase()] = value; },
    status(code) { result.status = code; return res; },
    json(value) { result.body = value; return result; },
    send(value) { result.body = value; return result; },
  };
  return handler({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: data, ...overrides }, res);
}

test('download returns identical PDF bytes as a named attachment with no caching', () => {
  for (const data of [body, new URLSearchParams(body).toString(), Buffer.from(new URLSearchParams(body).toString())]) {
    const result = request(data);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, pdf);
    assert.equal(result.headers['content-type'], 'application/octet-stream');
    assert.match(result.headers['content-disposition'], /^attachment; filename="Curriculo_Joao.pdf";/);
    assert.match(result.headers['content-disposition'], /filename\*=UTF-8''Curriculo_Jo%C3%A3o.pdf/);
    assert.equal(result.headers['content-length'], String(pdf.length));
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.headers['x-content-type-options'], 'nosniff');
  }
});

test('download rejects invalid, oversized and cross-site requests', () => {
  assert.equal(request(body, { method: 'GET' }).status, 405);
  assert.equal(request(body, { headers: { 'content-type': 'application/json' } }).status, 415);
  assert.equal(request(body, { headers: { 'content-type': 'application/x-www-form-urlencoded', 'sec-fetch-site': 'cross-site' } }).status, 403);
  for (const data of [null, {}, { pdf: [body.pdf] }, { pdf: '!!!!' }, { pdf: 'AAAA' }, { pdf: body.pdf + '=' }, { pdf: 'A'.repeat(3333336 + 4) }]) {
    assert.equal(request(data).status, 400);
  }
  assert.equal(request('a'.repeat(handler.MAX_BODY_BYTES + 1)).status, 413);
  const result = request({ ...body, filename: 'x\r\nSet-Cookie: attack/".pdf' });
  assert.equal(result.status, 200);
  assert.doesNotMatch(result.headers['content-disposition'], /[\r\n]/);
});
