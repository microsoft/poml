import * as React from 'react';
import { Markup, Serialize } from 'poml/presentation';
import { PropsSyntaxBase, computeSyntaxContext } from 'poml/essentials';
import { component, expandRelative } from 'poml/base';
import { parseText, guessStringType, AnyValue } from 'poml/util';
import { csvParse, tsvParse, DSVRowArray } from 'd3-dsv';
import { readFileSync } from 'fs';
import * as XLSX from 'xlsx';
import { parsePythonStyleSlice } from './utils';

interface ColumnDefinition {
  field: string;
  header: string;
  description?: string;
}

export interface RecordColumns {
  records: any[];
  columns?: ColumnDefinition[];
}

type TableParser = 'auto' | 'csv' | 'tsv' | 'excel' | 'json' | 'jsonl';

export interface TableProps extends PropsSyntaxBase {
  records?: any[] | string;
  columns?: ColumnDefinition[];
  src?: string;
  parser?: TableParser;
  selectedColumns?: string | string[];
  selectedRecords?: string | number[];
  maxRecords?: number;
  maxColumns?: number;
}

function determineParser(src: string): TableParser {
  src = src.toLowerCase();
  if (src.endsWith('.csv')) {
    return 'csv';
  } else if (src.endsWith('.tsv')) {
    return 'tsv';
  } else if (src.endsWith('.xls') || src.endsWith('.xlsx')) {
    return 'excel';
  } else if (src.endsWith('.jsonl')) {
    return 'jsonl';
  } else if (src.endsWith('.json')) {
    return 'json';
  } else {
    throw new Error('Cannot determine parser for ' + src);
  }
}

function parseTableData(data: Buffer, parser: TableParser): RecordColumns {
  switch (parser) {
    case 'csv':
      return parseCsv(data);
    case 'tsv':
      return parseTsv(data);
    case 'excel':
      return parseExcel(data);
    case 'json':
      return parseJson(data);
    case 'jsonl':
      return parseJsonl(data);
    default:
      throw new Error('Unsupported parser: ' + parser);
  }
}

function postProcessD3Records(records: DSVRowArray<string>): RecordColumns {
  if (records.length === 0 && records.columns === undefined) {
    throw new Error('No records found and no headers provided');
  }
  const columns = records.columns.map((column: string) => ({ field: column, header: column }));
  const columnTypes = records.columns.reduce(
    (prev, column) => {
      prev[column] = 'string';
      if (records.length > 0) {
        const types = records.map((record) => guessStringType(record[column])[1]);
        if (types.every((type) => type === 'boolean')) {
          prev[column] = 'boolean';
        } else if (types.every((type) => type === 'integer' || type === 'boolean')) {
          prev[column] = 'integer';
        } else if (types.every((type) => type === 'float' || type === 'integer' || type === 'boolean')) {
          prev[column] = 'float';
        } else if (types.every((type) => type === 'array' || type === 'object')) {
          prev[column] = 'object';
        }
      }
      return prev;
    },
    {} as Record<string, AnyValue>,
  );

  return {
    records: [
      ...records.map((record: any) => {
        return Object.entries(record).reduce((prev, [key, value]) => {
          if (typeof value === 'string') {
            prev[key] = parseText(value, columnTypes[key]);
          } else {
            prev[key] = value;
          }
          return prev;
        }, {} as any);
      }),
    ],
    columns: columns,
  };
}

function parseCsv(data: Buffer): RecordColumns {
  const records = csvParse(data.toString('utf-8'));
  return postProcessD3Records(records);
}

function parseTsv(data: Buffer): RecordColumns {
  const records = tsvParse(data.toString('utf-8'));
  return postProcessD3Records(records);
}

function parseExcel(data: Buffer): RecordColumns {
  const workbook = XLSX.read(data, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('No sheet found in Excel file');
  }
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rawData.length === 0) {
    return { records: [] };
  }
  const headers = rawData[0] as string[];
  const columns = headers.map((header) => ({ field: header, header }));
  const records = rawData.slice(1).map((row: any) => {
    const record: Record<string, any> = {};
    headers.forEach((header, index) => {
      record[header] = row[index];
    });
    return record;
  });
  return { records, columns };
}

function parseJson(data: Buffer): RecordColumns {
  return { records: JSON.parse(data.toString('utf-8')) };
}

