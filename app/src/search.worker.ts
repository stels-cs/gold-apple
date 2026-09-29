/// <reference lib="webworker" />
// Полнотекстовый поиск по справочникам. Индексы строятся в воркере, чтобы не блокировать UI.
import MiniSearch from 'minisearch';
import type { DictFile, Field } from './types';

const FILES: Record<Field, string> = {
  brand: 'brands.json',
  type: 'types.json',
  bc: 'breadcrumbs.json',
  ing: 'ingredients.json',
};

// Лёгкий «стеммер»: приводим к нижнему регистру, ё→е и отрезаем типичные русские окончания,
// чтобы «гиалуроновая» находилась по «гиалуроновой кислоте».
const ENDINGS = /(ого|его|ому|ему|ами|ями|ая|яя|ой|ый|ий|ое|ее|ые|ие|ых|их|ов|ев|ам|ям|ах|ях|ом|ем|а|я|о|е|ы|и|у|ю|ь|й)$/;
function stem(term: string): string | null {
  const t = term.toLowerCase().replace(/ё/g, 'е');
  if (!t) return null;
  if (/[а-я]/.test(t) && t.length > 4) return t.replace(ENDINGS, '');
  return t;
}

interface Index {
  ms: MiniSearch;
  ids: number[];
  counts: Map<number, number>;
}

const indexes = new Map<Field, Promise<Index>>();
let base = '';

function getIndex(field: Field): Promise<Index> {
  let p = indexes.get(field);
  if (!p) {
    p = (async () => {
      const d: DictFile = await (await fetch(base + FILES[field])).json();
      const ms = new MiniSearch({
        fields: ['name', 'orig'],
        // апостроф выкидываем, а не считаем разделителем: «L'Oreal» ищется как «loreal»
        tokenize: (text) => text.replace(/['’`]/g, '').split(/[\s\-–—.,;:!?()[\]{}"«»/\\|&+*%<>=]+/),
        processTerm: stem,
        searchOptions: { prefix: true, combineWith: 'AND' },
      });
      const docs = d.ids.map((id, i) => ({ id, name: d.names[i], orig: d.orig?.[i] ?? '' }));
      await ms.addAllAsync(docs, { chunkSize: 5000 });
      const counts = new Map(d.ids.map((id, i) => [id, d.counts[i]]));
      return { ms, ids: d.ids, counts };
    })();
    indexes.set(field, p);
  }
  return p;
}

interface Request {
  reqId: number;
  field?: Field;
  query?: string;
  limit?: number;
  base?: string;
}

self.onmessage = async (e: MessageEvent<Request>) => {
  const { reqId, field, query, limit = 50 } = e.data;
  if (e.data.base) {
    // первое сообщение: запоминаем адрес данных и прогреваем индексы по очереди
    base = e.data.base;
    for (const f of ['brand', 'bc', 'type', 'ing'] as Field[]) await getIndex(f);
    return;
  }
  const idx = await getIndex(field!);
  const q = (query ?? '').trim();
  let ids: number[];
  if (!q) {
    ids = idx.ids.slice(0, limit); // справочник уже отсортирован по популярности
  } else {
    // как и на стартовом экране, порядок — по числу товаров; при равенстве остаётся релевантность
    const count = (id: number) => idx.counts.get(id) ?? 0;
    ids = idx.ms
      .search(q)
      .map((h) => h.id as number)
      .sort((a, b) => count(b) - count(a))
      .slice(0, limit);
  }
  self.postMessage({ reqId, ids });
};
