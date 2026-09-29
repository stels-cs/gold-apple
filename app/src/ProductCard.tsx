import { Anchor, Button, Card, Group, Stack, Text } from '@mantine/core';
import { memo, useState } from 'react';
import { label, productUrl, type Catalog, type ProductText } from './data';
import { MULTI_FIELDS, type Field, type Filter, type Mode } from './types';
import { ValueChip } from './ValueChip';

const INGREDIENTS_COLLAPSED = 12;

interface Props {
  catalog: Catalog;
  index: number;
  text: ProductText;
  filters: Filter[];
  onAdd: (f: Filter) => void;
}

const rub = new Intl.NumberFormat('ru-RU');

export const ProductCard = memo(function ProductCard({ catalog: c, index: i, text, filters, onAdd }: Props) {
  const [showAll, setShowAll] = useState(false);
  const state = (field: Field, id: number) =>
    filters.find((f) => f.field === field && f.id === id)?.mode;

  const brand = c.brand[i];
  const type = c.type[i];
  const bcs = Array.from(c.bcVal.subarray(c.bcOff[i], c.bcOff[i + 1]));
  const allIngs = Array.from(c.ingVal.subarray(c.ingOff[i], c.ingOff[i + 1]));
  const ings = showAll ? allIngs : allIngs.slice(0, INGREDIENTS_COLLAPSED);

  const row = (field: Field, title: string, ids: number[], extra?: React.ReactNode) =>
    ids.length > 0 && (
      <Group gap={6} align="flex-start">
        <Text size="xs" c="dimmed" w={80} pt={3}>
          {title}
        </Text>
        <Group gap={4} style={{ flex: 1, minWidth: 0 }}>
          {ids.map((id) => (
            <ValueChip
              key={id}
              text={label(c, field, id)}
              allowAny={MULTI_FIELDS.includes(field)}
              active={state(field, id)}
              onAdd={(mode: Mode) => onAdd({ field, id, mode })}
            />
          ))}
          {extra}
        </Group>
      </Group>
    );

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap={6}>
        <Anchor href={productUrl(text.url)} target="_blank" rel="noreferrer" fw={600}>
          {type ? label(c, 'type', type) + ' ' : ''}
          {text.name}
        </Anchor>
        <Group gap="sm" align="baseline">
          <Text fw={700}>{rub.format(c.price[i])} ₽</Text>
          <Text size="sm" c="dimmed">
            {text.title}
          </Text>
        </Group>
        <Stack gap={4} mt={4}>
          {row('brand', 'Бренд', brand ? [brand] : [])}
          {row('type', 'Тип', type ? [type] : [])}
          {row('bc', 'Категории', bcs)}
          {row(
            'ing',
            'Состав',
            ings,
            allIngs.length > INGREDIENTS_COLLAPSED && (
              <Button size="compact-xs" variant="subtle" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Свернуть' : `Ещё ${allIngs.length - INGREDIENTS_COLLAPSED}`}
              </Button>
            ),
          )}
        </Stack>
      </Stack>
    </Card>
  );
});