function parseJsonl(data: Buffer): RecordColumns {
  return {
    records: data
      .toString('utf-8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line)),
  };
}

function columnRecordsSelector(
  records: any[],
  columns: ColumnDefinition[] | undefined,
  props: TableProps,
): RecordColumns {
  const { selectedColumns, selectedRecords, maxRecords, maxColumns } = props;
  if (!selectedColumns && !selectedRecords && !maxRecords && !maxColumns) {
    return { records, columns };
  }
  if (selectedColumns && columns) {
    let newColumns: ColumnDefinition[];
    if (Array.isArray(selectedColumns)) {
      newColumns = selectedColumns.map((columnName) => {
        const found = columns!.find((column) => column.field === columnName);
        if (found) {
          return found;
        }
        if (columnName === 'index') {
          return { field: 'index', header: 'Index' };
        }
        throw new Error('Column ' + columnName + 'is selected but not found');
      });
    } else if (typeof selectedColumns === 'string') {
      if (selectedColumns === '+index') {
        newColumns = [{ field: 'index', header: 'Index' }, ...columns];
      } else {
        const [start, end] = parsePythonStyleSlice(selectedColumns, columns.length);
        newColumns = columns.slice(start, end);
      }
    } else {
      throw new Error('Invalid selectedColumns format');
    }
    columns = newColumns;
    records = records.map((record, loopIndex) => {
      return newColumns.reduce((prev, column) => {
        if (column.field === 'index' && record.index === undefined) {
          prev['index'] = loopIndex;
        } else {
          prev[column.field] = record[column.field];
        }
        return prev;
      }, {} as any);
    });
  }
  if (selectedRecords) {
    if (Array.isArray(selectedRecords)) {
      records = selectedRecords.map((index) => records[index]);
    } else if (typeof selectedRecords === 'string') {
      const [start, end] = parsePythonStyleSlice(selectedRecords, records.length);
      records = records.slice(start, end);
    } else {
      throw new Error('Invalid selectedRecords format');
    }
  }
  if (maxRecords && records.length > maxRecords) {
    const topRows = Math.ceil(maxRecords / 2);
    const bottomRows = Math.floor(maxRecords / 2);
    const ellipseRecord = (columns ? columns.map((column) => column.field) : Object.keys(records[0])).reduce(
      (prev, column) => {
        prev[column] = '...';
        return prev;
      },
      {} as any,
    );
    records = [...records.slice(0, topRows), ellipseRecord, ...records.slice(-bottomRows)];
  }
  if (maxColumns && columns && columns.length > maxColumns) {
    const leftColumns = Math.ceil(maxColumns / 2);
    const rightColumns = Math.floor(maxColumns / 2);
    const newColumns = [
      ...columns.slice(0, leftColumns),
      { field: '...', header: '...' },
      ...columns.slice(-rightColumns),
    ];
    records = records.map((record) => {
      return newColumns.reduce((prev, column) => {
        prev[column.field] = column.field === '...' ? '...' : record[column.field];
        return prev;
      }, {} as any);
    });
    columns = newColumns;
  }
  return { records, columns };
}

export function toRecordColumns(props: TableProps): RecordColumns {
  let { records, columns, src, parser } = props;
  if (records !== undefined && typeof records !== 'string') {
    if (!Array.isArray(records)) {
      throw new Error('Records must be an array for table');
    }
    if (records.length > 0 && Array.isArray(records[0])) {
      // Converting to object records
      const maxColumns = Math.max(...records.map((record) => record.length));
      const columns = Array.from({ length: maxColumns }, (_, i) => ({
        field: i.toString(),
        header: 'Column ' + i.toString(),
      }));
      records = records.map((record: any) => {
        return columns.reduce((prev, column, index) => {
          prev[column.field] = index < record.length ? record[index] : undefined;
          return prev;
        }, {} as any);
      });
      return { records, columns };
    }
    return { records, columns };
  }
  // Need to read data from src / parse data from string
  if (parser === 'auto' || parser === undefined) {
    if (!src) {
      throw new Error('Cannot determine parser without source file provided.');
    }
    parser = determineParser(src);
  }
  let data: Buffer;
  if (src) {
    data = readFileSync(expandRelative(src));
  } else if (records) {
    data = Buffer.from(records, 'utf-8');
  } else {
    throw new Error('Either records data or src must be provided');
  }

  const result = parseTableData(data, parser);
  if (!result.columns && columns) {
    result.columns = columns;
  }
  return result;
}

const TableMarkup = component('TableMarkup')(({
  columns,
  records,
  syntax,
  ...others
}: RecordColumns & PropsSyntaxBase) => {
  if (columns === undefined) {
    const keys = Object.keys(records[0]);
    records.forEach((record) => {
      Object.keys(record).forEach((key: any) => {
        if (!keys.includes(key)) {
          keys.push(key);
        }
      });
    });
    columns = keys.map((key) => ({ field: key, header: key }));
  }
  return (
    <Markup.TableContainer markupLang={syntax} {...others}>
      <Markup.TableHead>
        <Markup.TableRow>
          {columns.map((column, index) => (
            <Markup.TableCell key={index}>{column.header}</Markup.TableCell>
          ))}
        </Markup.TableRow>
      </Markup.TableHead>
      <Markup.TableBody>
        {records.map((record, index) => (
          <Markup.TableRow key={index}>
            {columns.map((column, index) => (
              <Markup.TableCell key={index}>{record[column.field]}</Markup.TableCell>
            ))}
          </Markup.TableRow>
        ))}
      </Markup.TableBody>
    </Markup.TableContainer>
  );
});

const TableSerialize = component('TableSerialize')(({
  columns,
  records,
  syntax,
  ...others
}: RecordColumns & PropsSyntaxBase) => {
  if (columns === undefined) {
    return <Serialize.Object data={records} serializer={syntax} {...others} />;
  } else {
    return (
      <Serialize.Object
        data={{
          columns: columns,
          records: records,
        }}
        serializer={syntax}
        {...others}
      />
    );
  }
});

/**
 * Displaying a table with records and columns.
 *
 * @param {'markdown'|'html'|'json'|'text'|'csv'|'tsv'|'xml'} syntax - The output syntax of the content.
 * @param {object|string} records - A list, each element is an object / dictionary / list of elements. The keys are the fields and the values are the data in cells.
 * @param {object} columns - A list of column definitions. Each column definition is an object with keys "field", "header", and "description".
 * The field is the key in the record object, the header is displayed in the top row, and the description is meant to be an explanation.
 * Columns are optional. If not provided, the columns are inferred from the records.
 * @param {string} src - The source file to read the data from. This must be provided if records is not provided.
 * @param {'auto'|'csv'|'tsv'|'excel'|'json'|'jsonl'} parser - The parser to use for reading the data. If not provided, it will be inferred from the file extension.
 * @param {object|string} selectedColumns - The selected columns to display. If not provided, all columns will be displayed.
 * It should be an array of column field names, e.g. `["name", "age"]`; or a string like `2:4` to select columns 2 (inclusive) to 4 (exclusive).
 * There is a special column name called `index` which is the enumeration of the records starting from 0.
 * You can also use a special value called `+index` to add the index column to the original table.
 * @param {object|string} selectedRecords - The selected records to display. If not provided, all records will be displayed.
 * It should be an array of record indices, e.g. `[0, 1]`; or a string like `2:4` to select records 2 (inclusive) to 4 (exclusive).
 * @param {number} maxRecords - The maximum number of records to display. If not provided, all records will be displayed.
 * @param {number} maxColumns - The maximum number of columns to display. If not provided, all columns will be displayed.
 *
 * @see {@link Inline} for other props available.
 *
 * @example
 * ```xml
 * <table records="{{[{ name: 'Alice', age: 20 }, { name: 'Bob', age: 30 }]}}" />
 * ```
 *
 * To import an excel file, and display the first 10 records in csv syntax:
 *
 * ```xml
 * <table src="data.xlsx" parser="excel" maxRecords="10" syntax="csv" />
 * ```
 */
export const Table = component('Table')((props: TableProps) => {
  const presentation = computeSyntaxContext(props);
  const { records, columns, src, parser, ...others } = props;
  const data = toRecordColumns(props);
  const selectedData = columnRecordsSelector(data.records, data.columns, props);
  if (presentation === 'markup') {
    return <TableMarkup {...selectedData} {...others} />;
  } else if (presentation === 'serialize') {
    return <TableSerialize {...selectedData} {...others} />;
  }
});
