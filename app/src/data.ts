import type { DictFile, Field } from './types';

export const DATA_URL = new URL('data/', document.baseURI).href;

export interface Dict extends DictFile {
  pos: Map<number, number>;
}

export interface Catalog {
  n: number;
  shardSize: number;
  price: Int32Array;
  brand: Int32Array;
  type: Int32Array;
  bcOff: Uint32Array;
  bcVal: Int32Array;
  ingOff: Uint32Array;
  ingVal: Int32Array;
  dicts: Record<Field, Dict>;
}

const fetchJson = async <T>(name: string): Promise<T> => (await fetch(DATA_URL + name)).json();
const fetchInts = async (name: string) =>
  new Int32Array(await (await fetch(DATA_URL + name)).arrayBuffer());
const fetchBytes = async (name: string) =>
  new Uint8Array(await (await fetch(DATA_URL + name)).arrayBuffer());

/** Раскодирует список списков: длина + zigzag-дельты (см. scripts/build-data.mjs). */
function decodeLists(bytes: Uint8Array, n: number): { off: Uint32Array; val: Int32Array } {
  const off = new Uint32Array(n + 1);
  let val = new Int32Array(Math.max(bytes.length, 1));
  let p = 0;
  let o = 0;
  const varint = () => {
    let r = 0;
    let mul = 1;
    for (;;) {
      const b = bytes[p++];
      r += (b & 0x7f) * mul;
      if (b < 0x80) return r;
      mul *= 128;
    }
  };
  for (let i = 0; i < n; i++) {
    off[i] = o;
    const len = varint();
    let prev = 0;
    for (let k = 0; k < len; k++) {
      const z = varint();
      prev += z % 2 === 0 ? z / 2 : -(z + 1) / 2;
      val[o++] = prev;
    }
  }
  off[n] = o;
  val = val.slice(0, o);
  return { off, val };
}

const toDict = (f: DictFile): Dict => ({ ...f, pos: new Map(f.ids.map((id, i) => [id, i])) });

export async function loadCatalog(): Promise<Catalog> {
  const meta = await fetchJson<{ count: number; shardSize: number }>('meta.json');
  const [price, brand, type, bcBytes, ingBytes, brands, types, bcs, ings] = await Promise.all([
    fetchInts('price.bin'),
    fetchInts('brand.bin'),
    fetchInts('type.bin'),
    fetchBytes('breadcrumbs.bin'),
    fetchBytes('ingredients.bin'),
    fetchJson<DictFile>('brands.json'),
    fetchJson<DictFile>('types.json'),
    fetchJson<DictFile>('breadcrumbs.json'),
    fetchJson<DictFile>('ingredients.json'),
  ]);
  const bc = decodeLists(bcBytes, meta.count);
  const ing = decodeLists(ingBytes, meta.count);
  return {
    n: meta.count,
    shardSize: meta.shardSize,
    price,
    brand,
    type,
    bcOff: bc.off,
    bcVal: bc.val,
    ingOff: ing.off,
    ingVal: ing.val,
    dicts: { brand: toDict(brands), type: toDict(types), bc: toDict(bcs), ing: toDict(ings) },
  };
}

export const label = (c: Catalog, field: Field, id: number): string => {
  const d = c.dicts[field];
  const i = d.pos.get(id);
  return i === undefined ? `#${id}` : d.names[i];
};

// ---------- тексты товаров лежат в шардах по shardSize штук ----------
export interface ProductText {
  name: string;
  title: string;
  url: string;
}

const shardCache = new Map<number, Promise<string[][]>>();
const loadShard = (s: number) => {
  let p = shardCache.get(s);
  if (!p) {
    p = fetchJson<string[][]>(`shards/${s}.json`);
    shardCache.set(s, p);
  }
  return p;
};

export async function loadTexts(c: Catalog, indices: number[]): Promise<ProductText[]> {
  const shards = await Promise.all(indices.map((i) => loadShard(Math.floor(i / c.shardSize))));
  return indices.map((i, k) => {
    const [name, title, url] = shards[k][i % c.shardSize];
    return { name, title, url };
  });
}

export const productUrl = (url: string) => 'https://goldapple.ru/' + url.replace(/^\/+/, '');
