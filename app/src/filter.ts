import type { Catalog } from './data';
import type { Filter } from './types';

const ids = (filters: Filter[], field: Filter['field'], mode: Filter['mode']) =>
  filters.filter((f) => f.field === field && f.mode === mode).map((f) => f.id);

function hasAny(val: Int32Array, from: number, to: number, wanted: number[]): boolean {
  for (let k = from; k < to; k++) if (wanted.includes(val[k])) return true;
  return false;
}

function hasAll(val: Int32Array, from: number, to: number, wanted: number[]): boolean {
  for (const w of wanted) {
    let found = false;
    for (let k = from; k < to; k++) {
      if (val[k] === w) {
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return true;
}

/**
 * Возвращает индексы подходящих товаров по возрастанию (товары в данных отсортированы по цене).
 *
 * Разные поля объединяются через И. Включающие фильтры одного поля:
 *  - бренд, тип — товар должен иметь ЛЮБОЕ из значений (у товара оно одно);
 *  - категория, состав — товар должен иметь ВСЕ значения.
 * Для категорий и состава есть ещё режим «any»: товар должен иметь ХОТЯ БЫ ОДНО из значений этого режима.
 * Исключающие фильтры: у товара не должно быть НИ ОДНОГО из значений.
 */
export function applyFilters(c: Catalog, filters: Filter[]): Int32Array {
  const inBrand = ids(filters, 'brand', 'in');
  const exBrand = ids(filters, 'brand', 'ex');
  const inType = ids(filters, 'type', 'in');
  const exType = ids(filters, 'type', 'ex');
  const inBc = ids(filters, 'bc', 'in');
  const exBc = ids(filters, 'bc', 'ex');
  const inIng = ids(filters, 'ing', 'in');
  const exIng = ids(filters, 'ing', 'ex');
  const anyBc = ids(filters, 'bc', 'any');
  const anyIng = ids(filters, 'ing', 'any');

  const out = new Int32Array(c.n);
  let m = 0;
  for (let i = 0; i < c.n; i++) {
    const b = c.brand[i];
    if (inBrand.length && !inBrand.includes(b)) continue;
    if (exBrand.length && exBrand.includes(b)) continue;
    const t = c.type[i];
    if (inType.length && !inType.includes(t)) continue;
    if (exType.length && exType.includes(t)) continue;
    if (inBc.length || exBc.length || anyBc.length) {
      const from = c.bcOff[i];
      const to = c.bcOff[i + 1];
      if (inBc.length && !hasAll(c.bcVal, from, to, inBc)) continue;
      if (anyBc.length && !hasAny(c.bcVal, from, to, anyBc)) continue;
      if (exBc.length && hasAny(c.bcVal, from, to, exBc)) continue;
    }
    if (inIng.length || exIng.length || anyIng.length) {
      const from = c.ingOff[i];
      const to = c.ingOff[i + 1];
      if (inIng.length && !hasAll(c.ingVal, from, to, inIng)) continue;
      if (anyIng.length && !hasAny(c.ingVal, from, to, anyIng)) continue;
      if (exIng.length && hasAny(c.ingVal, from, to, exIng)) continue;
    }
    out[m++] = i;
  }
  return out.subarray(0, m);
}

// ---------- состояние фильтров в URL (#f=b+12.i-7&s=desc&p=2) ----------
const CODE = { brand: 'b', type: 't', bc: 'c', ing: 'i' } as const;
const FROM_CODE = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k])) as Record<
  string,
  Filter['field']
>;

export interface UrlState {
  filters: Filter[];
  desc: boolean;
  page: number;
}

export function encodeState(s: UrlState): string {
  const p = new URLSearchParams();
  if (s.filters.length)
    p.set('f', s.filters.map((f) => CODE[f.field] + ({ in: '+', ex: '-', any: '~' }[f.mode]) + f.id).join('.'));
  if (s.desc) p.set('s', 'desc');
  if (s.page > 1) p.set('p', String(s.page));
  return p.toString();
}

export function decodeState(hash: string): UrlState {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const filters: Filter[] = [];
  for (const part of (p.get('f') ?? '').split('.')) {
    const m = /^([btci])([+~-])(\d+)$/.exec(part);
    if (m) filters.push({ field: FROM_CODE[m[1]], mode: m[2] === '+' ? 'in' : m[2] === '~' ? 'any' : 'ex', id: +m[3] });
  }
  return { filters, desc: p.get('s') === 'desc', page: Math.max(1, +(p.get('p') ?? 1) || 1) };
}
