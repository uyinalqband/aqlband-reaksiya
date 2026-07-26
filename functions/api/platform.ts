const UPSTREAM =
  'https://idocmxdydrwsizametwg.supabase.co/functions/v1/aqlband-api';

const responseHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

interface PagesContext {
  request: Request;
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const request = context.request;
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({
        ok: false,
        error: { code: 'method_not_allowed', message: 'Use POST' },
      }),
      { status: 405, headers: responseHeaders },
    );
  }

  try {
    const incomingBody = await request.arrayBuffer();
    if (incomingBody.byteLength > 64 * 1024) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'payload_too_large', message: 'So‘rov hajmi juda katta.' },
        }),
        { status: 413, headers: responseHeaders },
      );
    }

    const headers = new Headers({ 'Content-Type': 'application/json' });
    for (const name of [
      'authorization',
      'apikey',
      'x-client-info',
      'x-telegram-init-data',
    ]) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }

    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers,
      body: incomingBody,
      redirect: 'error',
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: 'proxy_network_error',
          message: 'Server bilan ulanishda vaqtinchalik xato yuz berdi.',
        },
      }),
      { status: 502, headers: responseHeaders },
    );
  }
}
