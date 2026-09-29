export type Field = 'brand' | 'type' | 'bc' | 'ing';
/** in — включить (для состава/категорий: «все сразу»), any — «любой из», ex — исключить */
export type Mode = 'in' | 'ex' | 'any';

/** Поля, у которых у товара несколько значений и поэтому есть режим «любой из» */
export const MULTI_FIELDS: Field[] = ['bc', 'ing'];

export interface Filter {
  field: Field;
  id: number;
  mode: Mode;
}

export const FIELDS: Field[] = ['brand', 'type', 'bc', 'ing'];

export const FIELD_LABEL: Record<Field, string> = {
  brand: 'Бренд',
  type: 'Тип продукта',
  bc: 'Категория',
  ing: 'Состав',
};

/** Справочник в колоночном виде, как он лежит в public/data/*.json */
export interface DictFile {
  ids: number[];
  names: string[];
  counts: number[];
  orig?: string[];
}
