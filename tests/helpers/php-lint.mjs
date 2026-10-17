#!/usr/bin/env node
// php -l по всем PHP-файлам папки + поиск конструкций новее PHP 7.4 по токенам PHP.
// Запуск: node tests/helpers/php-lint.mjs [папка] (по умолчанию public/). Код выхода 1 — есть проблемы.
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PHP = process.env.PHP_BIN || 'php';
const HERE = dirname(fileURLToPath(import.meta.url));

// Функции, которых нет в PHP 7.4.
const FORBIDDEN_FUNCTIONS = new Set([
  'str_contains', 'str_starts_with', 'str_ends_with', 'get_debug_type', 'fdiv', 'get_resource_id',
  'array_is_list', 'json_validate', 'array_find', 'array_find_key', 'array_any', 'array_all',
  'mb_trim', 'mb_ltrim', 'mb_rtrim', 'mb_ucfirst', 'mb_lcfirst', 'str_increment', 'str_decrement',
]);

// Дамп токенов без пробелов и комментариев: [имя, текст, строка].
const DUMP = `$t = token_get_all(file_get_contents($argv[1])); $o = []; $line = 1;
foreach ($t as $x) {
  if (is_array($x)) { $line = $x[2]; $n = token_name($x[0]);
    if ($n === 'T_WHITESPACE' || $n === 'T_COMMENT' || $n === 'T_DOC_COMMENT') continue;
    $o[] = [$n, $x[1], $x[2]];
  } else { $o[] = [$x, $x, $line]; }
}
echo json_encode($o);`;

function phpFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) out.push(...phpFiles(abs));
    else if (name.endsWith('.php')) out.push(abs);
  }
  return out.sort();
}

const IDENT = new Set(['T_STRING', 'T_NAME_QUALIFIED', 'T_NAME_FULLY_QUALIFIED', 'T_NAME_RELATIVE', 'T_ARRAY', 'T_CALLABLE', 'T_STATIC']);

/** @returns {string[]} описания найденных конструкций */
export function findModernSyntax(tokens) {
  const found = [];
  const at = (i) => tokens[i] || ['', '', 0];
  const add = (i, what) => found.push(`строка ${at(i)[2]}: ${what}`);

  for (let i = 0; i < tokens.length; i += 1) {
    const [name, text] = tokens[i];
    const prev = at(i - 1);
    const next = at(i + 1);
    if (name === 'T_MATCH') add(i, 'match');
    if (name === 'T_NULLSAFE_OBJECT_OPERATOR') add(i, '?->');
    if (name === 'T_ENUM') add(i, 'enum');
    if (name === 'T_READONLY') add(i, 'readonly');
    if (name === 'T_ATTRIBUTE') add(i, 'атрибут #[…]');
    if (name === 'T_STRING' && text.toLowerCase() === 'mixed'
        && !['T_OBJECT_OPERATOR', 'T_DOUBLE_COLON', 'T_FUNCTION', 'T_CONST', 'T_NEW'].includes(prev[0])) add(i, 'тип mixed');
    if (name === 'T_STRING' && FORBIDDEN_FUNCTIONS.has(text.toLowerCase()) && next[0] === '('
        && !['T_OBJECT_OPERATOR', 'T_DOUBLE_COLON', 'T_FUNCTION'].includes(prev[0])) add(i, `${text}()`);
    // Именованный аргумент: «(имя:» или «, имя:» (не «::» и не метка case).
    if (IDENT.has(name) && (prev[0] === '(' || prev[0] === ',') && next[0] === ':') {
      // Отличаем от «? a : b» внутри вызова: перед именем стоит «(» или «,», а не «?».
      add(i, `именованный аргумент ${text}:`);
    }
    if (name === 'T_CATCH') {
      let j = i + 2; let hasVar = false;
      while (j < tokens.length && at(j)[0] !== ')') { if (at(j)[0] === 'T_VARIABLE') hasVar = true; j += 1; }
      if (!hasVar) add(i, 'catch без переменной');
    }
    if (name === 'T_FUNCTION' || name === 'T_FN') {
      // Сигнатура: от «(» до парной «)», затем возвращаемый тип до «{», «;» или «=>».
      let j = i + 1;
      while (j < tokens.length && at(j)[0] !== '(') j += 1;
      const isCtor = at(i + 1)[1].toLowerCase() === '__construct' || at(i + 2)[1].toLowerCase() === '__construct';
      let depth = 0;
      let k = j;
      for (; k < tokens.length; k += 1) {
        const t = at(k)[0];
        if (t === '(') depth += 1;
        if (t === ')') { depth -= 1; if (depth === 0) break; }
        if (depth === 1 && t === '|') add(k, 'union-тип в параметре');
        if (depth === 1 && t === ',' && at(k + 1)[0] === ')') add(k, 'запятая после последнего параметра');
        if (depth === 1 && isCtor && ['T_PUBLIC', 'T_PRIVATE', 'T_PROTECTED', 'T_READONLY'].includes(t)) add(k, 'промоушн свойства в конструкторе');
      }
      // use (...) у замыкания и возвращаемый тип
      let m = k + 1;
      if (at(m)[0] === 'T_USE') {
        let d = 0;
        for (; m < tokens.length; m += 1) {
          if (at(m)[0] === '(') d += 1;
          if (at(m)[0] === ')') { d -= 1; if (d === 0) break; }
          if (d === 1 && at(m)[0] === ',' && at(m + 1)[0] === ')') add(m, 'запятая в конце use (…)');
        }
        m += 1;
      }
      if (at(m)[0] === ':') {
        for (let r = m + 1; r < tokens.length; r += 1) {
          const t = at(r)[0];
          if (t === '{' || t === ';' || t === 'T_DOUBLE_ARROW') break;
          if (t === '|') add(r, 'union-тип возврата');
          if (t === 'T_STATIC') add(r, 'возвращаемый тип static');
          if (t === 'T_STRING' && ['never', 'mixed'].includes(at(r)[1].toLowerCase())) add(r, `возвращаемый тип ${at(r)[1]}`);
        }
      }
    }
  }
  return [...new Set(found)];
}

export function lintFile(file) {
  const problems = [];
  const lint = spawnSync(PHP, ['-l', file], { encoding: 'utf8' });
  if (lint.status !== 0) problems.push(`php -l: ${(lint.stdout + lint.stderr).trim().split('\n')[0]}`);
  const dump = spawnSync(PHP, ['-r', DUMP, file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (dump.status !== 0) {
    problems.push(`не удалось разобрать токены: ${dump.stderr.trim()}`);
  } else {
    problems.push(...findModernSyntax(JSON.parse(dump.stdout)));
  }
  return problems;
}

/** @returns {{ files: string[], problems: string[] }} */
export function lintDir(dir) {
  const files = phpFiles(dir);
  const problems = [];
  for (const file of files) {
    for (const p of lintFile(file)) problems.push(`${relative(dir, file)}: ${p}`);
  }
  return { files, problems };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const dir = resolve(process.argv[2] || join(HERE, '..', '..', 'public'));
  const { files, problems } = lintDir(dir);
  if (problems.length) {
    console.error(`php-lint: проблемы (${problems.length}):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(`php-lint: ок — ${files.length} файлов, синтаксис PHP 7.4`);
}
