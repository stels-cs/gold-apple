// Выгружает данные из PostgreSQL в статические файлы public/data.
// Запуск: DATABASE_URL=... npm run build-data
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://goldapple:goldapple@localhost:54321/goldapple';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');
const SHARD_SIZE = 1000;

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

// ---------- varint-кодирование списков id (порядок элементов сохраняется) ----------
class ByteWriter {
  constructor() {
    this.buf = Buffer.alloc(1 << 20);
    this.len = 0;
  }
  byte(b) {
    if (this.len === this.buf.length) {
      const n = Buffer.alloc(this.buf.length * 2);
      this.buf.copy(n);
      this.buf = n;
    }
    this.buf[this.len++] = b;
  }
  varint(v) {
    while (v > 0x7f) {
      this.byte((v & 0x7f) | 0x80);
      v = Math.floor(v / 128);
    }
    this.byte(v);
  }
  // список: длина, затем zigzag-дельты от предыдущего элемента
  list(arr) {
    this.varint(arr.length);
    let prev = 0;
    for (const x of arr) {
      const d = x - prev;
      this.varint(d >= 0 ? d * 2 : -d * 2 - 1);
      prev = x;
    }
  }
  result() {
    return this.buf.subarray(0, this.len);
  }
}

const write = (name, data) => fs.writeFileSync(path.join(OUT, name), data);
const writeJson = (name, obj) => write(name, JSON.stringify(obj));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'shards'), { recursive: true });

// ---------- товары ----------
console.log('Загрузка товаров...');
const { rows } = await client.query(`
  select name, brand_id, product_type_id, breadcrumb_ids, ingredient_ids,
         description_title, price::int as price, url
  from product_info
  order by price, item_id`);
const n = rows.length;
console.log('товаров:', n);

const price = new Int32Array(n);
const brand = new Int32Array(n);
const type = new Int32Array(n);
const bcW = new ByteWriter();
const ingW = new ByteWriter();
const counts = { brand: new Map(), type: new Map(), bc: new Map(), ing: new Map() };
const inc = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);

for (let s = 0; s * SHARD_SIZE < n; s++) {
  const shard = [];
  for (let i = s * SHARD_SIZE; i < Math.min(n, (s + 1) * SHARD_SIZE); i++) {
    const r = rows[i];
    price[i] = r.price;
    brand[i] = r.brand_id ?? 0;
    type[i] = r.product_type_id ?? 0;
    const bc = [...new Set(r.breadcrumb_ids ?? [])];
    const ing = [...new Set(r.ingredient_ids ?? [])];
    bcW.list(bc);
    ingW.list(ing);
    if (brand[i]) inc(counts.brand, brand[i]);
    if (type[i]) inc(counts.type, type[i]);
    bc.forEach((x) => inc(counts.bc, x));
    ing.forEach((x) => inc(counts.ing, x));
    shard.push([r.name, r.description_title ?? '', r.url]);
  }
  writeJson(`shards/${s}.json`, shard);
}
write('price.bin', Buffer.from(price.buffer));
write('brand.bin', Buffer.from(brand.buffer));
write('type.bin', Buffer.from(type.buffer));
write('breadcrumbs.bin', bcW.result());
write('ingredients.bin', ingW.result());
writeJson('meta.json', { count: n, shardSize: SHARD_SIZE, shards: Math.ceil(n / SHARD_SIZE) });

// ---------- справочники (колонками: ids / names / counts [/ orig]) ----------
function dict(items, countMap) {
  const used = items.filter((x) => countMap.has(x.id));
  used.sort((a, b) => countMap.get(b.id) - countMap.get(a.id));
  return {
    ids: used.map((x) => x.id),
    names: used.map((x) => x.name),
    counts: used.map((x) => countMap.get(x.id)),
    ...(used.some((x) => x.orig) ? { orig: used.map((x) => x.orig ?? '') } : {}),
  };
}

const brands = (await client.query('select id, name from brand')).rows;
writeJson('brands.json', dict(brands, counts.brand));

const types = (await client.query('select id, name from product_type')).rows;
writeJson('types.json', dict(types, counts.type));

// категория: полный путь из текстов существующих предков
const crumbs = (await client.query('select id, href, text from breadcrumb')).rows;
const byHref = new Map(crumbs.map((c) => [c.href, c]));
const crumbItems = crumbs.map((c) => {
  const parts = c.href.split('/').filter(Boolean);
  const chain = [];
  for (let i = 1; i <= parts.length; i++) {
    const a = byHref.get('/' + parts.slice(0, i).join('/'));
    if (a) chain.push(a.text);
  }
  return { id: c.id, name: chain.join(' › ') };
});
writeJson('breadcrumbs.json', dict(crumbItems, counts.bc));

// ингредиенты: русское название, если есть перевод; оригинал сохраняем для поиска
const ings = (await client.query('select id, name, name_ru from ingredient')).rows.map((r) => ({
  id: r.id,
  name: r.name_ru || r.name,
  orig: r.name_ru ? r.name : undefined,
}));
writeJson('ingredients.json', dict(ings, counts.ing));

await client.end();
const size = fs.readdirSync(OUT).reduce((s, f) => {
  const p = path.join(OUT, f);
  return s + (fs.statSync(p).isFile() ? fs.statSync(p).size : 0);
}, 0);
console.log('готово, без шардов:', (size / 1e6).toFixed(1), 'MB');
