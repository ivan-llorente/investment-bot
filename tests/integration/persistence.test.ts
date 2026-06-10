/**
 * Integration: adaptadores SQLite contra una base de datos real (en
 * memoria). Verifica que los puertos del dominio se cumplen de verdad,
 * incluyendo round-trips y el comportamiento de upsert/dedupe.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Position } from '../../src/domain/position.js';
import { openInMemoryDb, type Db } from '../../src/infrastructure/persistence/db.js';
import { SqliteAlertLog } from '../../src/infrastructure/persistence/sqlite-alert-log.js';
import { SqlitePositionRepository } from '../../src/infrastructure/persistence/sqlite-position-repo.js';

describe('SqlitePositionRepository', () => {
  let db: Db;
  let repo: SqlitePositionRepository;

  beforeEach(() => {
    db = openInMemoryDb();
    repo = new SqlitePositionRepository(db);
  });

  it('persiste y recupera una posición con todos sus campos', () => {
    const position = new Position('BTC/USDT', 'long', 0.5, 'donchian', '2026-06-10T12:00:00Z');
    repo.save(position);

    const found = repo.find('BTC/USDT');
    expect(found).toBeInstanceOf(Position);
    expect(found).toMatchObject({
      symbol: 'BTC/USDT',
      side: 'long',
      qty: 0.5,
      strategy: 'donchian',
      openedAt: '2026-06-10T12:00:00Z',
    });
  });

  it('find devuelve undefined si el símbolo no existe', () => {
    expect(repo.find('ETH/USDT')).toBeUndefined();
  });

  it('save sobre el mismo símbolo actualiza (upsert), no duplica', () => {
    repo.save(new Position('BTC/USDT', 'long', 0.5, 'donchian', '2026-06-10T12:00:00Z'));
    repo.save(new Position('BTC/USDT', 'short', 0.2, 'cme-gap', '2026-06-11T12:00:00Z'));

    const rows = db.prepare('SELECT COUNT(*) AS n FROM positions').get() as { n: number };
    expect(rows.n).toBe(1);
    expect(repo.find('BTC/USDT')).toMatchObject({ side: 'short', qty: 0.2, strategy: 'cme-gap' });
  });

  it('remove borra la posición y es idempotente', () => {
    repo.save(new Position('BTC/USDT', 'long', 0.5, 'donchian', '2026-06-10T12:00:00Z'));
    repo.remove('BTC/USDT');
    expect(repo.find('BTC/USDT')).toBeUndefined();
    expect(() => repo.remove('BTC/USDT')).not.toThrow();
  });

  it('mantiene posiciones de símbolos distintos de forma independiente', () => {
    repo.save(new Position('BTC/USDT', 'long', 0.5, 'donchian', '2026-06-10T12:00:00Z'));
    repo.save(new Position('ETH/USDT', 'long', 2, 'donchian', '2026-06-10T13:00:00Z'));

    repo.remove('BTC/USDT');
    expect(repo.find('ETH/USDT')).toBeDefined();
  });
});

describe('SqliteAlertLog', () => {
  let db: Db;
  let log: SqliteAlertLog;

  beforeEach(() => {
    db = openInMemoryDb();
    log = new SqliteAlertLog(db);
  });

  it('la primera vez que ve una clave devuelve true', () => {
    expect(log.recordIfNew('abc')).toBe(true);
  });

  it('una clave repetida devuelve false (dedupe persistente)', () => {
    log.recordIfNew('abc');
    expect(log.recordIfNew('abc')).toBe(false);
  });

  it('claves distintas no interfieren entre sí', () => {
    expect(log.recordIfNew('abc')).toBe(true);
    expect(log.recordIfNew('def')).toBe(true);
  });

  it('purga entradas con más de 7 días, así un retry antiguo vuelve a pasar', () => {
    const oldDate = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
    db.prepare('INSERT INTO processed_alerts (key, seen_at) VALUES (?, ?)').run('old-key', oldDate);

    // Cualquier inserción dispara la purga.
    log.recordIfNew('trigger-prune');
    expect(log.recordIfNew('old-key')).toBe(true);
  });
});
