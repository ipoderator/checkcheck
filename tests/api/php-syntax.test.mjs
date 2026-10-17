// Весь PHP проходит php -l и не использует конструкции новее PHP 7.4 (список — interfaces.md).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lintDir } from '../helpers/php-lint.mjs';
import { PUBLIC_DIR } from '../helpers/php-server.mjs';

describe('PHP 7.4', () => {
  test('все файлы в public/ проходят php -l и проверку на конструкции новее 7.4', () => {
    const { files, problems } = lintDir(PUBLIC_DIR);
    assert.ok(files.length >= 10, `нашлось только ${files.length} PHP-файлов`);
    assert.deepEqual(problems, []);
  });

  const samples = {
    'match': '<?php $a = match ($x) { 1 => 2, default => 3 };',
    'nullsafe ?->': '<?php $a = $b?->c;',
    'named arguments': '<?php foo(name: 1);',
    'enum': '<?php enum Suit { case Hearts; }',
    'readonly': '<?php class A { public readonly int $x; }',
    'union type': '<?php function f(int|string $a): void {}',
    'mixed': '<?php function f(mixed $a) {}',
    'static return type': '<?php class A { public function f(): static { return $this; } }',
    'attribute': '<?php #[Attr] function f() {}',
    'str_contains': '<?php $a = str_contains($b, "c");',
    'str_starts_with': '<?php $a = str_starts_with($b, "c");',
    'str_ends_with': '<?php $a = str_ends_with($b, "c");',
    'constructor promotion': '<?php class A { public function __construct(private int $x) {} }',
    'catch without variable': '<?php try {} catch (Exception) {}',
    'trailing comma in parameters': '<?php function f($a, $b,) {}',
  };
  for (const [label, code] of Object.entries(samples)) {
    test(`ловит: ${label}`, () => {
      const dir = mkdtempSync(join(tmpdir(), 'vsecheki-lint-'));
      try {
        writeFileSync(join(dir, 'sample.php'), code);
        const { problems } = lintDir(dir);
        assert.ok(problems.length > 0, `не пойман: ${label}`);
      } finally { rmSync(dir, { recursive: true, force: true }); }
    });
  }

  test('не ругается на допустимое в 7.4: ?string, ternary, static::, arrow fn, case-метки', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vsecheki-lint-'));
    try {
      writeFileSync(join(dir, 'ok.php'), `<?php
final class A {
    const X = 1;
    public static function make(?string $a, array $b = [], int $c = 1): ?self { return $a ? new self() : null; }
    public function f(int $x): string {
        switch ($x) { case self::X: return 'a'; default: return static::class; }
    }
    public function g(array $xs): array { return array_map(fn ($v) => $v ? 1 : 2, $xs); }
}
foo($a ? B : C, [1, 2,]);
try { bar(); } catch (RuntimeException $e) { baz(); }
`);
      const { problems } = lintDir(dir);
      assert.deepEqual(problems, []);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
