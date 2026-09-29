import { ActionIcon, Group, Text } from '@mantine/core';
import { IconChevronsRight, IconMinus, IconPlus } from '@tabler/icons-react';
import { memo } from 'react';
import type { Mode } from './types';

interface Props {
  text: string;
  active?: Mode;
  onAdd: (mode: Mode) => void;
  /** показывать кнопку «любой из» (для полей с несколькими значениями) */
  allowAny?: boolean;
}

/** Значение поля с кнопками «+» (включить в фильтр) и «−» (исключить). */
export const ValueChip = memo(function ValueChip({ text, active, onAdd, allowAny }: Props) {
  const color = active === 'in' ? 'green' : active === 'ex' ? 'red' : active === 'any' ? 'blue' : 'gray';
  return (
    <Group
      gap={2}
      wrap="nowrap"
      px={6}
      py={1}
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 'var(--mantine-radius-xl)',
        background: active ? `var(--mantine-color-${color}-light)` : undefined,
      }}
    >
      <Text size="xs" title={text} style={{ overflowWrap: 'anywhere' }}>
        {text}
      </Text>
      <ActionIcon
        size="xs"
        variant={active === 'in' ? 'filled' : 'subtle'}
        color="green"
        aria-label="Добавить в фильтр"
        onClick={() => onAdd('in')}
      >
        <IconPlus size={12} />
      </ActionIcon>
      {allowAny && (
        <ActionIcon
          size="xs"
          variant={active === 'any' ? 'filled' : 'subtle'}
          color="blue"
          title="Любой из"
          aria-label="Добавить в фильтр «любой из»"
          onClick={() => onAdd('any')}
        >
          <IconChevronsRight size={12} />
        </ActionIcon>
      )}
      <ActionIcon
        size="xs"
        variant={active === 'ex' ? 'filled' : 'subtle'}
        color="red"
        aria-label="Исключить"
        onClick={() => onAdd('ex')}
      >
        <IconMinus size={12} />
      </ActionIcon>
    </Group>
  );
});
