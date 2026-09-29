import {
  AppShell,
  Center,
  Container,
  Grid,
  Group,
  Loader,
  Pagination,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilterPanel } from './FilterPanel';
import { ProductCard } from './ProductCard';
import { applyFilters, decodeState, encodeState } from './filter';
import { loadCatalog, loadTexts, type Catalog, type ProductText } from './data';
import type { Filter } from './types';

const PAGE_SIZE = 30;
const initial = decodeState(window.location.hash);

export function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [filters, setFilters] = useState<Filter[]>(initial.filters);
  const [desc, setDesc] = useState(initial.desc);
  const [page, setPage] = useState(initial.page);

  useEffect(() => {
    loadCatalog().then(setCatalog);
  }, []);

  useEffect(() => {
    const h = encodeState({ filters, desc, page });
    window.history.replaceState(null, '', h ? '#' + h : window.location.pathname + window.location.search);
  }, [filters, desc, page]);

  const matched = useMemo(() => (catalog ? applyFilters(catalog, filters) : null), [catalog, filters]);

  const pages = matched ? Math.max(1, Math.ceil(matched.length / PAGE_SIZE)) : 1;
  const current = Math.min(page, pages);

  // индексы товаров текущей страницы; данные отсортированы по возрастанию цены
  const pageIdx = useMemo(() => {
    if (!matched) return [];
    const out: number[] = [];
    for (let k = 0; k < PAGE_SIZE; k++) {
      const pos = (current - 1) * PAGE_SIZE + k;
      if (pos >= matched.length) break;
      out.push(desc ? matched[matched.length - 1 - pos] : matched[pos]);
    }
    return out;
  }, [matched, current, desc]);

  const [texts, setTexts] = useState<{ idx: number[]; items: ProductText[] } | null>(null);
  useEffect(() => {
    if (!catalog) return;
    let stale = false;
    loadTexts(catalog, pageIdx).then((items) => {
      if (!stale) setTexts({ idx: pageIdx, items });
    });
    return () => {
      stale = true;
    };
  }, [catalog, pageIdx]);

  const addFilter = useCallback((f: Filter) => {
    setFilters((prev) => [...prev.filter((x) => !(x.field === f.field && x.id === f.id)), f]);
    setPage(1);
  }, []);
  const removeFilter = useCallback((f: Filter) => {
    setFilters((prev) => prev.filter((x) => !(x.field === f.field && x.id === f.id)));
    setPage(1);
  }, []);
  const clear = useCallback(() => {
    setFilters([]);
    setPage(1);
  }, []);

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md">
          <Title order={3}>Каталог товаров</Title>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="xl" p={0}>
          {!catalog || !matched ? (
            <Center h={300}>
              <Stack align="center" gap="xs">
                <Loader />
                <Text c="dimmed">Загрузка каталога…</Text>
              </Stack>
            </Center>
          ) : (
            <Grid gap="md">
              <Grid.Col span={{ base: 12, md: 4 }}>
                <div style={{ position: 'sticky', top: 72, maxHeight: 'calc(100vh - 88px)', overflowY: 'auto' }}>
                  <FilterPanel
                    catalog={catalog}
                    filters={filters}
                    onAdd={addFilter}
                    onRemove={removeFilter}
                    onClear={clear}
                  />
                </div>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Stack gap="md">
                  <Group justify="space-between">
                    <Text fw={600}>
                      Найдено: {matched.length.toLocaleString('ru-RU')} из{' '}
                      {catalog.n.toLocaleString('ru-RU')}
                    </Text>
                    <SegmentedControl
                      size="xs"
                      value={desc ? 'desc' : 'asc'}
                      onChange={(v) => {
                        setDesc(v === 'desc');
                        setPage(1);
                      }}
                      data={[
                        { value: 'asc', label: 'Цена ↑' },
                        { value: 'desc', label: 'Цена ↓' },
                      ]}
                    />
                  </Group>
                  {matched.length === 0 && <Text c="dimmed">Нет товаров, подходящих под фильтры.</Text>}
                  {texts && texts.idx === pageIdx
                    ? texts.items.map((t, k) => (
                        <ProductCard
                          key={pageIdx[k]}
                          catalog={catalog}
                          index={pageIdx[k]}
                          text={t}
                          filters={filters}
                          onAdd={addFilter}
                        />
                      ))
                    : matched.length > 0 && (
                        <Center h={200}>
                          <Loader />
                        </Center>
                      )}
                  {pages > 1 && (
                    <Pagination
                      value={current}
                      onChange={(p) => {
                        setPage(p);
                        window.scrollTo({ top: 0 });
                      }}
                      total={pages}
                      siblings={1}
                    />
                  )}
                </Stack>
              </Grid.Col>
            </Grid>
          )}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
