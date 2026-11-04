// The open pages. A client is { send(event, data), busy(), host, seen }.
export function createHub() {
  const clients = new Set();
  return {
    clients,
    add: c => clients.add(c),
    remove: c => clients.delete(c),
    broadcast(event, data, hostOnly = false) { for (const c of clients) if (c.host || !hostOnly) c.send(event, data); },
  };
}
