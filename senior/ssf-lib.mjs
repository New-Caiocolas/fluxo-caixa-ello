/**
 * Leitura e edição de arquivos .ssf (export de web services do Senior G5).
 *
 * ORIGEM: subconjunto de `tools/ssf.mjs` do repositório Coletor-ello, onde o
 * formato foi descoberto por engenharia reversa e validado nas 32 portas do
 * `com.ello.coletor`. Copiado para cá — em vez de importado por caminho
 * absoluto — para este projeto funcionar em qualquer máquina, inclusive onde
 * aquele repositório não esteja clonado.
 *
 * Se o formato ganhar suporte novo lá (por exemplo, decodificar o grid das
 * portas do `com.ello.metrics`, hoje não suportado), traga a atualização
 * para cá em vez de divergir.
 *
 * Formato do arquivo:
 *   Cabeçalho:
 *     [u32 magic][u8 len]"sapiens"[u8 len]"interno"[u32][u8 len]<provedor>[00][u32 qtdPortas]
 *   TOC (uma entrada por porta):
 *     [u8 len]<nomePorta>[u8 flag][u32 offsetAbsoluto]
 *   Blob de cada porta:
 *     [descrição, parâmetros e colunas em texto puro]
 *     [u32 tamanhoAteOFim][8 bytes de flags][u8 chaveXOR][u32 tamanhoTexto]
 *     [regra LSP cifrada com XOR de 1 byte, até o fim do blob]
 */

const u32 = (v) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(v);
  return b;
};

/** Acha [chave][u32 len][texto até o fim do blob] varrendo de trás para frente. */
function findRule(blob) {
  for (let i = blob.length - 9; i >= 0; i--) {
    const key = blob[i];
    if (key === 0) continue;
    const len = blob.readUInt32LE(i + 1);
    if (len < 20 || len !== blob.length - (i + 5)) continue;
    const probe = Buffer.alloc(Math.min(len, 120));
    for (let j = 0; j < probe.length; j++) probe[j] = blob[i + 5 + j] ^ key;
    const s = probe.toString("latin1");
    if (/Definir|SQL_|Execsql|\/\*|[A-Za-z_]+\s*=\s*/i.test(s)) {
      return { pos: i, key, len, sizePos: i - 12 };
    }
  }
  return null;
}

export function parseSsf(buf) {
  const raw = buf.toString("latin1");
  const m = raw.match(/[\x01-\x40]([a-zA-Z][a-zA-Z0-9_.]{4,60})\x00/);
  if (!m) throw new Error("não achei o nome do provedor");
  const provider = m[1];
  const provPos = raw.indexOf(provider);

  let p = provPos + provider.length + 1 + 4; // pula [00] e o u32 de contagem
  const ports = [];
  while (p < buf.length) {
    const len = buf[p];
    if (len === 0 || len > 64) break;
    const name = buf.toString("latin1", p + 1, p + 1 + len);
    if (!/^[a-zA-Z0-9_]+$/.test(name)) break;
    const offPos = p + 1 + len + 1; // pula 1 byte de flag
    const off = buf.readUInt32LE(offPos);
    if (off >= buf.length) break;
    ports.push({ name, off, offPos });
    p = offPos + 4;
  }
  if (!ports.length) throw new Error("TOC vazio");

  const byOffset = [...ports].sort((a, b) => a.off - b.off);
  byOffset.forEach((e, i) => {
    e.end = i + 1 < byOffset.length ? byOffset[i + 1].off : buf.length;
  });

  for (const e of ports) e.rule = findRule(buf.subarray(e.off, e.end));
  return { provider, provPos, ports, byOffset };
}

export function getRuleText(buf, port) {
  if (!port.rule) return null;
  const { pos, key, len } = port.rule;
  const out = Buffer.alloc(len);
  for (let j = 0; j < len; j++) out[j] = buf[port.off + pos + 5 + j] ^ key;
  return out.toString("latin1");
}

/** Reconstrói o arquivo a partir dos blobs e reescreve os offsets do TOC. */
function rebuild(buf, parsed, newBlobs) {
  const { ports, byOffset } = parsed;
  const head = buf.subarray(0, byOffset[0].off);
  const chunks = [head];
  const newOffsets = new Map();
  let cursor = head.length;
  for (const e of byOffset) {
    const blob = newBlobs.get(e.name) ?? buf.subarray(e.off, e.end);
    newOffsets.set(e.name, cursor);
    chunks.push(blob);
    cursor += blob.length;
  }
  const out = Buffer.concat(chunks);
  for (const e of ports) out.writeUInt32LE(newOffsets.get(e.name), e.offPos);
  return out;
}

export function setRule(buf, portName, newText) {
  const parsed = parseSsf(buf);
  const port = parsed.ports.find((x) => x.name === portName);
  if (!port) throw new Error(`porta não encontrada: ${portName}`);
  if (!port.rule) throw new Error(`bloco de regra não localizado em ${portName}`);

  const blob = Buffer.from(buf.subarray(port.off, port.end));
  const { pos, key, sizePos } = port.rule;
  const body = Buffer.from(newText, "latin1");
  const enc = Buffer.alloc(body.length);
  for (let j = 0; j < body.length; j++) enc[j] = body[j] ^ key;

  const novo = Buffer.concat([blob.subarray(0, pos), Buffer.from([key]), u32(body.length), enc]);
  novo.writeUInt32LE(novo.length - sizePos, sizePos);

  return rebuild(buf, parsed, new Map([[portName, novo]]));
}
