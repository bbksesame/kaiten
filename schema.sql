PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS operators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  teamlead TEXT DEFAULT '',
  role TEXT DEFAULT '',
  status TEXT DEFAULT 'Чаты',
  statusSince TEXT DEFAULT '',
  note TEXT DEFAULT '',
  totalLine INTEGER DEFAULT 0,
  totalWant INTEGER DEFAULT 0,
  totalBreak INTEGER DEFAULT 0,
  totalWait INTEGER DEFAULT 0,
  totalLunch INTEGER DEFAULT 0,
  shiftStart TEXT DEFAULT '',
  shift TEXT DEFAULT '',
  workHours TEXT DEFAULT '',
  images TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS logs (
  ts TEXT NOT NULL,
  actor TEXT NOT NULL,
  operatorId TEXT NOT NULL,
  fromStatus TEXT NOT NULL,
  toStatus TEXT NOT NULL,
  note TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS accessCodes (
  code TEXT PRIMARY KEY,
  displayName TEXT,
  operatorId TEXT,
  role TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  operatorId TEXT,
  role TEXT,
  displayName TEXT,
  expiresIso TEXT
);

CREATE TABLE IF NOT EXISTS dailyReports (
  date TEXT,
  operatorId TEXT,
  name TEXT,
  teamlead TEXT,
  totalLine INTEGER,
  totalBreak INTEGER,
  totalWait INTEGER,
  totalLunch INTEGER
);
