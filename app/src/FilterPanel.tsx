import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconChevronsRight, IconMinus, IconPlus, IconSearch, IconX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { label, type Catalog } from './data';
import { FIELD_LABEL, FIELDS, MULTI_FIELDS, type Field, type Filter, type Mode } from './types';
import { useSearch } from './useSearch';

interface Props {
  catalog: Catalog;
  filters: Filter[];
  onAdd: (f: Filter) => void;
  onRemove: (f: Filter) => void;
  onClear: () => void;
}

export function FilterPanel({ catalog, filters, onAdd, onRemove, onClear }: Props) {
  const search = useSearch();
  const [field, setField] = useState<Field>('brand');
  const [query, setQuery] = useState('');
  const [debounced] = useDebouncedValue(query, 150);
  const [found, setFound] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    search(field, debounced).then((ids) => {
      if (stale) return;
      setFound(ids);
      setLoading(false);
    });
    return () => {
      stale = true;
    };
  }, [search, field, debounced]);

  const dict = catalog.dicts[field];
  const stateOf = (id: number) => filters.find((f) => f.field === field && f.id === id)?.mode;

  return (
    <Stack gap="md">
      <Paper withBorder p="sm" radius="md">
        <Stack gap="xs">
          <Text fw={600}>Добавить фильтр</Text>
          <SegmentedControl
            size="xs"
            fullWidth
            value={field}
            onChange={(v) => {
              setField(v as Field);
              setQuery('');
            }}
            data={FIELDS.map((f) => ({ value: f, label: FIELD_LABEL[f] }))}
          />
          <TextInput
            placeholder={`Поиск: ${FIELD_LABEL[field].toLowerCase()}`}
            leftSection={<IconSearch size={16} />}
            rightSection={loading ? <Loader size={14} /> : undefined}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          <ScrollArea.Autosize mah={340} type="auto" offsetScrollbars="y">
            <Stack gap={2}>
              {found.map((id) => {
                const i = dict.pos.get(id)!;
                const state = stateOf(id);
                return (
                  <Group key={id} gap="xs" wrap="nowrap" justify="space-between">
                    <div style={{ minWidth: 0 }}>
                      <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
                        {dict.names[i]}
                      </Text>
                      {dict.orig?.[i] ? (
                        <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
                          {dict.orig[i]}
                        </Text>
                      ) : null}
                    </div>
                    <Group gap={4} wrap="nowrap">
                      <Text size="xs" c="dimmed">
                        {dict.counts[i]}
                      </Text>
                      <ActionIcon
                        size="sm"
                        color="green"
                        variant={state === 'in' ? 'filled' : 'light'}
                        aria-label="Добавить в фильтр"
                        onClick={() => onAdd({ field, id, mode: 'in' })}
                      >
                        <IconPlus size={14} />
                      </ActionIcon>
                      {MULTI_FIELDS.includes(field) && (
                        <ActionIcon
                          size="sm"
                          color="blue"
                          variant={state === 'any' ? 'filled' : 'light'}
                          title="Любой из"
                          aria-label="Добавить в фильтр «любой из»"
                          onClick={() => onAdd({ field, id, mode: 'any' })}
                        >
                          <IconChevronsRight size={14} />
                        </ActionIcon>
                      )}
                      <ActionIcon
                        size="sm"
                        color="red"
                        variant={state === 'ex' ? 'filled' : 'light'}
                        aria-label="Исключить"
                        onClick={() => onAdd({ field, id, mode: 'ex' })}
                      >
                        <IconMinus size={14} />
                      </ActionIcon>
                    </Group>
                  </Group>
                );
              })}
              {!loading && found.length === 0 && (
                <Text size="sm" c="dimmed">
                  Ничего не найдено
                </Text>
              )}
            </Stack>
          </ScrollArea.Autosize>
        </Stack>
      </Paper>

      <Paper withBorder p="sm" radius="md">
        <Group justify="space-between" mb="xs">
          <Text fw={600}>Активные фильтры</Text>
          {filters.length > 0 && (
            <Button size="compact-xs" variant="subtle" color="gray" onClick={onClear}>
              Сбросить
            </Button>
          )}
        </Group>
        {filters.length === 0 ? (
          <Text size="sm" c="dimmed">
            Фильтры не заданы. Значения из списка выше добавляются кнопкой «+», исключаются кнопкой «−».
          </Text>
        ) : (
          <Group gap={6}>
            {filters.map((f) => (
              <ActiveBadge key={`${f.field}${f.id}`} catalog={catalog} filter={f} onRemove={onRemove} />
            ))}
          </Group>
        )}
        <Text size="xs" c="dimmed" mt="sm">
          Разные поля объединяются через «И». «+» у категорий и состава — товар должен содержать все
          такие значения, синяя «≫» — хотя бы одно из отмеченных ею; несколько брендов/типов —
          «любой из». Исключённые значения не должны встречаться в товаре.
        </Text>
      </Paper>
    </Stack>
  );
}

function ActiveBadge({
  catalog,
  filter,
  onRemove,
}: {
  catalog: Catalog;
  filter: Filter;
  onRemove: (f: Filter) => void;
}) {
  const mode: Mode = filter.mode;
  return (
    <Badge
      size="lg"
      radius="xl"
      variant="light"
      color={mode === 'in' ? 'green' : mode === 'any' ? 'blue' : 'red'}
      tt="none"
      styles={{ label: { whiteSpace: 'normal' } }}
      leftSection={
        mode === 'in' ? (
          <IconPlus size={12} />
        ) : mode === 'any' ? (
          <IconChevronsRight size={12} />
        ) : (
          <IconMinus size={12} />
        )
      }
      rightSection={
        <ActionIcon
          size="xs"
          variant="transparent"
          color="inherit"
          aria-label="Убрать фильтр"
          onClick={() => onRemove(filter)}
        >
          <IconX size={12} />
        </ActionIcon>
      }
    >
      {FIELD_LABEL[filter.field]}{mode === 'any' ? ' (любой из)' : ''}: {label(catalog, filter.field, filter.id)}
    </Badge>
  );
}
